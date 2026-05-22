package interview.guide.modules.resume.listener;

import interview.guide.common.async.AbstractStreamConsumer;
import interview.guide.common.constant.AsyncTaskStreamConstants;
import interview.guide.common.model.AsyncTaskStatus;
import interview.guide.infrastructure.redis.RedisService;
import interview.guide.modules.interview.model.ResumeAnalysisResponse;
import interview.guide.modules.resume.model.ResumeEntity;
import interview.guide.modules.resume.repository.ResumeRepository;
import interview.guide.modules.resume.service.ResumeGradingService;
import interview.guide.modules.resume.service.ResumePersistenceService;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.stream.StreamMessageId;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 简历分析 Stream 消费者
 * 负责从 Redis Stream 消费消息并执行 AI 分析
 *
 * 消费者职责：
 * 1. 从 Redis Stream 消费分析任务消息
 * 2. 解析消息内容（简历ID和文本）
 * 3. 调用 AI 服务进行简历分析
 * 4. 保存分析结果到数据库
 * 5. 更新分析状态（PROCESSING -> COMPLETED/FAILED）
 * 6. 处理重试逻辑（最多重试 3 次）
 *
 * 消费流程：
 * 1. 标记为处理中（PROCESSING）
 * 2. 检查简历是否仍然存在
 * 3. 调用 AI 分析服务
 * 4. 保存分析结果
 * 5. 标记为完成（COMPLETED）或失败（FAILED）
 */
@Slf4j
@Component
public class AnalyzeStreamConsumer extends AbstractStreamConsumer<AnalyzeStreamConsumer.AnalyzePayload> {

    private final ResumeGradingService gradingService;        // 简历评分服务，调用 AI 进行分析
    private final ResumePersistenceService persistenceService; // 持久化服务，保存分析结果
    private final ResumeRepository resumeRepository;          // 简历仓库，更新分析状态

    /**
     * 构造函数
     *
     * @param redisService       Redis 服务，用于操作 Stream
     * @param gradingService     简历评分服务
     * @param persistenceService 持久化服务
     * @param resumeRepository   简历仓库
     */
    public AnalyzeStreamConsumer(
        RedisService redisService,
        ResumeGradingService gradingService,
        ResumePersistenceService persistenceService,
        ResumeRepository resumeRepository
    ) {
        super(redisService);
        this.gradingService = gradingService;
        this.persistenceService = persistenceService;
        this.resumeRepository = resumeRepository;
    }

    // 任务载荷，包含简历ID和内容
    record AnalyzePayload(Long resumeId, String content) {}

    /**
     * 获取任务显示名称（用于日志）
     */
    @Override
    protected String taskDisplayName() {
        return "简历分析";
    }

    /**
     * 获取 Redis Stream 的 Key
     */
    @Override
    protected String streamKey() {
        return AsyncTaskStreamConstants.RESUME_ANALYZE_STREAM_KEY;
    }

    /**
     * 获取消费者组名称
     */
    @Override
    protected String groupName() {
        return AsyncTaskStreamConstants.RESUME_ANALYZE_GROUP_NAME;
    }

    /**
     * 获取消费者前缀（用于生成消费者名称）
     */
    @Override
    protected String consumerPrefix() {
        return AsyncTaskStreamConstants.RESUME_ANALYZE_CONSUMER_PREFIX;
    }

    /**
     * 获取线程名称（用于日志和调试）
     */
    @Override
    protected String threadName() {
        return "analyze-consumer";
    }

    /**
     * 解析消息内容
     *
     * 从 Redis Stream 消息中提取简历ID和内容
     *
     * @param messageId 消息ID
     * @param data      消息字段 Map
     * @return 解析后的载荷，如果格式错误返回 null
     */
    @Override
    protected AnalyzePayload parsePayload(StreamMessageId messageId, Map<String, String> data) {
        String resumeIdStr = data.get(AsyncTaskStreamConstants.FIELD_RESUME_ID);
        String content = data.get(AsyncTaskStreamConstants.FIELD_CONTENT);
        if (resumeIdStr == null || content == null) {
            log.warn("消息格式错误，跳过: messageId={}", messageId);
            return null;
        }
        return new AnalyzePayload(Long.parseLong(resumeIdStr), content);
    }

    /**
     * 获取任务标识符（用于日志和去重）
     */
    @Override
    protected String payloadIdentifier(AnalyzePayload payload) {
        return "resumeId=" + payload.resumeId();
    }

    /**
     * 标记为处理中
     *
     * @param payload 任务载荷
     */
    @Override
    protected void markProcessing(AnalyzePayload payload) {
        updateAnalyzeStatus(payload.resumeId(), AsyncTaskStatus.PROCESSING, null);
    }

    /**
     * 执行业务逻辑（调用 AI 分析简历）
     *
     * 流程：
     * 1. 检查简历是否仍然存在
     * 2. 调用 AI 服务进行分析
     * 3. 保存分析结果到数据库
     *
     * @param payload 任务载荷
     */
    @Override
    protected void processBusiness(AnalyzePayload payload) {
        Long resumeId = payload.resumeId();

        // 检查简历是否仍然存在（可能在分析期间被删除）
        if (!resumeRepository.existsById(resumeId)) {
            log.warn("简历已被删除，跳过分析任务: resumeId={}", resumeId);
            return;
        }

        // 调用 AI 服务进行简历分析
        ResumeAnalysisResponse analysis = gradingService.analyzeResume(payload.content());

        // 再次检查简历是否仍然存在（分析期间可能被删除）
        ResumeEntity resume = resumeRepository.findById(resumeId).orElse(null);
        if (resume == null) {
            log.warn("简历在分析期间被删除，跳过保存结果: resumeId={}", resumeId);
            return;
        }

        // 保存分析结果到数据库
        persistenceService.saveAnalysis(resume, analysis);
    }

    /**
     * 标记为完成
     *
     * @param payload 任务载荷
     */
    @Override
    protected void markCompleted(AnalyzePayload payload) {
        updateAnalyzeStatus(payload.resumeId(), AsyncTaskStatus.COMPLETED, null);
    }

    /**
     * 标记为失败
     *
     * @param payload 任务载荷
     * @param error   错误信息
     */
    @Override
    protected void markFailed(AnalyzePayload payload, String error) {
        updateAnalyzeStatus(payload.resumeId(), AsyncTaskStatus.FAILED, error);
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
    protected void retryMessage(AnalyzePayload payload, int retryCount) {
        Long resumeId = payload.resumeId();
        String content = payload.content();
        try {
            // 构建重试消息
            Map<String, String> message = Map.of(
                AsyncTaskStreamConstants.FIELD_RESUME_ID, resumeId.toString(),
                AsyncTaskStreamConstants.FIELD_CONTENT, content,
                AsyncTaskStreamConstants.FIELD_RETRY_COUNT, String.valueOf(retryCount)
            );

            // 重新发送到 Stream
            redisService().streamAdd(
                AsyncTaskStreamConstants.RESUME_ANALYZE_STREAM_KEY,
                message,
                AsyncTaskStreamConstants.STREAM_MAX_LEN
            );
            log.info("简历分析任务已重新入队: resumeId={}, retryCount={}", resumeId, retryCount);

        } catch (Exception e) {
            log.error("重试入队失败: resumeId={}, error={}", resumeId, e.getMessage(), e);
            updateAnalyzeStatus(resumeId, AsyncTaskStatus.FAILED, truncateError("重试入队失败: " + e.getMessage()));
        }
    }

    /**
     * 更新分析状态
     *
     * @param resumeId 简历ID
     * @param status   新状态
     * @param error    错误信息（如果失败）
     */
    private void updateAnalyzeStatus(Long resumeId, AsyncTaskStatus status, String error) {
        try {
            resumeRepository.findById(resumeId).ifPresent(resume -> {
                resume.setAnalyzeStatus(status);
                resume.setAnalyzeError(error);
                resumeRepository.save(resume);
                log.debug("分析状态已更新: resumeId={}, status={}", resumeId, status);
            });
        } catch (Exception e) {
            log.error("更新分析状态失败: resumeId={}, status={}, error={}", resumeId, status, e.getMessage(), e);
        }
    }

}
