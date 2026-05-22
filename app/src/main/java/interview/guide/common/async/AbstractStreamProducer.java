package interview.guide.common.async;

import interview.guide.common.constant.AsyncTaskStreamConstants;
import interview.guide.infrastructure.redis.RedisService;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

/**
 * Redis Stream 生产者模板基类
 *
 * 采用模板方法模式，统一异步任务的消息发送骨架和失败处理逻辑。
 * 子类只需实现抽象方法，即可快速接入 Redis Stream 异步队列。
 *
 * 设计模式：模板方法模式（Template Method）
 * - 模板方法：{@link #sendTask(Object)} 定义发送流程骨架
 * - 抽象步骤：由子类实现消息构建、标识符生成、失败回调等
 *
 * 子类需要实现的抽象方法：
 * 1. {@link #taskDisplayName()}  - 任务显示名称（用于日志）
 * 2. {@link #streamKey()}       - Redis Stream 的 Key
 * 3. {@link #buildMessage}      - 构建消息字段 Map
 * 4. {@link #payloadIdentifier} - 生成任务标识符（用于日志和去重）
 * 5. {@link #onSendFailed}      - 发送失败时的回调（如更新数据库状态）
 *
 * 使用示例：
 * <pre>
 * public class MyProducer extends AbstractStreamProducer<MyPayload> {
 *     protected Map<String, String> buildMessage(MyPayload payload) {
 *         return Map.of("key", payload.value());
 *     }
 *     // ... 其他抽象方法实现
 * }
 * </pre>
 */
@Slf4j
public abstract class AbstractStreamProducer<T> {

    private final RedisService redisService;  // Redis 服务，用于 Stream 操作

    /**
     * 构造函数
     *
     * @param redisService Redis 服务实例
     */
    protected AbstractStreamProducer(RedisService redisService) {
        this.redisService = redisService;
    }

    /**
     * 发送任务到 Redis Stream（模板方法）
     *
     * 发送流程：
     * 1. 调用子类 buildMessage() 构建消息字段
     * 2. 通过 RedisService 发送到 Stream（带最大长度限制）
     * 3. 发送成功，记录日志
     * 4. 发送失败，记录错误日志并调用子类 onSendFailed() 回调
     *
     * @param payload 任务载荷（业务对象）
     */
    protected void sendTask(T payload) {
        try {
            String messageId = redisService.streamAdd(
                streamKey(),
                buildMessage(payload),
                AsyncTaskStreamConstants.STREAM_MAX_LEN
            );
            log.info("{}任务已发送到Stream: {}, messageId={}",
                taskDisplayName(), payloadIdentifier(payload), messageId);
        } catch (Exception e) {
            log.error("发送{}任务失败: {}, error={}",
                taskDisplayName(), payloadIdentifier(payload), e.getMessage(), e);
            onSendFailed(payload, "任务入队失败: " + e.getMessage());
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
     * 获取任务显示名称（用于日志）
     * 例如："向量化"、"简历分析"
     */
    protected abstract String taskDisplayName();

    /**
     * 获取 Redis Stream 的 Key
     * 例如：AsyncTaskStreamConstants.KB_VECTORIZE_STREAM_KEY
     */
    protected abstract String streamKey();

    /**
     * 构建消息字段 Map（发送到 Stream 的内容）
     *
     * @param payload 任务载荷
     * @return 消息字段 Map，key 为字段名，value 为字段值
     */
    protected abstract Map<String, String> buildMessage(T payload);

    /**
     * 获取任务标识符（用于日志和去重）
     * 例如："kbId=123"、"resumeId=456"
     *
     * @param payload 任务载荷
     * @return 任务标识符字符串
     */
    protected abstract String payloadIdentifier(T payload);

    /**
     * 发送失败时的回调
     * 子类通常在此方法中更新数据库状态为 FAILED
     *
     * @param payload 任务载荷
     * @param error   错误信息
     */
    protected abstract void onSendFailed(T payload, String error);
}
