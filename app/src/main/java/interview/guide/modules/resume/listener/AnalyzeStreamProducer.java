package interview.guide.modules.resume.listener;

import interview.guide.common.async.AbstractStreamProducer;
import interview.guide.common.constant.AsyncTaskStreamConstants;
import interview.guide.common.model.AsyncTaskStatus;
import interview.guide.infrastructure.redis.RedisService;
import interview.guide.modules.resume.repository.ResumeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 简历分析任务生产者
 * 负责发送分析任务到 Redis Stream
 *
 * 生产者职责：
 * 1. 将简历分析任务封装成消息
 * 2. 发送到 Redis Stream（异步队列）
 * 3. 处理发送失败的情况（更新状态为 FAILED）
 *
 * 消息格式：
 * - resumeId: 简历ID
 * - content: 简历文本内容
 * - retryCount: 重试次数（初始为 0）
 */
@Slf4j
@Component
public class AnalyzeStreamProducer extends AbstractStreamProducer<AnalyzeStreamProducer.AnalyzeTaskPayload> {

    private final ResumeRepository resumeRepository;  // 简历仓库，用于更新分析状态

    // 任务载荷，包含简历ID和内容
    record AnalyzeTaskPayload(Long resumeId, String content) {}

    /**
     * 构造函数
     *
     * @param redisService    Redis 服务，用于操作 Stream
     * @param resumeRepository 简历仓库
     */
    public AnalyzeStreamProducer(RedisService redisService, ResumeRepository resumeRepository) {
        super(redisService);
        this.resumeRepository = resumeRepository;
    }

    /**
     * 发送分析任务到 Redis Stream
     *
     * @param resumeId 简历ID
     * @param content  简历文本内容
     */
    public void sendAnalyzeTask(Long resumeId, String content) {
        sendTask(new AnalyzeTaskPayload(resumeId, content));
    }

    /**
     * 获取任务显示名称（用于日志）
     */
    @Override
    protected String taskDisplayName() {
        return "分析";
    }

    /**
     * 获取 Redis Stream 的 Key
     */
    @Override
    protected String streamKey() {
        return AsyncTaskStreamConstants.RESUME_ANALYZE_STREAM_KEY;
    }

    /**
     * 构建消息内容（发送到 Stream 的字段）
     *
     * @param payload 任务载荷
     * @return 消息字段 Map
     */
    @Override
    protected Map<String, String> buildMessage(AnalyzeTaskPayload payload) {
        return Map.of(
            AsyncTaskStreamConstants.FIELD_RESUME_ID, payload.resumeId().toString(),
            AsyncTaskStreamConstants.FIELD_CONTENT, payload.content(),
            AsyncTaskStreamConstants.FIELD_RETRY_COUNT, "0"
        );
    }

    /**
     * 获取任务标识符（用于日志和去重）
     */
    @Override
    protected String payloadIdentifier(AnalyzeTaskPayload payload) {
        return "resumeId=" + payload.resumeId();
    }

    /**
     * 发送失败时的回调
     *
     * @param payload 任务载荷
     * @param error   错误信息
     */
    @Override
    protected void onSendFailed(AnalyzeTaskPayload payload, String error) {
        updateAnalyzeStatus(payload.resumeId(), AsyncTaskStatus.FAILED, truncateError(error));
    }

    /**
     * 更新分析状态
     *
     * @param resumeId 简历ID
     * @param status   新状态
     * @param error    错误信息（如果失败）
     */
    private void updateAnalyzeStatus(Long resumeId, AsyncTaskStatus status, String error) {
        resumeRepository.findById(resumeId).ifPresent(resume -> {
            resume.setAnalyzeStatus(status);
            if (error != null) {
                // 截断错误信息（最多 500 字符）
                resume.setAnalyzeError(error.length() > 500 ? error.substring(0, 500) : error);
            }
            resumeRepository.save(resume);
        });
    }
}
