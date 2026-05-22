package interview.guide.modules.llmprovider.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * LLM 提供者配置实体
 *
 * 对应数据库表 llm_provider_config，存储 LLM 提供者的连接配置。
 * API Key 使用 AES-256-GCM 加密存储（apiKeyCiphertext + apiKeyNonce）。
 *
 * 与 LlmProviderProperties.providers 的区别：
 * - 此实体是运行时配置（可通过管理界面修改）
 * - LlmProviderProperties 是启动时配置（配置文件）
 * - LlmProviderRegistry 优先从此实体加载配置
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "llm_provider_config")
public class LlmProviderEntity {

  @Id
  @Column(length = 64)
  private String id;                         // 提供者ID（主键，如 "dashscope"、"openai"）

  @Column(name = "base_url", nullable = false, length = 512)
  private String baseUrl;                    // API base URL

  @Column(name = "api_key_ciphertext", nullable = false, length = 4096)
  private String apiKeyCiphertext;           // API Key 密文（AES-256-GCM 加密后 Base64）

  @Column(name = "api_key_nonce", nullable = false, length = 64)
  private String apiKeyNonce;                // 加密 nonce（Base64）

  @Column(nullable = false, length = 128)
  private String model;                      // Chat 模型名（如 "qwen-plus"）

  @Column(name = "embedding_model", length = 128)
  private String embeddingModel;             // Embedding 模型名（如 "text-embedding-v3"）

  @Column(name = "embedding_dimensions")
  private Integer embeddingDimensions;       // Embedding 向量维度

  @Column(name = "supports_embedding", nullable = false)
  private boolean supportsEmbedding;         // 是否支持 Embedding

  private Double temperature;                // 温度参数（0-1）

  @Column(nullable = false)
  private boolean enabled;                   // 是否启用

  @Column(nullable = false)
  private boolean builtin;                   // 是否为内置提供者（不可删除）

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;           // 创建时间

  @Column(name = "updated_at", nullable = false)
  private LocalDateTime updatedAt;           // 更新时间

  @PrePersist
  void prePersist() {
    LocalDateTime now = LocalDateTime.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
