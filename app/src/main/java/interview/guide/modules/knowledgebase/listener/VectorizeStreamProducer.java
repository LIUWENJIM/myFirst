package interview.guide.modules.knowledgebase.listener;

import interview.guide.common.async.AbstractStreamProducer;
import interview.guide.common.constant.AsyncTaskStreamConstants;
import interview.guide.infrastructure.redis.RedisService;
import interview.guide.modules.knowledgebase.model.VectorStatus;
import interview.guide.modules.knowledgebase.repository.KnowledgeBaseRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 向量化任务生产者
 * 负责发送向量化任务到 Redis Stream
 *
 * 生产者职责：
 * 1. 将向量化任务封装成消息
 * 2. 发送到 Redis Stream（异步队列）
 * 3. 处理发送失败的情况（更新状态为 FAILED）
 *
 * 消息格式：
 * - kbId: 知识库ID
 * - content: 文档文本内容
 * - retryCount: 重试次数（初始为 0）
 */
@Slf4j
@Component
public class VectorizeStreamProducer extends AbstractStreamProducer<VectorizeStreamProducer.VectorizeTaskPayload> {

    private final KnowledgeBaseRepository knowledgeBaseRepository;  // 知识库仓库，用于更新向量化状态

    // 任务载荷，包含知识库ID和内容
    record VectorizeTaskPayload(Long kbId, String content) {}

    /**
     * 构造函数
     *
     * @param redisService           Redis 服务，用于操作 Stream
     * @param knowledgeBaseRepository 知识库仓库
     */
    public VectorizeStreamProducer(RedisService redisService, KnowledgeBaseRepository knowledgeBaseRepository) {
        super(redisService);
        this.knowledgeBaseRepository = knowledgeBaseRepository;
    }

    /**
     * 发送向量化任务到 Redis Stream
     *
     * @param kbId    知识库ID
     * @param content 文档文本内容
     */
    public void sendVectorizeTask(Long kbId, String content) {
        sendTask(new VectorizeTaskPayload(kbId, content));
    }

    /**
     * 获取任务显示名称（用于日志）
     */
    @Override
    protected String taskDisplayName() {
        return "向量化";
    }

    /**
     * 获取 Redis Stream 的 Key
     */
    @Override
    protected String streamKey() {
        return AsyncTaskStreamConstants.KB_VECTORIZE_STREAM_KEY;
    }

    /**
     * 构建消息内容（发送到 Stream 的字段）
     *
     * @param payload 任务载荷
     * @return 消息字段 Map
     */
    @Override
    protected Map<String, String> buildMessage(VectorizeTaskPayload payload) {
        return Map.of(
            AsyncTaskStreamConstants.FIELD_KB_ID, payload.kbId().toString(),
            AsyncTaskStreamConstants.FIELD_CONTENT, payload.content(),
            AsyncTaskStreamConstants.FIELD_RETRY_COUNT, "0"
        );
    }

    /**
     * 获取任务标识符（用于日志和去重）
     */
    @Override
    protected String payloadIdentifier(VectorizeTaskPayload payload) {
        return "kbId=" + payload.kbId();
    }

    /**
     * 发送失败时的回调
     *
     * @param payload 任务载荷
     * @param error   错误信息
     */
    @Override
    protected void onSendFailed(VectorizeTaskPayload payload, String error) {
        updateVectorStatus(payload.kbId(), VectorStatus.FAILED, truncateError(error));
    }

    /**
     * 更新向量化状态
     *
     * @param kbId   知识库ID
     * @param status 新状态
     * @param error  错误信息（如果失败）
     */
    private void updateVectorStatus(Long kbId, VectorStatus status, String error) {
        knowledgeBaseRepository.findById(kbId).ifPresent(kb -> {
            kb.setVectorStatus(status);
            if (error != null) {
                // 截断错误信息（最多 500 字符）
                kb.setVectorError(error.length() > 500 ? error.substring(0, 500) : error);
            }
            knowledgeBaseRepository.save(kb);
        });
    }
}
