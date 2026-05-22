package interview.guide.common.evaluation;

/**
 * 通用面试问答记录（文字面试和语音面试共用）
 *
 * 作为 UnifiedEvaluationService.evaluate() 的输入参数，
 * 封装单道题目的问答信息。
 *
 * 使用场景：
 * - 文字面试：从 InterviewQuestionEntity 构建
 * - 语音面试：从语音识别结果构建
 */
public record QaRecord(
    int questionIndex,
    String question,
    String category,
    String userAnswer   // null 表示未回答
) {}
