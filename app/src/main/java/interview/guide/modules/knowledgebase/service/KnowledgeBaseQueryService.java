package interview.guide.modules.knowledgebase.service;

import interview.guide.common.ai.LlmProviderRegistry;
import interview.guide.common.ai.PromptSecurityConstants;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.knowledgebase.model.QueryRequest;
import interview.guide.modules.knowledgebase.model.QueryResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.document.Document;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 知识库查询服务 - 基于向量搜索的 RAG 问答
 *
 * <h3>核心流程</h3>
 * <pre>
 * 用户提问
 *   ↓
 * 查询改写（可选）→ 优化用户问题，使其更适合向量检索
 *   ↓
 * 向量检索 → 从 pgvector 中找到最相关的文档片段
 *   ↓
 * 构建 Prompt → 将检索到的文档作为上下文，拼接系统提示词
 *   ↓
 * LLM 调用 → 同步返回 或 SSE 流式返回
 * </pre>
 *
 * <h3>关键优化</h3>
 * <ul>
 *   <li><b>探测窗口（120字符）</b>：流式输出时先缓冲前 120 字符，快速识别 LLM 的拒答模板，
 *       避免输出长篇无意义内容；确认有效后立即释放缓冲，保持打字机效果</li>
 *   <li><b>动态检索参数</b>：根据问题长度自动调整 topK 和相似度阈值，
 *       短问题用更严格的阈值，长问题用更宽松的阈值</li>
 *   <li><b>查询改写</b>：利用 LLM 对用户问题进行改写，提升向量检索的召回率</li>
 * </ul>
 */
@Slf4j
@Service
public class KnowledgeBaseQueryService {

    /** 当检索无结果时返回的固定提示 */
    private static final String NO_RESULT_RESPONSE = "抱歉，在选定的知识库中未检索到相关信息。请换一个更具体的关键词或补充上下文后再试。";

    /**
     * 流式探测窗口大小（字符数）
     * 流式输出时先累积前 120 字符，检查是否是 LLM 的拒答模板
     */
    private static final int STREAM_PROBE_CHARS = 120;

    /** 查询改写时，历史消息的最大字符数（避免 prompt 过长） */
    private static final int MAX_REWRITE_HISTORY_CHAR = 200;

    // ==================== 依赖注入 ====================

    /** LLM 提供商注册中心，用于获取 ChatClient */
    private final LlmProviderRegistry llmProviderRegistry;

    /** 向量存储服务，负责文档分块、向量化和相似度搜索 */
    private final KnowledgeBaseVectorService vectorService;

    /** 知识库列表服务，用于获取知识库名称等信息 */
    private final KnowledgeBaseListService listService;

    /** 知识库计数服务，用于更新问题计数 */
    private final KnowledgeBaseCountService countService;

    // ==================== Prompt 模板 ====================

    /** 系统提示词模板（定义 AI 的角色和行为规范） */
    private final PromptTemplate systemPromptTemplate;

    /** 用户提示词模板（包含检索上下文和用户问题） */
    private final PromptTemplate userPromptTemplate;

    /** 查询改写提示词模板（用于优化用户问题） */
    private final PromptTemplate rewritePromptTemplate;

    // ==================== 配置参数 ====================

    /** 是否启用查询改写功能 */
    private final boolean rewriteEnabled;

    /** 短问题的字符长度阈值（用于动态调整检索参数） */
    private final int shortQueryLength;

    /** 短问题的 topK（返回最相关的 K 个文档） */
    private final int topkShort;

    /** 中等问题的 topK */
    private final int topkMedium;

    /** 长问题的 topK */
    private final int topkLong;

    /** 短问题的最小相似度分数阈值（更严格） */
    private final double minScoreShort;

    /** 默认的最小相似度分数阈值 */
    private final double minScoreDefault;

    /**
     * 构造函数 - 通过配置文件初始化所有参数和 Prompt 模板
     *
     * @param llmProviderRegistry LLM 提供商注册中心
     * @param vectorService       向量存储服务
     * @param listService         知识库列表服务
     * @param countService        知识库计数服务
     * @param queryProperties     查询配置（包含 Prompt 路径、检索参数等）
     * @param resourceLoader      资源加载器（用于读取 Prompt 模板文件）
     */
    public KnowledgeBaseQueryService(
            LlmProviderRegistry llmProviderRegistry,
            KnowledgeBaseVectorService vectorService,
            KnowledgeBaseListService listService,
            KnowledgeBaseCountService countService,
            KnowledgeBaseQueryProperties queryProperties,
            ResourceLoader resourceLoader) throws IOException {
        this.llmProviderRegistry = llmProviderRegistry;
        this.vectorService = vectorService;
        this.listService = listService;
        this.countService = countService;

        // 从配置文件加载 Prompt 模板（.st 文件）
        this.systemPromptTemplate = new PromptTemplate(
            resourceLoader.getResource(queryProperties.getSystemPromptPath())
                .getContentAsString(StandardCharsets.UTF_8)
        );
        this.userPromptTemplate = new PromptTemplate(
            resourceLoader.getResource(queryProperties.getUserPromptPath())
                .getContentAsString(StandardCharsets.UTF_8)
        );
        this.rewritePromptTemplate = new PromptTemplate(
            resourceLoader.getResource(queryProperties.getRewritePromptPath())
                .getContentAsString(StandardCharsets.UTF_8)
        );

        // 加载检索参数配置
        this.rewriteEnabled = queryProperties.getRewrite().isEnabled();
        this.shortQueryLength = queryProperties.getSearch().getShortQueryLength();
        this.topkShort = queryProperties.getSearch().getTopkShort();
        this.topkMedium = queryProperties.getSearch().getTopkMedium();
        this.topkLong = queryProperties.getSearch().getTopkLong();
        this.minScoreShort = queryProperties.getSearch().getMinScoreShort();
        this.minScoreDefault = queryProperties.getSearch().getMinScoreDefault();
    }

    /**
     * 获取默认的 ChatClient（用于调用 LLM）
     */
    private ChatClient getChatClient() {
        return llmProviderRegistry.getDefaultChatClient();
    }

    // ==================== 同步问答接口 ====================

    /**
     * 基于单个知识库回答用户问题（同步版本）
     *
     * @param knowledgeBaseId 知识库ID
     * @param question        用户问题
     * @return AI 回答（纯文本）
     */
    public String answerQuestion(Long knowledgeBaseId, String question) {
        // 委托给多知识库版本处理
        return answerQuestion(List.of(knowledgeBaseId), question);
    }

    /**
     * 基于多个知识库回答用户问题（RAG 同步版本）
     *
     * <h4>处理流程</h4>
     * <ol>
     *   <li>参数校验 → 无效参数直接返回拒答模板</li>
     *   <li>更新问题计数 → 统计知识库被提问次数</li>
     *   <li>构建查询上下文 → 可能包含查询改写</li>
     *   <li>向量检索 → 找到最相关的文档片段</li>
     *   <li>构建 Prompt → 系统提示词 + 检索上下文 + 用户问题</li>
     *   <li>调用 LLM → 同步获取回答</li>
     * </ol>
     *
     * @param knowledgeBaseIds 知识库ID列表
     * @param question         用户问题
     * @return AI 回答（纯文本）
     */
    public String answerQuestion(List<Long> knowledgeBaseIds, String question) {
        log.info("收到知识库提问: kbIds={}, question={}", knowledgeBaseIds, question);

        // 1. 参数校验
        if (knowledgeBaseIds == null || knowledgeBaseIds.isEmpty() || normalizeQuestion(question).isBlank()) {
            return NO_RESULT_RESPONSE;
        }

        // 2. 更新问题计数
        countService.updateQuestionCounts(knowledgeBaseIds);

        // 3. 构建查询上下文（包含查询改写，但同步版本没有历史消息）
        QueryContext queryContext = buildQueryContext(question, List.of());

        // 4. 向量检索相关文档
        List<Document> relevantDocs = retrieveRelevantDocs(queryContext, knowledgeBaseIds);

        // 5. 如果没有检索到有效文档，返回拒答模板
        if (!hasEffectiveHit(relevantDocs)) {
            return NO_RESULT_RESPONSE;
        }

        // 6. 将检索到的文档拼接成上下文字符串
        String context = relevantDocs.stream()
                .map(Document::getText)
                .collect(Collectors.joining("\n\n---\n\n"));

        // 7. 构建 Prompt
        String systemPrompt = buildSystemPrompt();
        String userPrompt = buildUserPrompt(context, question);

        try {
            // 8. 调用 LLM（同步）
            String answer = getChatClient().prompt()
                    .system(systemPrompt)
                    .user(userPrompt)
                    .call()
                    .content();

            // 9. 标准化回答（处理空回答或拒答模板）
            answer = normalizeAnswer(answer);

            log.info("知识库问答完成: kbIds={}", knowledgeBaseIds);
            return answer;

        } catch (Exception e) {
            log.error("知识库问答失败: {}", e.getMessage(), e);
            throw new BusinessException(ErrorCode.KNOWLEDGE_BASE_QUERY_FAILED, "知识库查询失败：" + e.getMessage());
        }
    }

    /**
     * 构建系统提示词
     * 拼接基础系统 Prompt + 防注入安全指令
     */
    private String buildSystemPrompt() {
        return systemPromptTemplate.render()
            + PromptSecurityConstants.ANTI_INJECTION_INSTRUCTION;
    }

    /**
     * 构建用户提示词
     * 将检索到的上下文和用户问题填入模板
     *
     * @param context  检索到的文档上下文
     * @param question 用户问题
     * @return 渲染后的用户提示词
     */
    private String buildUserPrompt(String context, String question) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("context", context);
        variables.put("question", question);
        return userPromptTemplate.render(variables);
    }

    /**
     * 查询知识库并返回完整响应（包含知识库名称等元信息）
     *
     * @param request 查询请求（包含知识库ID列表和问题）
     * @return 查询响应（包含回答、主知识库ID、知识库名称）
     */
    public QueryResponse queryKnowledgeBase(QueryRequest request) {
        // 调用同步问答
        String answer = answerQuestion(request.knowledgeBaseIds(), request.question());

        // 获取知识库名称（多个知识库用顿号分隔）
        List<String> kbNames = listService.getKnowledgeBaseNames(request.knowledgeBaseIds());
        String kbNamesStr = String.join("、", kbNames);

        // 使用第一个知识库ID作为主要标识（兼容前端）
        Long primaryKbId = request.knowledgeBaseIds().getFirst();

        return new QueryResponse(answer, primaryKbId, kbNamesStr);
    }

    // ==================== 流式问答接口（SSE） ====================

    /**
     * 流式查询知识库（SSE，无历史上下文）
     *
     * @param knowledgeBaseIds 知识库ID列表
     * @param question         用户问题
     * @return 流式响应（Flux<String>，每个元素是一个文本片段）
     */
    public Flux<String> answerQuestionStream(List<Long> knowledgeBaseIds, String question) {
        return answerQuestionStream(knowledgeBaseIds, question, List.of());
    }

    /**
     * 流式查询知识库（SSE，支持多轮对话上下文）
     *
     * <h4>与同步版本的区别</h4>
     * <ul>
     *   <li>使用 SSE（Server-Sent Events）实现流式输出，用户体验更好</li>
     *   <li>支持多轮对话历史，可以进行追问</li>
     *   <li>包含探测窗口机制，快速过滤 LLM 的拒答模板</li>
     * </ul>
     *
     * @param knowledgeBaseIds 知识库ID列表
     * @param question         用户问题
     * @param history          历史对话消息（可选，用于多轮对话）
     * @return 流式响应
     */
    public Flux<String> answerQuestionStream(List<Long> knowledgeBaseIds, String question, List<Message> history) {
        log.info("收到知识库流式提问: kbIds={}, question={}, historySize={}", knowledgeBaseIds, question,
                history != null ? history.size() : 0);

        // 1. 参数校验
        if (knowledgeBaseIds == null || knowledgeBaseIds.isEmpty() || normalizeQuestion(question).isBlank()) {
            return Flux.just(NO_RESULT_RESPONSE);
        }

        try {
            // 2. 更新问题计数
            countService.updateQuestionCounts(knowledgeBaseIds);

            // 3. 清洗历史消息 + 构建查询上下文（包含查询改写）
            List<Message> effectiveHistory = sanitizeHistory(history);
            QueryContext queryContext = buildQueryContext(question, effectiveHistory);

            // 4. 向量检索相关文档
            List<Document> relevantDocs = retrieveRelevantDocs(queryContext, knowledgeBaseIds);

            // 5. 如果没有检索到有效文档，返回拒答模板
            if (!hasEffectiveHit(relevantDocs)) {
                return Flux.just(NO_RESULT_RESPONSE);
            }

            // 6. 将检索到的文档拼接成上下文字符串
            String context = relevantDocs.stream()
                    .map(Document::getText)
                    .collect(Collectors.joining("\n\n---\n\n"));

            log.debug("检索到 {} 个相关文档片段", relevantDocs.size());

            // 7. 构建 Prompt
            String systemPrompt = buildSystemPrompt();
            String userPrompt = buildUserPrompt(context, question);

            // 8. 构建流式调用（支持历史上下文）
            var promptSpec = getChatClient().prompt().system(systemPrompt);
            if (!effectiveHistory.isEmpty()) {
                promptSpec = promptSpec.messages(effectiveHistory);
            }

            // 9. 发起流式调用
            Flux<String> responseFlux = promptSpec
                    .user(userPrompt)
                    .stream()
                    .content();

            // 10. 通过探测窗口归一化流式输出
            log.info("开始流式输出知识库回答(探测窗口): kbIds={}", knowledgeBaseIds);
            return normalizeStreamOutput(responseFlux)
                .doOnComplete(() -> log.info("流式输出完成: kbIds={}", knowledgeBaseIds))
                .onErrorResume(e -> {
                    log.error("流式输出失败: kbIds={}, error={}", knowledgeBaseIds, e.getMessage(), e);
                    return Flux.just("【错误】知识库查询失败：AI服务暂时不可用，请稍后重试。");
                });

        } catch (Exception e) {
            log.error("知识库流式问答失败: {}", e.getMessage(), e);
            return Flux.just("【错误】知识库查询失败：" + e.getMessage());
        }
    }

    // ==================== 查询上下文构建 ====================

    /**
     * 构建查询上下文
     *
     * <h4>处理流程</h4>
     * <ol>
     *   <li>标准化问题 → 去除首尾空格</li>
     *   <li>查询改写 → 使用 LLM 优化问题（可选）</li>
     *   <li>生成候选查询 → 改写后的问题 + 原始问题（去重）</li>
     *   <li>解析检索参数 → 根据问题长度动态调整 topK 和阈值</li>
     * </ol>
     *
     * @param originalQuestion 原始用户问题
     * @param history          历史对话消息（用于查询改写）
     * @return 查询上下文
     */
    private QueryContext buildQueryContext(String originalQuestion, List<Message> history) {
        // 1. 标准化问题
        String normalizedQuestion = normalizeQuestion(originalQuestion);

        // 2. 查询改写（使用 LLM 优化问题）
        String rewrittenQuestion = rewriteQuestion(normalizedQuestion, history);

        // 3. 生成候选查询（改写后的问题优先，原始问题作为备选）
        Set<String> candidates = new LinkedHashSet<>();
        candidates.add(rewrittenQuestion);
        candidates.add(normalizedQuestion);

        // 4. 根据问题长度解析检索参数
        SearchParams searchParams = resolveSearchParams(normalizedQuestion);

        return new QueryContext(normalizedQuestion, new ArrayList<>(candidates), searchParams);
    }

    /**
     * 清洗历史消息
     * 目前只是简单返回，未来可以添加过滤逻辑
     */
    private List<Message> sanitizeHistory(List<Message> history) {
        if (history == null || history.isEmpty()) {
            return List.of();
        }
        return history;
    }

    /**
     * 标准化问题（去除首尾空格）
     */
    private String normalizeQuestion(String question) {
        return question == null ? "" : question.trim();
    }

    // ==================== 向量检索 ====================

    /**
     * 从向量数据库中检索相关文档
     *
     * <h4>多候选查询策略</h4>
     * <p>依次尝试候选查询（改写后的问题、原始问题），直到找到有效命中。
     * 这样可以提高检索的召回率：即使改写后的问题检索失败，原始问题仍有机会命中。</p>
     *
     * @param queryContext     查询上下文（包含候选查询和检索参数）
     * @param knowledgeBaseIds 知识库ID列表
     * @return 检索到的文档列表（如果所有候选都无命中，返回空列表）
     */
    private List<Document> retrieveRelevantDocs(QueryContext queryContext, List<Long> knowledgeBaseIds) {
        // 依次尝试每个候选查询
        for (String candidateQuery : queryContext.candidateQueries()) {
            if (candidateQuery.isBlank()) {
                continue;
            }

            // 执行向量相似度搜索
            List<Document> docs = vectorService.similaritySearch(
                candidateQuery,
                knowledgeBaseIds,
                queryContext.searchParams().topK(),     // 返回文档数量
                queryContext.searchParams().minScore()  // 最小相似度阈值
            );

            log.info("检索候选 query='{}'，命中 {} 条", candidateQuery, docs.size());

            // 如果找到有效命中，立即返回
            if (hasEffectiveHit(docs)) {
                return docs;
            }
        }

        // 所有候选都无命中
        return List.of();
    }

    /**
     * 根据问题长度动态解析检索参数
     *
     * <h4>策略说明</h4>
     * <ul>
     *   <li><b>短问题（≤ shortQueryLength）</b>：使用较小的 topK 和较高的相似度阈值，
     *       因为短问题的语义比较模糊，需要更严格的匹配</li>
     *   <li><b>中等问题（≤ 12 字符）</b>：使用中等的 topK 和默认阈值</li>
     *   <li><b>长问题（> 12 字符）</b>：使用较大的 topK 和默认阈值，
     *       因为长问题的语义更明确，可以放宽匹配</li>
     * </ul>
     *
     * @param question 标准化后的用户问题
     * @return 检索参数
     */
    private SearchParams resolveSearchParams(String question) {
        // 计算去除空格后的字符长度
        int compactLength = question.replaceAll("\\s+", "").length();

        // 短问题：更严格的阈值
        if (compactLength <= shortQueryLength) {
            return new SearchParams(topkShort, minScoreShort);
        }

        // 中等问题
        if (compactLength <= 12) {
            return new SearchParams(topkMedium, minScoreDefault);
        }

        // 长问题：更多的 topK
        return new SearchParams(topkLong, minScoreDefault);
    }

    // ==================== 查询改写 ====================

    /**
     * 使用 LLM 对用户问题进行改写，提升向量检索的召回率
     *
     * <h4>改写策略</h4>
     * <ul>
     *   <li>将口语化的问题转换为更正式的表述</li>
     *   <li>补充隐含的上下文信息</li>
     *   <li>结合历史对话理解追问意图</li>
     * </ul>
     *
     * <h4>示例</h4>
     * <pre>
     * 原始问题："这个怎么用？"
     * 改写后："请问如何使用知识库的向量检索功能？"
     * </pre>
     *
     * @param question 标准化后的用户问题
     * @param history  历史对话消息
     * @return 改写后的问题（如果改写失败，返回原问题）
     */
    private String rewriteQuestion(String question, List<Message> history) {
        // 如果未启用改写或问题为空，直接返回
        if (!rewriteEnabled || question.isBlank()) {
            return question;
        }

        try {
            // 构建改写 Prompt
            Map<String, Object> variables = new HashMap<>();
            variables.put("question", question);
            variables.put("history", formatHistoryForRewrite(history));
            String rewritePrompt = rewritePromptTemplate.render(variables);

            // 调用 LLM 进行改写
            String rewritten = getChatClient().prompt()
                .user(rewritePrompt)
                .call()
                .content();

            // 如果改写结果为空，返回原问题
            if (rewritten == null || rewritten.isBlank()) {
                return question;
            }

            String normalized = rewritten.trim();
            log.info("Query rewrite: origin='{}', rewritten='{}', historySize={}", question, normalized, history.size());
            return normalized;

        } catch (Exception e) {
            // 改写失败时，使用原问题继续检索（降级处理）
            log.warn("Query rewrite 失败，使用原问题继续检索: {}", e.getMessage());
            return question;
        }
    }

    /**
     * 将历史消息格式化为改写 Prompt 中的文本摘要
     *
     * <h4>格式说明</h4>
     * <pre>
     * 用户: 什么是向量检索？
     * 助手: 向量检索是一种基于语义相似度的搜索技术...
     * 用户: 它和传统搜索有什么区别？
     * </pre>
     *
     * @param history 历史对话消息
     * @return 格式化后的文本摘要
     */
    private String formatHistoryForRewrite(List<Message> history) {
        if (history == null || history.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        for (Message msg : history) {
            if (msg instanceof UserMessage) {
                sb.append("用户: ").append(msg.getText()).append("\n");
            } else if (msg instanceof AssistantMessage) {
                // 截断过长的助手回复，避免 rewrite prompt 过长
                String text = msg.getText();
                if (text.length() > MAX_REWRITE_HISTORY_CHAR) {
                    text = text.substring(0, MAX_REWRITE_HISTORY_CHAR) + "...";
                }
                sb.append("助手: ").append(text).append("\n");
            }
        }

        return sb.toString().trim();
    }

    // ==================== 辅助方法 ====================

    /**
     * 判断检索结果是否有效
     */
    private boolean hasEffectiveHit(List<Document> docs) {
        return docs != null && !docs.isEmpty();
    }

    /**
     * 标准化 LLM 回答
     * 如果回答为空或匹配拒答模板，返回统一的拒答提示
     */
    private String normalizeAnswer(String answer) {
        if (answer == null || answer.isBlank()) {
            return NO_RESULT_RESPONSE;
        }
        String normalized = answer.trim();
        if (isNoResultLike(normalized)) {
            return NO_RESULT_RESPONSE;
        }
        return normalized;
    }

    /**
     * 判断文本是否是 LLM 的”无信息”拒答模板
     *
     * <h4>常见的拒答表述</h4>
     * <ul>
     *   <li>”没有找到相关信息”</li>
     *   <li>”未检索到相关信息”</li>
     *   <li>”信息不足”</li>
     *   <li>”超出知识库范围”</li>
     *   <li>”无法根据提供内容回答”</li>
     * </ul>
     */
    private boolean isNoResultLike(String text) {
        return text.contains("没有找到相关信息")
            || text.contains("未检索到相关信息")
            || text.contains("信息不足")
            || text.contains("超出知识库范围")
            || text.contains("无法根据提供内容回答");
    }

    // ==================== 探测窗口机制（核心优化） ====================

    /**
     * 流式输出的探测窗口归一化
     *
     * <h4>工作原理</h4>
     * <pre>
     * LLM 流式输出
     *     ↓
     * 累积前 120 字符到 probeBuffer（探测阶段）
     *     ↓
     * ┌─ 命中”无信息”模板？
     * │   → 立即输出固定拒答模板
     * │   → 结束流（避免长篇无意义拒答）
     * │
     * └─ 未命中且 >= 120 字符？
     *     → 释放缓冲内容
     *     → 切换到透传模式（打字机效果）
     *     → 后续内容实时输出
     * </pre>
     *
     * <h4>为什么是 120 字符？</h4>
     * <ul>
     *   <li>足够识别常见的拒答模板（通常在前 50-100 字符就会暴露）</li>
     *   <li>不会太长，保证正常回答的延迟在可接受范围内</li>
     *   <li>平衡了”快速过滤”和”低延迟输出”两个目标</li>
     * </ul>
     *
     * @param rawFlux LLM 的原始流式输出
     * @return 归一化后的流式输出
     */
    private Flux<String> normalizeStreamOutput(Flux<String> rawFlux) {
        return Flux.create(sink -> {
            // 探测缓冲区
            StringBuilder probeBuffer = new StringBuilder();

            // 是否已经切换到透传模式
            AtomicBoolean passthrough = new AtomicBoolean(false);

            // 是否已经完成（用于防止重复完成）
            AtomicBoolean completed = new AtomicBoolean(false);

            // 订阅引用（用于取消订阅）
            final Disposable[] disposableRef = new Disposable[1];

            // 订阅原始流
            disposableRef[0] = rawFlux.subscribe(
                // onNext: 处理每个文本片段
                chunk -> {
                    // 如果已经完成或取消，忽略后续内容
                    if (completed.get() || sink.isCancelled()) {
                        return;
                    }

                    // 如果已经在透传模式，直接输出
                    if (passthrough.get()) {
                        sink.next(chunk);
                        return;
                    }

                    // 探测阶段：累积内容到缓冲区
                    probeBuffer.append(chunk);
                    String probeText = probeBuffer.toString();

                    // 检查是否命中”无信息”模板
                    if (isNoResultLike(probeText)) {
                        completed.set(true);
                        sink.next(NO_RESULT_RESPONSE);  // 输出固定拒答模板
                        sink.complete();
                        // 取消订阅原始流
                        if (disposableRef[0] != null) {
                            disposableRef[0].dispose();
                        }
                        return;
                    }

                    // 如果缓冲区 >= 120 字符，切换到透传模式
                    if (probeBuffer.length() >= STREAM_PROBE_CHARS) {
                        passthrough.set(true);
                        sink.next(probeText);  // 释放缓冲内容
                        probeBuffer.setLength(0);  // 清空缓冲区
                    }
                },
                // onError: 错误处理
                sink::error,
                // onComplete: 完成处理
                () -> {
                    if (completed.get() || sink.isCancelled()) {
                        return;
                    }

                    // 如果从未切换到透传模式，说明总内容 < 120 字符
                    // 需要对缓冲区内容进行标准化处理后输出
                    if (!passthrough.get()) {
                        sink.next(normalizeAnswer(probeBuffer.toString()));
                    }

                    sink.complete();
                }
            );

            // 取消订阅时的清理
            sink.onCancel(() -> {
                if (disposableRef[0] != null) {
                    disposableRef[0].dispose();
                }
            });
        });
    }

    // ==================== 内部数据结构 ====================

    /**
     * 检索参数
     *
     * @param topK     返回最相关的 K 个文档
     * @param minScore 最小相似度分数阈值（0-1）
     */
    private record SearchParams(int topK, double minScore) {
    }

    /**
     * 查询上下文
     *
     * @param originalQuestion 原始用户问题
     * @param candidateQueries 候选查询列表（改写后的问题 + 原始问题）
     * @param searchParams     检索参数
     */
    private record QueryContext(String originalQuestion, List<String> candidateQueries, SearchParams searchParams) {
    }
}
