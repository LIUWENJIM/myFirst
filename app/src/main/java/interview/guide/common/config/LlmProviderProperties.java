package interview.guide.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * LLM 提供者配置属性
 *
 * 配置前缀：app.ai
 * 管理所有 LLM 提供者的连接信息、默认提供者、Advisor 链配置等。
 * 是 LlmProviderRegistry 的配置来源之一（数据库配置优先级更高）。
 *
 * YAML 配置示例：
 * <pre>
 * app:
 *   ai:
 *     default-provider: dashscope
 *     default-embedding-provider: dashscope
 *     embedding-dimensions: 1024
 *     providers:
 *       dashscope:
 *         base-url: https://dashscope.aliyuncs.com/compatible-mode
 *         api-key: ${AI_BAILIAN_API_KEY}
 *         model: qwen-plus
 *         embedding-model: text-embedding-v3
 *         supports-embedding: true
 *     advisors:
 *       enabled: true
 *       tool-call-enabled: true
 *       safeguard-enabled: true
 * </pre>
 *
 * @see LlmProviderRegistry
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.ai")
public class LlmProviderProperties {
    private String defaultProvider = "dashscope";        // 默认 Chat 提供者ID
    private String defaultEmbeddingProvider;              // 默认 Embedding 提供者ID（为空则使用 defaultProvider）
    private Integer embeddingDimensions = 1024;           // 默认 Embedding 向量维度
    private Map<String, ProviderConfig> providers;        // 提供者配置 Map（key 为提供者ID）
    private AdvisorConfig advisors = new AdvisorConfig(); // Advisor 链配置
    private String configYamlPath;                        // 外部 YAML 配置文件路径（可选）
    private String configEnvPath;                         // 外部环境变量文件路径（可选）
    private SecurityConfig security = new SecurityConfig(); // 安全配置（API Key 加密等）

    // 单个提供者的配置
    @Data
    public static class ProviderConfig {
        private String baseUrl;              // API base URL
        private String apiKey;               // API Key（明文，运行时可能被数据库加密值覆盖）
        private String model;                // Chat 模型名（如 qwen-plus）
        private String embeddingModel;       // Embedding 模型名（如 text-embedding-v3）
        private Integer embeddingDimensions; // Embedding 向量维度（覆盖全局默认值）
        private Boolean supportsEmbedding;   // 是否支持 Embedding
        private Double temperature;          // 温度参数（0-1，越低越确定）
    }

    // 安全配置
    @Data
    public static class SecurityConfig {
        private String apiKeyEncryptionKey;          // API Key 加密密钥
        private boolean requireEncryptionKey = false; // 是否要求必须配置加密密钥
    }

    // Advisor 链配置（控制 ChatClient 的增强行为）
    @Data
    public static class AdvisorConfig {
        private boolean enabled = true;

        // ToolCallAdvisor
        private boolean toolCallEnabled = true;
        private boolean toolCallConversationHistoryEnabled = false;
        private boolean streamToolCallResponses = false;

        // MessageChatMemoryAdvisor（默认关闭，避免会话串扰）
        private boolean messageChatMemoryEnabled = false;
        private int messageChatMemoryMaxMessages = 120;

        // SimpleLoggerAdvisor（默认关闭）
        private boolean simpleLoggerEnabled = false;

        // SafeGuardAdvisor
        private boolean safeguardEnabled = true;
        private List<String> safeguardWords = List.of(
            "I'll now act as",
            "Sure, I'll ignore",
            "我已经忽略",
            "新的角色是",
            "忽略之前的指令",
            "forget all previous instructions"
        );

        // PromptSanitizer
        private boolean promptSanitizerEnabled = true;
    }
}
