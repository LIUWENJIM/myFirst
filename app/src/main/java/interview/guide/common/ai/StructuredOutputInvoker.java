package interview.guide.common.ai;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import org.slf4j.Logger;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 结构化输出调用器（带重试和修复机制）
 *
 * 统一封装 LLM 结构化输出的调用流程，解决 LLM 返回 JSON 不稳定的常见问题。
 * 被 UnifiedEvaluationService、InterviewQuestionService、ResumeGradingService 等依赖。
 *
 * 核心能力：
 * 1. 重试机制：LLM 返回的 JSON 解析失败时，自动重试（最多 maxAttempts 次）
 * 2. JSON 修复：自动修复 LLM 返回中未转义的引号等常见格式问题
 * 3. 安全防护：系统提示词中注入防注入指令（PromptSecurityConstants）
 * 4. 指标监控：通过 Micrometer 记录调用次数、成功/失败率、延迟
 *
 * 调用流程：
 * 1. 首次调用：拼接系统提示词 + 防注入指令，调用 LLM
 * 2. 解析结果：先尝试 BeanOutputConverter 直接解析
 * 3. 本地修复：如果解析失败，尝试修复未转义引号后重新解析
 * 4. 重试：如果仍然失败，构建重试提示词（含上次错误信息），重新调用 LLM
 * 5. 达到最大次数仍失败：抛出 BusinessException
 *
 * 配置项（通过 StructuredOutputProperties）：
 * - structuredMaxAttempts: 最大重试次数（默认 3）
 * - structuredIncludeLastError: 重试时是否包含上次错误信息
 * - structuredRetryUseRepairPrompt: 是否使用修复提示词
 * - structuredRetryAppendStrictJsonInstruction: 是否追加严格 JSON 指令
 * - structuredErrorMessageMaxLength: 错误信息最大长度
 * - structuredMetricsEnabled: 是否启用指标监控
 */
@Component
public class StructuredOutputInvoker {

    // 严格 JSON 输出指令（追加到重试提示词中，引导 LLM 输出纯 JSON）
    private static final String STRICT_JSON_INSTRUCTION = """
请仅返回可被 JSON 解析器直接解析的 JSON 对象，并严格满足字段结构要求：
1) 不要输出 Markdown 代码块（如 ```json）。
2) 不要输出任何解释文字、前后缀、注释。
3) 所有字符串内引号必须正确转义。
    """;

    // Micrometer 指标名称
    private static final String METRIC_INVOCATIONS = "app.ai.structured_output.invocations";  // 调用次数
    private static final String METRIC_ATTEMPTS = "app.ai.structured_output.attempts";          // 尝试次数
    private static final String METRIC_LATENCY = "app.ai.structured_output.latency";            // 调用延迟
    private static final String STATUS_SUCCESS = "success";   // 成功状态标签
    private static final String STATUS_FAILURE = "failure";   // 失败状态标签
    private static final int MAX_CONTEXT_TAG_LENGTH = 48;     // 上下文标签最大长度（用于指标标签）
    private static final Pattern NON_ALNUM_PATTERN = Pattern.compile("[^a-z0-9_]+");  // 非字母数字模式
    private static final Pattern MULTI_UNDERSCORE = Pattern.compile("_+");           // 连续下划线模式

    private final int maxAttempts;                          // 最大重试次数（含首次调用）
    private final boolean includeLastErrorInRetryPrompt;    // 重试时是否在提示词中包含上次错误信息
    private final boolean retryUseRepairPrompt;             // 是否使用修复提示词（引导 LLM 输出纯 JSON）
    private final boolean retryAppendStrictJsonInstruction; // 重试时是否追加严格 JSON 指令
    private final int errorMessageMaxLength;                // 错误信息最大长度（超过截断）
    private final boolean metricsEnabled;                   // 是否启用 Micrometer 指标监控
    private final MeterRegistry meterRegistry;              // Micrometer 指标注册表

    /**
     * 构造函数，从配置属性初始化参数
     *
     * @param properties    结构化输出配置属性
     * @param meterRegistry Micrometer 指标注册表（可选，为 null 时不记录指标）
     */
    public StructuredOutputInvoker(
        StructuredOutputProperties properties,
        @Autowired(required = false) MeterRegistry meterRegistry
    ) {
        this.maxAttempts = Math.max(1, properties.getStructuredMaxAttempts());
        this.includeLastErrorInRetryPrompt = properties.isStructuredIncludeLastError();
        this.retryUseRepairPrompt = properties.isStructuredRetryUseRepairPrompt();
        this.retryAppendStrictJsonInstruction = properties.isStructuredRetryAppendStrictJsonInstruction();
        this.errorMessageMaxLength = Math.max(20, properties.getStructuredErrorMessageMaxLength());
        this.metricsEnabled = properties.isStructuredMetricsEnabled();
        this.meterRegistry = meterRegistry;
    }

    /**
     * 调用 LLM 获取结构化输出（核心方法）
     *
     * 调用流程：
     * 1. 拼接系统提示词 + 防注入指令
     * 2. 循环尝试（最多 maxAttempts 次）：
     *    - 首次使用原始提示词，后续使用重试提示词（含上次错误信息）
     *    - 调用 LLM 获取文本响应
     *    - 尝试解析为 Java 对象（先直接解析，再尝试修复后解析）
     *    - 成功则记录指标并返回
     *    - 失败则记录指标，继续重试
     * 3. 所有尝试失败后抛出 BusinessException
     *
     * @param <T>                    返回类型
     * @param chatClient             LLM 客户端
     * @param systemPromptWithFormat 系统提示词（含输出格式说明）
     * @param userPrompt             用户提示词
     * @param outputConverter        BeanOutputConverter（定义目标类型和解析逻辑）
     * @param errorCode              失败时的错误码
     * @param errorPrefix            错误信息前缀
     * @param logContext             日志上下文标识（如"批次评估"、"出题"）
     * @param log                    Logger 实例
     * @return 解析后的结构化对象
     * @throws BusinessException 达到最大重试次数仍失败时抛出
     */
    public <T> T invoke(
        ChatClient chatClient,
        String systemPromptWithFormat,
        String userPrompt,
        BeanOutputConverter<T> outputConverter,
        ErrorCode errorCode,
        String errorPrefix,
        String logContext,
        Logger log
    ) {
        long startNanos = System.nanoTime();
        String contextTag = normalizeContextTag(logContext);
        String securedSystemPrompt = systemPromptWithFormat
            + PromptSecurityConstants.ANTI_INJECTION_INSTRUCTION;
        Exception lastError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            String attemptSystemPrompt = attempt == 1
                ? securedSystemPrompt
                : buildRetrySystemPrompt(securedSystemPrompt, lastError);
            try {
                String content = chatClient.prompt()
                    .system(attemptSystemPrompt)
                    .user(userPrompt)
                    .call()
                    .content();
                T result = convertWithRepair(content, outputConverter, logContext, log);
                recordAttempt(contextTag, STATUS_SUCCESS);
                recordInvocation(contextTag, STATUS_SUCCESS, startNanos);
                return result;
            } catch (Exception e) {
                lastError = e;
                recordAttempt(contextTag, STATUS_FAILURE);
                if (attempt < maxAttempts) {
                    log.warn("{}结构化解析失败，准备重试: attempt={}/{}, error={}",
                        logContext, attempt, maxAttempts, e.getMessage());
                } else {
                    log.error("{}结构化解析失败，已达最大重试次数: attempts={}, error={}",
                        logContext, maxAttempts, e.getMessage());
                }
            }
        }

        recordInvocation(contextTag, STATUS_FAILURE, startNanos);
        throw new BusinessException(
            errorCode,
            errorPrefix + (lastError != null ? lastError.getMessage() : "unknown")
        );
    }

    /**
     * 尝试解析 LLM 输出为结构化对象（含本地修复）
     *
     * 1. 先尝试直接解析
     * 2. 如果失败，尝试修复未转义引号后重新解析
     * 3. 修复也失败则抛出原始异常
     *
     * @param <T>             返回类型
     * @param content         LLM 返回的文本内容
     * @param outputConverter BeanOutputConverter
     * @param logContext      日志上下文
     * @param log             Logger
     * @return 解析后的结构化对象
     * @throws Exception 解析失败时抛出
     */
    private <T> T convertWithRepair(
        String content,
        BeanOutputConverter<T> outputConverter,
        String logContext,
        Logger log
    ) {
        try {
            return outputConverter.convert(content);
        } catch (Exception firstError) {
            String repaired = repairUnescapedQuotesInJsonStrings(content);
            if (!repaired.equals(content)) {
                try {
                    T result = outputConverter.convert(repaired);
                    log.warn("{}结构化 JSON 存在未转义引号，已在本地修复后解析成功", logContext);
                    return result;
                } catch (Exception repairError) {
                    firstError.addSuppressed(repairError);
                }
            }
            throw firstError;
        }
    }

    /**
     * 修复 JSON 字符串中未转义的引号
     *
     * LLM 有时会在 JSON 字符串值中输出未转义的双引号，导致解析失败。
     * 此方法通过状态机扫描 JSON 内容，识别并转义这些引号。
     *
     * 算法：
     * - 使用 inString 标志跟踪当前是否在 JSON 字符串内部
     * - 使用 escaping 标志跟踪前一个字符是否是反斜杠
     * - 遇到字符串内的 " 时，判断是否为字符串终止符（后跟 ,}] : 或空白）
     * - 如果不是终止符，则转义为 \"
     *
     * @param content LLM 返回的原始 JSON 文本
     * @return 修复后的 JSON 文本
     */
    private String repairUnescapedQuotesInJsonStrings(String content) {
        if (content == null || content.isBlank()) {
            return content;
        }
        StringBuilder repaired = new StringBuilder(content.length() + 16);
        boolean inString = false;
        boolean escaping = false;
        for (int i = 0; i < content.length(); i++) {
            char ch = content.charAt(i);
            if (!inString) {
                if (ch == '"') {
                    inString = true;
                }
                repaired.append(ch);
                continue;
            }

            if (escaping) {
                repaired.append(ch);
                escaping = false;
                continue;
            }
            if (ch == '\\') {
                repaired.append(ch);
                escaping = true;
                continue;
            }
            if (ch == '"') {
                if (isLikelyJsonStringTerminator(content, i + 1)) {
                    inString = false;
                    repaired.append(ch);
                } else {
                    repaired.append("\\\"");
                }
                continue;
            }
            repaired.append(ch);
        }
        return repaired.toString();
    }

    private boolean isLikelyJsonStringTerminator(String content, int start) {
        for (int i = start; i < content.length(); i++) {
            char next = content.charAt(i);
            if (Character.isWhitespace(next)) {
                continue;
            }
            return next == ',' || next == '}' || next == ']' || next == ':';
        }
        return true;
    }

    /**
     * 构建重试时的系统提示词
     * 在原始系统提示词基础上追加严格 JSON 指令和上次错误信息
     *
     * @param systemPromptWithFormat 原始系统提示词
     * @param lastError              上次解析失败的异常
     * @return 重试系统提示词
     */
    private String buildRetrySystemPrompt(String systemPromptWithFormat, Exception lastError) {
        if (!retryUseRepairPrompt) {
            return systemPromptWithFormat;
        }

        StringBuilder prompt = new StringBuilder(systemPromptWithFormat)
            .append("\n\n");

        if (retryAppendStrictJsonInstruction) {
            prompt.append(STRICT_JSON_INSTRUCTION).append('\n');
        }
        prompt.append("上次输出解析失败，请仅返回合法 JSON。");

        if (includeLastErrorInRetryPrompt && lastError != null && lastError.getMessage() != null) {
            prompt.append("\n上次失败原因：")
                .append(sanitizeErrorMessage(lastError.getMessage()));
        }
        return prompt.toString();
    }

    private String sanitizeErrorMessage(String message) {
        String oneLine = message.replace('\n', ' ').replace('\r', ' ').trim();
        if (oneLine.length() > errorMessageMaxLength) {
            return oneLine.substring(0, errorMessageMaxLength) + "...";
        }
        return oneLine;
    }

    private void recordAttempt(String contextTag, String status) {
        if (!isMetricsAvailable()) {
            return;
        }
        meterRegistry.counter(
            METRIC_ATTEMPTS,
            Tags.of("context", contextTag, "status", status)
        ).increment();
    }

    private void recordInvocation(String contextTag, String status, long startNanos) {
        if (!isMetricsAvailable()) {
            return;
        }
        Tags tags = Tags.of("context", contextTag, "status", status);
        meterRegistry.counter(METRIC_INVOCATIONS, tags).increment();
        meterRegistry.timer(METRIC_LATENCY, tags)
            .record(System.nanoTime() - startNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
    }

    private boolean isMetricsAvailable() {
        return metricsEnabled && meterRegistry != null;
    }

    private String normalizeContextTag(String raw) {
        String source = (raw == null || raw.isBlank()) ? "unknown" : raw;
        String normalized = source.toLowerCase(Locale.ROOT).trim().replace(' ', '_');
        normalized = NON_ALNUM_PATTERN.matcher(normalized).replaceAll("_");
        normalized = MULTI_UNDERSCORE.matcher(normalized).replaceAll("_");
        normalized = normalized.replaceAll("^_+|_+$", "");
        if (normalized.isBlank()) {
            normalized = "unknown";
        }
        if (normalized.length() > MAX_CONTEXT_TAG_LENGTH) {
            normalized = normalized.substring(0, MAX_CONTEXT_TAG_LENGTH);
        }
        return normalized;
    }
}
