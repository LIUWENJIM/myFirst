package interview.guide.common.evaluation;

import interview.guide.common.ai.StructuredOutputInvoker;
import interview.guide.common.evaluation.EvaluationReport.CategoryScore;
import interview.guide.common.evaluation.EvaluationReport.QuestionEvaluation;
import interview.guide.common.evaluation.EvaluationReport.ReferenceAnswer;
import interview.guide.common.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 统一面试评估服务
 *
 * 文字面试和语音面试共用的评估引擎，负责将用户的面试问答记录转化为结构化评估报告。
 * 被 InterviewSessionService（文字面试）和 VoiceInterviewWebSocketHandler（语音面试）调用。
 *
 * 核心评估流程（三阶段）：
 * 1. 分批评估（evaluateInBatches）：
 *    - 将 N 道题按 batchSize 分批，每批独立调用 LLM 评估
 *    - 每批输出：总分、总评、优势、改进、逐题评分和反馈
 *    - 使用 StructuredOutputInvoker 确保 LLM 输出可被解析为 Java 对象
 *    - 单批失败不影响其他批次，失败批次用 0 分兜底
 *
 * 2. 二次汇总（summarizeBatchResults）：
 *    - 将所有批次的评估结果汇总为一份完整报告
 *    - 再次调用 LLM 生成全局性的总评、优势和改进
 *    - 如果汇总失败，降级为直接拼接各批次结果
 *
 * 3. 构建报告（buildReport）：
 *    - 合并逐题评估结果和参考答案
 *    - 按类别（category）计算平均分
 *    - 生成最终的 EvaluationReport
 *
 * 提示词模板：
 * - 系统提示词 + 用户提示词（分批评估阶段）
 * - 汇总系统提示词 + 汇总用户提示词（二次汇总阶段）
 * - 所有模板从 resources/prompts/ 加载，通过 InterviewEvaluationProperties 配置路径
 *
 * 降级策略：
 * - 单批评估失败 -> 该题 0 分兜底
 * - 二次汇总失败 -> 直接拼接各批次结果
 * - 超长简历截断到 3000 字符，超长参考基线截断到 6000 字符
 */
@Service
public class UnifiedEvaluationService {

    private static final Logger log = LoggerFactory.getLogger(UnifiedEvaluationService.class);
    private static final int MAX_REFERENCE_CONTEXT_CHARS = 6000;  // 参考基线最大字符数（超过截断）

    // 四套提示词模板 + 对应的 BeanOutputConverter
    private final PromptTemplate systemPromptTemplate;       // 分批评估系统提示词
    private final PromptTemplate userPromptTemplate;         // 分批评估用户提示词
    private final BeanOutputConverter<BatchReportDTO> outputConverter;  // 批次结果转换器（LLM 结构化输出）

    private final PromptTemplate summarySystemPromptTemplate;   // 二次汇总系统提示词
    private final PromptTemplate summaryUserPromptTemplate;     // 二次汇总用户提示词
    private final BeanOutputConverter<SummaryDTO> summaryOutputConverter;  // 汇总结果转换器

    private final StructuredOutputInvoker structuredOutputInvoker;  // 结构化输出调用器（带重试机制）
    private final int evaluationBatchSize;                          // 每批评估的题目数量（可配置）
    private final ResourceLoader resourceLoader;                    // 资源加载器（用于读取提示词模板文件）

    // 批次评估结果 DTO（LLM 结构化输出的目标类型）
    private record BatchReportDTO(
        int overallScore,
        String overallFeedback,
        List<String> strengths,
        List<String> improvements,
        List<QuestionEvalDTO> questionEvaluations
    ) {}

    // 单题评估结果 DTO
    private record QuestionEvalDTO(
        int questionIndex,
        int score,
        String feedback,
        String referenceAnswer,
        List<String> keyPoints
    ) {}

    // 批次执行结果（包含批次范围和评估报告）
    private record BatchResult(
        int startIndex,
        int endIndex,
        BatchReportDTO report
    ) {}

    // 二次汇总结果 DTO（LLM 结构化输出的目标类型）
    private record SummaryDTO(
        String overallFeedback,
        List<String> strengths,
        List<String> improvements
    ) {}

    /**
     * 构造函数，加载提示词模板和初始化转换器
     *
     * @param structuredOutputInvoker 结构化输出调用器（带重试）
     * @param resourceLoader          资源加载器
     * @param evaluationProperties    评估配置属性（提示词路径、批次大小等）
     * @throws IOException 如果提示词模板文件加载失败
     */
    public UnifiedEvaluationService(
            StructuredOutputInvoker structuredOutputInvoker,
            ResourceLoader resourceLoader,
            InterviewEvaluationProperties evaluationProperties) throws IOException {
        this.structuredOutputInvoker = structuredOutputInvoker;
        this.resourceLoader = resourceLoader;
        this.systemPromptTemplate = new PromptTemplate(loadPrompt(evaluationProperties.getSystemPromptPath()));
        this.userPromptTemplate = new PromptTemplate(loadPrompt(evaluationProperties.getUserPromptPath()));
        this.outputConverter = new BeanOutputConverter<>(BatchReportDTO.class);
        this.summarySystemPromptTemplate = new PromptTemplate(loadPrompt(evaluationProperties.getSummarySystemPromptPath()));
        this.summaryUserPromptTemplate = new PromptTemplate(loadPrompt(evaluationProperties.getSummaryUserPromptPath()));
        this.summaryOutputConverter = new BeanOutputConverter<>(SummaryDTO.class);
        this.evaluationBatchSize = Math.max(1, evaluationProperties.getBatchSize());
    }

    /**
     * 评估面试问答（文字和语音通用）
     *
     * @param chatClient  LLM 客户端
     * @param sessionId   会话ID（用于日志）
     * @param qaRecords   问答记录列表
     * @param resumeText  简历摘要（可选，可为 null）
     * @return 评估报告
     */
    public EvaluationReport evaluate(ChatClient chatClient,
                                     String sessionId,
                                     List<QaRecord> qaRecords,
                                     String resumeText) {
        return evaluate(chatClient, sessionId, qaRecords, resumeText, null);
    }

    public EvaluationReport evaluate(ChatClient chatClient,
                                     String sessionId,
                                     List<QaRecord> qaRecords,
                                     String resumeText,
                                     String referenceContext) {
        log.info("开始评估面试: sessionId={}, 共{}题", sessionId, qaRecords.size());

        String resumeContext = resumeText != null ? resumeText : "";
        // 超长简历截断，保留前 3000 字符（约 1500~2000 tokens），避免极端情况下 token 消耗过大
        if (resumeContext.length() > 3000) {
            resumeContext = resumeContext.substring(0, 3000) + "\n...(简历内容过长，已截断)";
        }
        String referenceBaseline = referenceContext != null ? referenceContext.trim() : "";
        if (referenceBaseline.length() > MAX_REFERENCE_CONTEXT_CHARS) {
            referenceBaseline = referenceBaseline.substring(0, MAX_REFERENCE_CONTEXT_CHARS)
                + "\n...(参考基线过长，已截断)";
        }

        // 分批评估
        List<BatchResult> batchResults = evaluateInBatches(
            chatClient, sessionId, resumeContext, qaRecords, referenceBaseline
        );

        // 合并批次结果
        List<QuestionEvalDTO> mergedEvaluations = mergeQuestionEvaluations(batchResults);
        String fallbackFeedback = mergeOverallFeedback(batchResults);
        List<String> fallbackStrengths = mergeListItems(batchResults, true);
        List<String> fallbackImprovements = mergeListItems(batchResults, false);

        // 二次汇总
        SummaryDTO summary = summarizeBatchResults(
            chatClient, sessionId, resumeContext, referenceBaseline, qaRecords,
            mergedEvaluations, fallbackFeedback, fallbackStrengths, fallbackImprovements
        );

        return buildReport(sessionId, qaRecords, mergedEvaluations,
            summary.overallFeedback(), summary.strengths(), summary.improvements());
    }

    /**
     * 从 classpath 加载提示词模板文件
     *
     * @param path 模板路径（如 "prompts/evaluation_system.st"）
     * @return 模板内容字符串
     * @throws IOException 如果文件不存在或读取失败
     */
    private String loadPrompt(String path) throws IOException {
        Resource resource = resourceLoader.getResource(path);
        return resource.getContentAsString(StandardCharsets.UTF_8);
    }

    /**
     * 分批评估：将题目按 batchSize 分批，每批独立调用 LLM
     *
     * @param chatClient      LLM 客户端
     * @param sessionId       会话ID（用于日志）
     * @param resumeContext   简历摘要（可为空）
     * @param qaRecords       所有问答记录
     * @param referenceContext 参考基线（可为空）
     * @return 各批次的评估结果列表
     */
    private List<BatchResult> evaluateInBatches(ChatClient chatClient, String sessionId,
                                                 String resumeContext, List<QaRecord> qaRecords,
                                                 String referenceContext) {
        List<BatchResult> results = new ArrayList<>();
        for (int start = 0; start < qaRecords.size(); start += evaluationBatchSize) {
            int end = Math.min(start + evaluationBatchSize, qaRecords.size());
            List<QaRecord> batch = qaRecords.subList(start, end);
            BatchReportDTO report = evaluateBatch(chatClient, sessionId, resumeContext, referenceContext, batch);
            results.add(new BatchResult(start, end, report));
        }
        return results;
    }

    /**
     * 评估单个批次
     *
     * 流程：
     * 1. 构建问答记录文本
     * 2. 渲染系统提示词和用户提示词（填充变量）
     * 3. 调用 StructuredOutputInvoker 获取结构化结果
     * 4. 失败时返回 null（后续合并逻辑用 0 分兜底）
     *
     * @param chatClient      LLM 客户端
     * @param sessionId       会话ID
     * @param resumeContext   简历摘要
     * @param referenceContext 参考基线
     * @param batch           当前批次的问答记录
     * @return 批次评估结果，失败返回 null
     */
    private BatchReportDTO evaluateBatch(ChatClient chatClient, String sessionId,
                                          String resumeContext, String referenceContext,
                                          List<QaRecord> batch) {
        String qaRecords = buildQARecords(batch);
        String systemPrompt = systemPromptTemplate.render();

        Map<String, Object> variables = new HashMap<>();
        variables.put("resumeText", resumeContext);
        variables.put("qaRecords", qaRecords);
        variables.put("referenceContext",
            (referenceContext != null && !referenceContext.isBlank()) ? referenceContext : "无");
        String userPrompt = userPromptTemplate.render(variables);

        String systemPromptWithFormat = systemPrompt + "\n\n" + outputConverter.getFormat();
        try {
            return structuredOutputInvoker.invoke(
                chatClient, systemPromptWithFormat, userPrompt, outputConverter,
                ErrorCode.INTERVIEW_EVALUATION_FAILED, "批次评估失败：", "批次评估", log
            );
        } catch (Exception e) {
            log.error("批次评估失败: sessionId={}, batchSize={}, error={}",
                sessionId, batch.size(), e.getMessage(), e);
            // 返回空报告，让合并逻辑用零分兜底
            return null;
        }
    }

    /**
     * 构建问答记录文本（用于填充提示词模板中的 qaRecords 变量）
     *
     * 格式：问题1 [类别]: 问题内容\n回答: 回答内容\n\n
     *
     * @param batch 当前批次的问答记录
     * @return 格式化的问答记录文本
     */
    private String buildQARecords(List<QaRecord> batch) {
        StringBuilder sb = new StringBuilder();
        for (QaRecord q : batch) {
            sb.append(String.format("问题%d [%s]: %s\n",
                q.questionIndex() + 1, q.category(), q.question()));
            sb.append(String.format("回答: %s\n\n",
                q.userAnswer() != null ? q.userAnswer() : "(未回答)"));
        }
        return sb.toString();
    }

    /**
     * 合并各批次的逐题评估结果
     *
     * 按题目顺序依次合并，如果某题评估失败（LLM 未返回结果），用 0 分兜底。
     *
     * @param batchResults 各批次的评估结果
     * @return 合并后的逐题评估列表
     */
    private List<QuestionEvalDTO> mergeQuestionEvaluations(List<BatchResult> batchResults) {
        List<QuestionEvalDTO> merged = new ArrayList<>();
        for (BatchResult result : batchResults) {
            int expectedSize = result.endIndex() - result.startIndex();
            List<QuestionEvalDTO> current =
                result.report() != null && result.report().questionEvaluations() != null
                    ? result.report().questionEvaluations()
                    : List.of();
            for (int i = 0; i < expectedSize; i++) {
                if (i < current.size() && current.get(i) != null) {
                    merged.add(current.get(i));
                } else {
                    merged.add(new QuestionEvalDTO(
                        result.startIndex() + i, 0,
                        "该题未成功生成评估结果，系统按 0 分处理。", "", List.of()
                    ));
                }
            }
        }
        return merged;
    }

    /**
     * 合并各批次的总体反馈（拼接各批次的 overallFeedback）
     *
     * @param batchResults 各批次的评估结果
     * @return 合并后的总体反馈
     */
    private String mergeOverallFeedback(List<BatchResult> batchResults) {
        String feedback = batchResults.stream()
            .map(BatchResult::report)
            .filter(r -> r != null && r.overallFeedback() != null && !r.overallFeedback().isBlank())
            .map(BatchReportDTO::overallFeedback)
            .collect(Collectors.joining("\n\n"));
        return feedback.isBlank() ? "本次面试已完成分批评估，但未生成有效综合评语。" : feedback;
    }

    /**
     * 合并各批次的优势或改进建议（去重，最多保留 8 条）
     *
     * @param batchResults  各批次的评估结果
     * @param strengthsMode true=合并优势，false=合并改进建议
     * @return 去重后的列表
     */
    private List<String> mergeListItems(List<BatchResult> batchResults, boolean strengthsMode) {
        Set<String> merged = new LinkedHashSet<>();
        for (BatchResult result : batchResults) {
            BatchReportDTO report = result.report();
            if (report == null) continue;
            List<String> items = strengthsMode ? report.strengths() : report.improvements();
            if (items == null) continue;
            items.stream()
                .filter(item -> item != null && !item.isBlank())
                .map(String::trim)
                .forEach(merged::add);
        }
        return merged.stream().limit(8).toList();
    }

    /**
     * 二次汇总：将各批次结果汇总为全局评估报告
     *
     * 流程：
     * 1. 渲染汇总提示词（填充类别摘要、逐题亮点等变量）
     * 2. 调用 LLM 生成全局总评、优势和改进
     * 3. 如果 LLM 返回结果为空，降级为批次拼接结果
     * 4. 如果 LLM 调用完全失败，降级为批次聚合结果
     *
     * @param chatClient         LLM 客户端
     * @param sessionId          会话ID
     * @param resumeContext      简历摘要
     * @param referenceContext   参考基线
     * @param qaRecords          所有问答记录
     * @param evaluations        合并后的逐题评估
     * @param fallbackFeedback   兜底总体反馈（批次拼接）
     * @param fallbackStrengths  兜底优势列表
     * @param fallbackImprovements 兜底改进列表
     * @return 汇总结果（含总评、优势、改进）
     */
    private SummaryDTO summarizeBatchResults(
            ChatClient chatClient, String sessionId, String resumeContext, String referenceContext,
            List<QaRecord> qaRecords, List<QuestionEvalDTO> evaluations,
            String fallbackFeedback, List<String> fallbackStrengths, List<String> fallbackImprovements) {
        try {
            String summarySystem = summarySystemPromptTemplate.render();
            Map<String, Object> vars = new HashMap<>();
            vars.put("resumeText", resumeContext);
            vars.put("referenceContext",
                (referenceContext != null && !referenceContext.isBlank()) ? referenceContext : "无");
            vars.put("categorySummary", buildCategorySummary(qaRecords, evaluations));
            vars.put("questionHighlights", buildQuestionHighlights(qaRecords, evaluations));
            vars.put("fallbackOverallFeedback", fallbackFeedback);
            vars.put("fallbackStrengths", String.join("\n", fallbackStrengths));
            vars.put("fallbackImprovements", String.join("\n", fallbackImprovements));
            String summaryUser = summaryUserPromptTemplate.render(vars);

            String systemWithFormat = summarySystem + "\n\n" + summaryOutputConverter.getFormat();
            SummaryDTO dto = structuredOutputInvoker.invoke(
                chatClient, systemWithFormat, summaryUser, summaryOutputConverter,
                ErrorCode.INTERVIEW_EVALUATION_FAILED, "总结评估失败：", "总结评估", log
            );

            String feedback = dto != null && dto.overallFeedback() != null && !dto.overallFeedback().isBlank()
                ? dto.overallFeedback() : fallbackFeedback;
            List<String> strengths = sanitizeItems(dto != null ? dto.strengths() : null, fallbackStrengths);
            List<String> improvements = sanitizeItems(dto != null ? dto.improvements() : null, fallbackImprovements);
            return new SummaryDTO(feedback, strengths, improvements);
        } catch (Exception e) {
            log.warn("二次汇总评估失败，降级到批次聚合结果: sessionId={}, error={}", sessionId, e.getMessage());
            return new SummaryDTO(fallbackFeedback, fallbackStrengths, fallbackImprovements);
        }
    }

    /**
     * 清洗列表数据：去空、去重、截断
     *
     * @param primary  主要数据（LLM 返回）
     * @param fallback 兜底数据（批次拼接）
     * @return 清洗后的列表（最多 8 条）
     */
    private List<String> sanitizeItems(List<String> primary, List<String> fallback) {
        List<String> source = (primary != null && !primary.isEmpty()) ? primary : fallback;
        if (source == null || source.isEmpty()) return List.of();
        return source.stream()
            .filter(item -> item != null && !item.isBlank())
            .map(String::trim).distinct().limit(8).toList();
    }

    /**
     * 构建最终评估报告
     *
     * 1. 遍历所有题目，构建逐题评估和参考答案
     * 2. 按类别（category）计算平均分
     * 3. 计算总体平均分
     * 4. 组装 EvaluationReport 返回
     *
     * @param sessionId        会话ID
     * @param qaRecords        所有问答记录
     * @param evaluations      合并后的逐题评估
     * @param overallFeedback  总体反馈
     * @param strengths        优势列表
     * @param improvements     改进列表
     * @return 完整的评估报告
     */
    private EvaluationReport buildReport(String sessionId, List<QaRecord> qaRecords,
                                          List<QuestionEvalDTO> evaluations,
                                          String overallFeedback,
                                          List<String> strengths, List<String> improvements) {
        List<QuestionEvaluation> questionDetails = new ArrayList<>();
        List<ReferenceAnswer> referenceAnswers = new ArrayList<>();
        Map<String, List<Integer>> categoryScoresMap = new HashMap<>();

        long answeredCount = qaRecords.stream()
            .filter(q -> q.userAnswer() != null && !q.userAnswer().isBlank())
            .count();

        int evalSize = evaluations != null ? evaluations.size() : 0;

        for (int i = 0; i < qaRecords.size(); i++) {
            QaRecord q = qaRecords.get(i);
            QuestionEvalDTO eval = i < evalSize ? evaluations.get(i) : null;

            boolean hasAnswer = q.userAnswer() != null && !q.userAnswer().isBlank();
            int score = hasAnswer && eval != null ? eval.score() : 0;
            String feedback = eval != null && eval.feedback() != null
                ? eval.feedback() : "该题未成功生成评估反馈。";
            String refAnswer = eval != null && eval.referenceAnswer() != null
                ? eval.referenceAnswer() : "";
            List<String> keyPoints = eval != null && eval.keyPoints() != null
                ? eval.keyPoints() : List.of();

            questionDetails.add(new QuestionEvaluation(
                q.questionIndex(), q.question(), q.category(), q.userAnswer(), score, feedback
            ));
            referenceAnswers.add(new ReferenceAnswer(
                q.questionIndex(), q.question(), refAnswer, keyPoints
            ));
            categoryScoresMap.computeIfAbsent(q.category(), k -> new ArrayList<>()).add(score);
        }

        List<CategoryScore> categoryScores = categoryScoresMap.entrySet().stream()
            .map(e -> new CategoryScore(
                e.getKey(),
                (int) e.getValue().stream().mapToInt(Integer::intValue).average().orElse(0),
                e.getValue().size()
            ))
            .collect(Collectors.toList());

        int overallScore = answeredCount == 0 ? 0
            : (int) questionDetails.stream().mapToInt(QuestionEvaluation::score).average().orElse(0);

        return new EvaluationReport(
            sessionId, qaRecords.size(), overallScore, categoryScores, questionDetails,
            overallFeedback,
            strengths != null ? strengths : List.of(),
            improvements != null ? improvements : List.of(),
            referenceAnswers
        );
    }

    /**
     * 构建类别摘要（用于二次汇总提示词）
     * 格式："- 类别名: 平均分 XX, 题数 XX"
     *
     * @param qaRecords   所有问答记录
     * @param evaluations 逐题评估结果
     * @return 类别摘要文本
     */
    private String buildCategorySummary(List<QaRecord> qaRecords, List<QuestionEvalDTO> evaluations) {
        Map<String, List<Integer>> categoryScores = new HashMap<>();
        for (int i = 0; i < qaRecords.size(); i++) {
            QaRecord q = qaRecords.get(i);
            QuestionEvalDTO eval = i < evaluations.size() ? evaluations.get(i) : null;
            int score = 0;
            if (eval != null && q.userAnswer() != null && !q.userAnswer().isBlank()) {
                score = eval.score();
            }
            categoryScores.computeIfAbsent(q.category(), k -> new ArrayList<>()).add(score);
        }
        return categoryScores.entrySet().stream()
            .map(entry -> {
                int avg = (int) entry.getValue().stream().mapToInt(Integer::intValue).average().orElse(0);
                return String.format("- %s: 平均分 %d, 题数 %d", entry.getKey(), avg, entry.getValue().size());
            })
            .sorted()
            .collect(Collectors.joining("\n"));
    }

    /**
     * 构建逐题亮点（用于二次汇总提示词）
     * 格式："- Q1 | 问题摘要 | 分数:XX | 反馈:反馈摘要"
     * 最多输出 20 题
     *
     * @param qaRecords   所有问答记录
     * @param evaluations 逐题评估结果
     * @return 逐题亮点文本
     */
    private String buildQuestionHighlights(List<QaRecord> qaRecords, List<QuestionEvalDTO> evaluations) {
        List<String> highlights = new ArrayList<>();
        for (int i = 0; i < qaRecords.size(); i++) {
            QaRecord q = qaRecords.get(i);
            QuestionEvalDTO eval = i < evaluations.size() ? evaluations.get(i) : null;
            int score = eval != null ? eval.score() : 0;
            String feedback = eval != null && eval.feedback() != null ? eval.feedback() : "";
            String shortQ = q.question().length() > 50 ? q.question().substring(0, 50) + "..." : q.question();
            String shortF = feedback.length() > 80 ? feedback.substring(0, 80) + "..." : feedback;
            highlights.add(String.format("- Q%d | %s | 分数:%d | 反馈:%s", q.questionIndex() + 1, shortQ, score, shortF));
        }
        return highlights.stream().limit(20).collect(Collectors.joining("\n"));
    }
}
