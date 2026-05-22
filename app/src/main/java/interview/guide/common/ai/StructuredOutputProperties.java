package interview.guide.common.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 结构化输出配置属性
 *
 * 配置前缀：app.ai
 * 控制 StructuredOutputInvoker 的重试、修复和监控行为。
 *
 * YAML 配置示例：
 * <pre>
 * app:
 *   ai:
 *     structured-max-attempts: 2
 *     structured-include-last-error: true
 *     structured-retry-use-repair-prompt: true
 *     structured-retry-append-strict-json-instruction: true
 *     structured-error-message-max-length: 200
 *     structured-metrics-enabled: true
 * </pre>
 *
 * @see StructuredOutputInvoker
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.ai")
public class StructuredOutputProperties {

    private int structuredMaxAttempts = 2;                           // 最大重试次数（含首次调用）
    private boolean structuredIncludeLastError = true;               // 重试时是否在提示词中包含上次错误信息
    private boolean structuredRetryUseRepairPrompt = true;           // 是否使用修复提示词
    private boolean structuredRetryAppendStrictJsonInstruction = true;  // 重试时是否追加严格 JSON 指令
    private int structuredErrorMessageMaxLength = 200;               // 错误信息最大长度
    private boolean structuredMetricsEnabled = true;                 // 是否启用 Micrometer 指标监控
}
