package interview.guide.modules.knowledgebase.listener;

import interview.guide.common.async.AbstractStreamConsumer;
import interview.guide.common.constant.AsyncTaskStreamConstants;
import interview.guide.infrastructure.redis.RedisService;
import interview.guide.modules.knowledgebase.model.VectorStatus;
import interview.guide.modules.knowledgebase.repository.KnowledgeBaseRepository;
import interview.guide.modules.knowledgebase.service.KnowledgeBaseVectorService;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.stream.StreamMessageId;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 知识库向量化 Stream 消费者
 * 负责从 Redis Stream 消费消息并执行向量化
 *
 * 消费者职责：
 * 1. 从 Redis Stream 消费向量化任务消息
 * 2. 解析消息内容（知识库ID和文本）
 * 3. 调用向量化服务进行文档分块和向量化
 * 4. 更新向量化状态（PROCESSING -> COMPLETED/FAILED）
 * 5. 处理重试逻辑（最多重试 3 次）
 *
 * 消费流程：
 * 1. 标记为处理中（PROCESSING）
 * 2. 调用向量化服务
 * 3. 标记为完成（COMPLETED）或失败（FAILED）
 */
@Slf4j
@Component
public class VectorizeStreamConsumer extends AbstractStreamConsumer<VectorizeStreamConsumer.VectorizePayload> {

    private final KnowledgeBaseVectorService vectorService;        // 向量化服务，负责文档分块和向量化
    private final KnowledgeBaseRepository knowledgeBaseRepository; // 知识库仓库，更新向量化状态

    /**
     * 构造函数
     *
     * @param redisService           Redis 服务，用于操作 Stream
     * @param vectorService          向量化服务
     * @param knowledgeBaseRepository 知识库仓库
     */
    public VectorizeStreamConsumer(
        RedisService redisService,
        KnowledgeBaseVectorService vectorService,
        KnowledgeBaseRepository knowledgeBaseRepository
    ) {
        super(redisService);
        this.vectorService = vectorService;
        this.knowledgeBaseRepository = knowledgeBaseRepository;
    }

    // 任务载荷，包含知识库ID和内容
    record VectorizePayload(Long kbId, String content) {}

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
     * 获取消费者组名称
     */
    @Override
    protected String groupName() {
        return AsyncTaskStreamConstants.KB_VECTORIZE_GROUP_NAME;
    }

    /**
     * 获取消费者前缀（用于生成消费者名称）
     */
    @Override
    protected String consumerPrefix() {
        return AsyncTaskStreamConstants.KB_VECTORIZE_CONSUMER_PREFIX;
    }

    /**
     * 获取线程名称（用于日志和调试）
     */
    @Override
    protected String threadName() {
        return "vectorize-consumer";
    }

    /**
     * 解析消息内容
     *
     * 从 Redis Stream 消息中提取知识库ID和内容
     *
     * @param messageId 消息ID
     * @param data      消息字段 Map
     * @return 解析后的载荷，如果格式错误返回 null
     */
    @Override
    protected VectorizePayload parsePayload(StreamMessageId messageId, Map<String, String> data) {
        String kbIdStr = data.get(AsyncTaskStreamConstants.FIELD_KB_ID);
        String content = data.get(AsyncTaskStreamConstants.FIELD_CONTENT);
        if (kbIdStr == null || content == null) {
            log.warn("消息格式错误，跳过: messageId={}", messageId);
            return null;
        }
        return new VectorizePayload(Long.parseLong(kbIdStr), content);
    }

    /**
     * 获取任务标识符（用于日志和去重）
     */
    @Override
    protected String payloadIdentifier(VectorizePayload payload) {
        return "kbId=" + payload.kbId();
    }

    /**
     * 标记为处理中
     *
     * @param payload 任务载荷
     */
    @Override
    protected void markProcessing(VectorizePayload payload) {
        updateVectorStatus(payload.kbId(), VectorStatus.PROCESSING, null);
    }

    /**
     * 执行业务逻辑（调用向量化服务）
     *
     * @param payload 任务载荷
     */
    @Override
    protected void processBusiness(VectorizePayload payload) {
        vectorService.vectorizeAndStore(payload.kbId(), payload.content());
    }

    /**
     * 标记为完成
     *
     * @param payload 任务载荷
     */
    @Override
    protected void markCompleted(VectorizePayload payload) {
        updateVectorStatus(payload.kbId(), VectorStatus.COMPLETED, null);
    }

    /**
     * 标记为失败
     *
     * @param payload 任务载荷
     * @param error   错误信息
     */
    @Override
    protected void markFailed(VectorizePayload payload, String error) {
        updateVectorStatus(payload.kbId(), VectorStatus.FAILED, error);
    }

    /**
     * 重试消息
     *
     * 将消息重新发送到 Stream，增加重试次数
     * 最多重试 3 次（由 AbstractStreamConsumer 控制）
     *
     * @param payload     任务载荷
     * @param retryCount  当前重试次数
     */
    @Override
    protected void retryMessage(VectorizePayload payload, int retryCount) {
        Long kbId = payload.kbId();
        String content = payload.content();
        try {
            // 构建重试消息
            Map<String, String> message = Map.of(
                AsyncTaskStreamConstants.FIELD_KB_ID, kbId.toString(),
                AsyncTaskStreamConstants.FIELD_CONTENT, content,
                AsyncTaskStreamConstants.FIELD_RETRY_COUNT, String.valueOf(retryCount)
            );

            // 重新发送到 Stream
            redisService().streamAdd(
                AsyncTaskStreamConstants.KB_VECTORIZE_STREAM_KEY,
                message,
                AsyncTaskStreamConstants.STREAM_MAX_LEN
            );
            log.info("向量化任务已重新入队: kbId={}, retryCount={}", kbId, retryCount);

        } catch (Exception e) {
            log.error("重试入队失败: kbId={}, error={}", kbId, e.getMessage(), e);
            updateVectorStatus(kbId, VectorStatus.FAILED, truncateError("重试入队失败: " + e.getMessage()));
        }
    }

    /**
     * 更新向量化状态
     *
     * @param kbId   知识库ID
     * @param status 新状态
     * @param error  错误信息（如果失败）
     */
    private void updateVectorStatus(Long kbId, VectorStatus status, String error) {
        try {
            knowledgeBaseRepository.findById(kbId).ifPresent(kb -> {
                kb.setVectorStatus(status);
                kb.setVectorError(error);
                knowledgeBaseRepository.save(kb);
                log.debug("向量化状态已更新: kbId={}, status={}", kbId, status);
            });
        } catch (Exception e) {
            log.error("更新向量化状态失败: kbId={}, status={}, error={}", kbId, status, e.getMessage(), e);
        }
    }

}
