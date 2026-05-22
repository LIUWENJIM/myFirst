package interview.guide.common.async;

import interview.guide.common.constant.AsyncTaskStreamConstants;
import interview.guide.infrastructure.redis.RedisService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.stream.StreamMessageId;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Redis Stream 消费者模板基类
 *
 * 采用模板方法模式，统一异步任务的消费流程和重试机制。
 * 子类只需实现抽象方法，即可快速接入 Redis Stream 消费者。
 *
 * 核心消费流程：
 * 1. Spring 容器初始化时（@PostConstruct），创建单线程池并启动消费循环
 * 2. 创建 Redis Stream 消费者组（如果不存在）
 * 3. 轮询 Stream 中的新消息（阻塞式长轮询）
 * 4. 解析消息 -> 标记处理中 -> 执行业务逻辑 -> 标记完成 -> ACK 确认
 * 5. 如果业务逻辑执行失败，进行重试（最多 3 次）
 * 6. 超过重试次数仍失败，标记为 FAILED 并 ACK（避免消息阻塞）
 * 7. Spring 容器销毁时（@PreDestroy），优雅关闭线程池
 *
 * 重试机制：
 * - 消息中携带 retryCount 字段，每次重试 +1
 * - 超过 MAX_RETRY_COUNT（默认 3 次）后标记为失败
 * - 重试通过重新发送消息到 Stream 实现（不是 Redis NACK）
 *
 * 子类需要实现的抽象方法：
 * 1. {@link #taskDisplayName()}    - 任务显示名称（用于日志）
 * 2. {@link #streamKey()}         - Redis Stream 的 Key
 * 3. {@link #groupName()}         - 消费者组名称
 * 4. {@link #consumerPrefix()}    - 消费者名称前缀
 * 5. {@link #threadName()}        - 线程名称
 * 6. {@link #parsePayload}        - 解析消息内容为业务对象
 * 7. {@link #payloadIdentifier}   - 生成任务标识符（用于日志）
 * 8. {@link #markProcessing}      - 标记任务为处理中
 * 9. {@link #processBusiness}     - 执行核心业务逻辑
 * 10. {@link #markCompleted}      - 标记任务为完成
 * 11. {@link #markFailed}         - 标记任务为失败
 * 12. {@link #retryMessage}       - 重试消息（重新入队）
 *
 * 设计模式：模板方法模式（Template Method）
 */
@Slf4j
public abstract class AbstractStreamConsumer<T> {

    private final RedisService redisService;              // Redis 服务，用于 Stream 操作
    private final AtomicBoolean running = new AtomicBoolean(false);  // 运行状态标志，控制消费循环的启停
    private ExecutorService executorService;               // 单线程池，消费任务在独立线程中运行
    private String consumerName;                           // 消费者名称（前缀 + 随机UUID），用于 Redis Stream 消费者组

    protected AbstractStreamConsumer(RedisService redisService) {
        this.redisService = redisService;
    }

    /**
     * 初始化消费者（Spring 容器启动时自动调用）
     *
     * 初始化流程：
     * 1. 生成唯一消费者名称（前缀 + 随机UUID前8位）
     * 2. 创建单线程池（守护线程，不阻塞 JVM 关闭）
     * 3. 启动消费循环
     */
    @PostConstruct
    public void init() {
        this.consumerName = consumerPrefix() + UUID.randomUUID().toString().substring(0, 8);
        this.executorService = new ThreadPoolExecutor(
            1,
            1,
            0L,
            TimeUnit.MILLISECONDS,
            new LinkedBlockingQueue<>(),
            r -> {
                Thread t = new Thread(r, threadName());
                t.setDaemon(true);
                return t;
            },
            new ThreadPoolExecutor.AbortPolicy()
        );

        running.set(true);
        executorService.submit(this::startConsumer);
        log.info("{} consumer started: consumerName={}", taskDisplayName(), consumerName);
    }

    /**
     * 关闭消费者（Spring 容器销毁时自动调用）
     *
     * 1. 设置 running 标志为 false，通知消费循环退出
     * 2. 关闭线程池（等待当前任务完成）
     */
    @PreDestroy
    public void shutdown() {
        running.set(false);
        if (executorService != null) {
            executorService.shutdown();
        }
        log.info("{} consumer stopped: consumerName={}", taskDisplayName(), consumerName);
    }

    /**
     * 启动消费者
     *
     * 1. 创建 Redis Stream 消费者组（幂等操作，已存在则忽略）
     * 2. 进入消费循环
     */
    private void startConsumer() {
        try {
            redisService.createStreamGroup(streamKey(), groupName());
            log.info("Redis Stream group is ready: {}", groupName());
        } catch (Exception e) {
            log.warn("Failed to prepare Redis Stream group: groupName={}", groupName(), e);
        }

        consumeLoop();
    }

    /**
     * 消费循环（在独立线程中持续运行）
     *
     * 循环调用 RedisService.streamConsumeMessages() 进行阻塞式长轮询。
     * 当 running 标志为 false 或线程被中断时退出循环。
     * 异常不会导致循环退出，仅记录错误日志后继续消费。
     */
    private void consumeLoop() {
        while (running.get()) {
            try {
                redisService.streamConsumeMessages(
                    streamKey(),
                    groupName(),
                    consumerName,
                    AsyncTaskStreamConstants.BATCH_SIZE,
                    AsyncTaskStreamConstants.POLL_INTERVAL_MS,
                    this::processMessage
                );
            } catch (Exception e) {
                if (Thread.currentThread().isInterrupted()) {
                    log.info("Consumer thread interrupted");
                    break;
                }
                log.error("Failed to consume message", e);
            }
        }
    }

    /**
     * 处理单条消息（核心处理流程）
     *
     * 处理流程：
     * 1. 解析消息内容为业务对象（parsePayload）
     *    - 如果解析失败（返回 null），直接 ACK 跳过
     * 2. 解析重试次数
     * 3. 标记任务为处理中（markProcessing）
     * 4. 执行核心业务逻辑（processBusiness）
     * 5. 标记任务为完成（markCompleted）并 ACK
     * 6. 如果执行异常：
     *    - 重试次数 < MAX_RETRY_COUNT：重新入队（retryMessage）
     *    - 重试次数 >= MAX_RETRY_COUNT：标记为失败（markFailed）并 ACK
     *
     * @param messageId Redis Stream 消息ID
     * @param data      消息字段 Map
     */
    private void processMessage(StreamMessageId messageId, Map<String, String> data) {
        T payload = parsePayload(messageId, data);
        if (payload == null) {
            ackMessage(messageId);
            return;
        }

        int retryCount = parseRetryCount(data);
        log.info("Processing {} task: payload={}, messageId={}, retryCount={}",
            taskDisplayName(), payloadIdentifier(payload), messageId, retryCount);

        try {
            markProcessing(payload);
            processBusiness(payload);
            markCompleted(payload);
            ackMessage(messageId);
            log.info("{} task completed: {}", taskDisplayName(), payloadIdentifier(payload));
        } catch (Exception e) {
            log.error("{} task failed: {}", taskDisplayName(), payloadIdentifier(payload), e);
            if (retryCount < AsyncTaskStreamConstants.MAX_RETRY_COUNT) {
                retryMessage(payload, retryCount + 1);
            } else {
                markFailed(payload, truncateError(
                    taskDisplayName() + " failed after retry " + retryCount + ": " + e.getMessage()
                ));
            }
            ackMessage(messageId);
        }
    }

    /**
     * 解析重试次数
     *
     * @param data 消息字段 Map
     * @return 重试次数，解析失败返回 0
     */
    protected int parseRetryCount(Map<String, String> data) {
        try {
            return Integer.parseInt(data.getOrDefault(AsyncTaskStreamConstants.FIELD_RETRY_COUNT, "0"));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * 截断错误信息（最多 500 字符）
     * 避免超长错误信息写入数据库导致字段溢出
     *
     * @param error 原始错误信息
     * @return 截断后的错误信息
     */
    protected String truncateError(String error) {
        if (error == null) {
            return null;
        }
        return error.length() > 500 ? error.substring(0, 500) : error;
    }

    /**
     * ACK 确认消息
     * 告知 Redis Stream 该消息已被成功消费，不再投递给其他消费者
     *
     * @param messageId 消息ID
     */
    private void ackMessage(StreamMessageId messageId) {
        try {
            redisService.streamAck(streamKey(), groupName(), messageId);
        } catch (Exception e) {
            log.error("Failed to ack stream message: messageId={}", messageId, e);
        }
    }

    /**
     * 获取 RedisService 实例（供子类使用）
     *
     * @return RedisService 实例
     */
    protected RedisService redisService() {
        return redisService;
    }

    /** 获取任务显示名称（用于日志），例如："向量化"、"简历分析" */
    protected abstract String taskDisplayName();

    /** 获取 Redis Stream 的 Key */
    protected abstract String streamKey();

    /** 获取消费者组名称（同一组内的消息只会被一个消费者消费） */
    protected abstract String groupName();

    /** 获取消费者名称前缀（用于生成唯一消费者名称） */
    protected abstract String consumerPrefix();

    /** 获取线程名称（用于日志和调试） */
    protected abstract String threadName();

    /**
     * 解析消息内容为业务对象
     *
     * @param messageId 消息ID
     * @param data      消息字段 Map
     * @return 解析后的业务对象，如果格式错误返回 null（会直接 ACK 跳过）
     */
    protected abstract T parsePayload(StreamMessageId messageId, Map<String, String> data);

    /**
     * 获取任务标识符（用于日志和去重）
     * 例如："kbId=123"、"resumeId=456"
     */
    protected abstract String payloadIdentifier(T payload);

    /**
     * 标记任务为处理中
     * 子类通常在此方法中更新数据库状态为 PROCESSING
     */
    protected abstract void markProcessing(T payload);

    /**
     * 执行核心业务逻辑
     * 子类在此方法中实现具体的业务处理（如调用 LLM、写入数据库等）
     */
    protected abstract void processBusiness(T payload);

    /**
     * 标记任务为完成
     * 子类通常在此方法中更新数据库状态为 COMPLETED
     */
    protected abstract void markCompleted(T payload);

    /**
     * 标记任务为失败
     * 子类通常在此方法中更新数据库状态为 FAILED 并记录错误信息
     *
     * @param payload 任务载荷
     * @param error   截断后的错误信息
     */
    protected abstract void markFailed(T payload, String error);

    /**
     * 重试消息（重新发送到 Stream）
     * 子类在此方法中构建重试消息并重新发送，retryCount + 1
     *
     * @param payload    任务载荷
     * @param retryCount 新的重试次数
     */
    protected abstract void retryMessage(T payload, int retryCount);
}
