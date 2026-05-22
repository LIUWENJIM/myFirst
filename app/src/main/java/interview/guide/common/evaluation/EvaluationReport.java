package interview.guide.common.evaluation;

import java.util.List;

/**
 * 通用面试评估报告（文字面试和语音面试共用）
 *
 * 由 UnifiedEvaluationService 生成，包含面试的完整评估结果。
 * 被 InterviewSessionService（文字面试）和 VoiceInterviewWebSocketHandler（语音面试）使用。
 *
 * 包含内容：
 * - 总体评分和反馈
 * - 按类别的平均分
 * - 逐题评估（评分、反馈、用户回答）
 * - 优势和改进建议
 * - 参考答案（每道题的标准答案和关键点）
 */
public record EvaluationReport(
    String sessionId,
    int totalQuestions,
    int overallScore,
    List<CategoryScore> categoryScores,
    List<QuestionEvaluation> questionDetails,
    String overallFeedback,
    List<String> strengths,
    List<String> improvements,
    List<ReferenceAnswer> referenceAnswers
) {
    // 类别评分（如"Java基础"、"系统设计"等类别的平均分）
    public record CategoryScore(
        String category,     // 类别名称
        int score,           // 该类别的平均分
        int questionCount    // 该类别的题目数量
    ) {}

    // 单题评估结果
    public record QuestionEvaluation(
        int questionIndex,  // 题目序号（从 0 开始）
        String question,    // 题目内容
        String category,    // 题目类别
        String userAnswer,  // 用户回答
        int score,          // 评分（0-100）
        String feedback     // 评估反馈
    ) {}

    // 参考答案（标准答案 + 关键点）
    public record ReferenceAnswer(
        int questionIndex,          // 题目序号
        String question,            // 题目内容
        String referenceAnswer,     // 参考答案文本
        List<String> keyPoints      // 关键点列表
    ) {}
}
