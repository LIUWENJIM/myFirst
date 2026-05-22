package interview.guide.common.aspect;

import interview.guide.common.annotation.RateLimit;
import interview.guide.common.exception.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.redisson.api.RScript;
import org.redisson.api.RedissonClient;
import org.redisson.client.codec.StringCodec;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * 限流 AOP 切面
 *
 * 通过拦截带有 {@link RateLimit} 注解的方法，实现声明式接口限流。
 * 支持可重复注解（@RateLimit.Container），逐条执行独立的限流规则，任一规则不通过即拒绝请求。
 *
 * 限流算法：滑动窗口计数器（基于 Redis Lua 脚本实现）
 * - 脚本路径：scripts/rate_limit_single.lua
 * - 使用 Redisson 的 RScript.evalSha() 执行，SHA1 缓存避免重复传输脚本
 * - 支持 NOSCRIPT 自动重载（Redis 重启后脚本缓存丢失的情况）
 *
 * 支持的限流维度（Dimension）：
 * - GLOBAL：全局维度，所有请求共享计数器
 * - IP：IP 维度，按客户端 IP 独立计数
 * - USER：用户维度，按当前登录用户独立计数
 *
 * 降级策略：
 * - 如果注解指定了 fallback 方法，限流触发时调用降级方法（而非抛异常）
 * - 降级方法需在同一个类中，支持无参和同参两种签名
 *
 * Redis Key 格式：ratelimit:{ClassName:methodName}:dimension:identifier
 * - 使用 Redis HashTag {} 确保相关 Key 落在同一 slot（集群模式友好）
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class RateLimitAspect {

    private final RedissonClient redissonClient;  // Redisson 客户端，用于执行 Lua 脚本

    private static final String LUA_SCRIPT;       // 限流 Lua 脚本内容（类加载时从 classpath 读取）
    private String luaScriptSha;                  // Lua 脚本的 SHA1 哈希（用于 evalSha 执行）
    private RScript rScript;                      // Redisson 脚本执行器

    static {
        try {
            ClassPathResource resource = new ClassPathResource("scripts/rate_limit_single.lua");
            LUA_SCRIPT = new String(resource.getContentAsByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("加载限流 Lua 脚本失败", e);
        }
    }

    /**
     * 初始化：获取 Redisson 脚本执行器并加载 Lua 脚本到 Redis
     * 脚本加载后 Redis 会缓存 SHA1，后续通过 evalSha 调用（减少网络传输）
     */
    @jakarta.annotation.PostConstruct
    public void init() {
        rScript = redissonClient.getScript(StringCodec.INSTANCE);
        loadScript();
    }

    /**
     * 加载 Lua 脚本到 Redis，获取 SHA1 哈希
     * Redis 重启后需要重新加载（NOSCRIPT 异常时也会触发）
     */
    private void loadScript() {
        this.luaScriptSha = rScript.scriptLoad(LUA_SCRIPT);
        log.info("限流 Lua 脚本加载完成, SHA1: {}", luaScriptSha);
    }

    /**
     * 环绕通知：拦截带 @RateLimit 或 @RateLimit.Container 注解的方法
     */
    @Around("@annotation(interview.guide.common.annotation.RateLimit) || " +
            "@annotation(interview.guide.common.annotation.RateLimit.Container)")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        String className = method.getDeclaringClass().getSimpleName();
        String methodName = method.getName();

        RateLimit[] rules = method.getAnnotationsByType(RateLimit.class);
        long nowMs = System.currentTimeMillis();
        String requestId = UUID.randomUUID().toString();

        for (RateLimit rule : rules) {
            long intervalMs = calculateIntervalMs(rule.interval(), rule.timeUnit());
            String key = generateKey(className, methodName, rule.dimension());

            Long result = executeRateLimitScript(key, nowMs, requestId, intervalMs, rule.count());

            if (result == null || result == 0) {
                return handleRateLimitExceeded(joinPoint, rule, key);
            }
        }

        return joinPoint.proceed();
    }

    /**
     * 执行限流 Lua 脚本
     *
     * Lua 脚本参数：
     * - KEYS[1]: 限流 Key
     * - ARGV[1]: 当前时间戳（毫秒）
     * - ARGV[2]: 请求数量（固定为 1）
     * - ARGV[3]: 时间窗口大小（毫秒）
     * - ARGV[4]: 最大允许请求数
     * - ARGV[5]: 请求唯一标识（用于日志追踪）
     *
     * 返回值：允许的剩余请求数（>0 表示通过，0 表示拒绝）
     *
     * @param key        限流 Redis Key
     * @param nowMs      当前时间戳（毫秒）
     * @param requestId  请求唯一标识
     * @param intervalMs 时间窗口大小（毫秒）
     * @param count      最大允许请求数
     * @return 剩余请求数，null 表示转换失败
     */
    private Long executeRateLimitScript(String key, long nowMs, String requestId, long intervalMs, double count) {
        List<Object> keysList = Collections.singletonList(key);
        Object[] args = {
                String.valueOf(nowMs),
                String.valueOf(1),
                String.valueOf(intervalMs),
                String.valueOf(count),
                requestId
        };

        try {
            Object resultObj = rScript.evalSha(
                    RScript.Mode.READ_WRITE,
                    luaScriptSha,
                    RScript.ReturnType.VALUE,
                    keysList,
                    args
            );
            return convertToLong(resultObj);
        } catch (org.redisson.client.RedisException e) {
            // Redis 重启后脚本缓存丢失，重新加载并重试
            if (e.getMessage() != null && e.getMessage().contains("NOSCRIPT")) {
                loadScript();
                Object resultObj = rScript.evalSha(
                        RScript.Mode.READ_WRITE,
                        luaScriptSha,
                        RScript.ReturnType.VALUE,
                        keysList,
                        args
                );
                return convertToLong(resultObj);
            }
            throw e;
        }
    }

    /**
     * 计算时间窗口大小（毫秒）
     *
     * @param interval 时间间隔数值
     * @param unit     时间单位（MILLISECONDS/SECONDS/MINUTES/HOURS/DAYS）
     * @return 时间窗口毫秒数
     */
    private long calculateIntervalMs(long interval, RateLimit.TimeUnit unit) {
        return switch (unit) {
            case MILLISECONDS -> interval;
            case SECONDS -> interval * 1000;
            case MINUTES -> interval * 60 * 1000;
            case HOURS -> interval * 3600 * 1000;
            case DAYS -> interval * 86400 * 1000;
        };
    }

    /**
     * 将 Lua 脚本返回值转换为 Long
     * Redisson 返回的可能是 Number 或 String 类型
     *
     * @param obj Lua 脚本返回值
     * @return 转换后的 Long 值，转换失败返回 null
     */
    private Long convertToLong(Object obj) {
        if (obj instanceof Number n) {
            return n.longValue();
        }
        if (obj instanceof String s) {
            try {
                return Long.parseLong(s);
            } catch (NumberFormatException e) {
                log.warn("无法将字符串转换为Long: {}", obj);
                return null;
            }
        }
        log.warn("不支持的对象类型转换为Long: {}", obj != null ? obj.getClass().getName() : "null");
        return null;
    }

    /**
     * 生成限流 Redis Key
     *
     * Key 格式：ratelimit:{ClassName:methodName}:dimension:identifier
     * - 使用 Redis HashTag {} 确保同一方法的限流 Key 落在同一 slot（集群模式友好）
     * - GLOBAL 维度无后缀，IP 维度追加客户端 IP，USER 维度追加用户ID
     *
     * @param className  类名
     * @param methodName 方法名
     * @param dimension  限流维度（GLOBAL/IP/USER）
     * @return 限流 Redis Key
     */
    private String generateKey(String className, String methodName, RateLimit.Dimension dimension) {
        String hashTag = "{" + className + ":" + methodName + "}";
        String keyPrefix = "ratelimit:" + hashTag;

        return switch (dimension) {
            case GLOBAL -> keyPrefix + ":global";
            case IP -> keyPrefix + ":ip:" + getClientIp();
            case USER -> keyPrefix + ":user:" + getCurrentUserId();
        };
    }

    /**
     * 处理限流超限
     *
     * 策略：
     * 1. 如果注解配置了 fallback 方法，调用降级方法（不抛异常）
     * 2. 否则抛出 RateLimitExceededException 异常（由 GlobalExceptionHandler 处理）
     *
     * @param joinPoint  AOP 连接点
     * @param rateLimit  限流注解（包含 fallback 配置）
     * @param key        限流 Redis Key（用于日志）
     * @return 降级方法的返回值
     * @throws RateLimitExceededException 如果没有配置降级方法
     */
    private Object handleRateLimitExceeded(ProceedingJoinPoint joinPoint, RateLimit rateLimit, String key)
            throws Throwable {
        String methodName = joinPoint.getSignature().getName();

        if (rateLimit.fallback() != null && !rateLimit.fallback().isEmpty()) {
            try {
                Method fallbackMethod = findFallbackMethod(joinPoint, rateLimit.fallback());
                if (fallbackMethod != null) {
                    log.debug("限流触发，执行降级方法: {}.{} -> {}",
                            joinPoint.getTarget().getClass().getSimpleName(),
                            methodName,
                            rateLimit.fallback());
                    if (fallbackMethod.getParameterCount() > 0) {
                        return fallbackMethod.invoke(joinPoint.getTarget(), joinPoint.getArgs());
                    } else {
                        return fallbackMethod.invoke(joinPoint.getTarget());
                    }
                }
            } catch (Exception e) {
                log.error("降级方法执行失败: {}", rateLimit.fallback(), e);
            }
        }

        log.debug("限流触发，拒绝请求: key={}, count={} per {} {}",
                key, rateLimit.count(), rateLimit.interval(), rateLimit.timeUnit());
        throw new RateLimitExceededException("请求过于频繁，请稍后再试");
    }

    /**
     * 查找降级方法
     * 优先查找同参方法，其次查找无参方法
     *
     * @param joinPoint   AOP 连接点
     * @param fallbackName 降级方法名
     * @return 降级方法引用，未找到返回 null
     */
    private Method findFallbackMethod(ProceedingJoinPoint joinPoint, String fallbackName) {
        Class<?> targetClass = joinPoint.getTarget().getClass();
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Class<?>[] parameterTypes = signature.getParameterTypes();

        try {
            Method method = targetClass.getDeclaredMethod(fallbackName, parameterTypes);
            method.setAccessible(true);
            return method;
        } catch (NoSuchMethodException e) {
            try {
                Method method = targetClass.getDeclaredMethod(fallbackName);
                method.setAccessible(true);
                return method;
            } catch (NoSuchMethodException ex) {
                log.warn("未找到降级方法: {}.{} (需无参或参数列表一致)",
                        targetClass.getSimpleName(), fallbackName);
                return null;
            }
        }
    }

    /**
     * 获取客户端真实 IP
     *
     * 优先级：X-Forwarded-For > X-Real-IP > Proxy-Client-IP > WL-Proxy-Client-IP > remoteAddr
     * 如果存在多个代理 IP（逗号分隔），取第一个（即最接近客户端的 IP）
     *
     * @return 客户端 IP 地址，获取失败返回 "unknown"
     */
    private String getClientIp() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return "unknown";
        }

        HttpServletRequest request = attributes.getRequest();
        String ip = request.getHeader("X-Forwarded-For");

        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }

        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }

        return ip != null ? ip : "unknown";
    }

    /**
     * 获取当前登录用户 ID
     *
     * 优先从 request attribute "userId" 获取（由认证拦截器设置）
     * 其次从请求头 "X-User-Id" 获取
     * 未登录返回 "anonymous"
     *
     * @return 用户ID字符串，未登录返回 "anonymous"
     */
    private String getCurrentUserId() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return "anonymous";
        }

        HttpServletRequest request = attributes.getRequest();

        Object userId = request.getAttribute("userId");
        if (userId != null) {
            return userId.toString();
        }

        userId = request.getHeader("X-User-Id");
        if (userId != null) {
            return userId.toString();
        }

        return "anonymous";
    }
}
