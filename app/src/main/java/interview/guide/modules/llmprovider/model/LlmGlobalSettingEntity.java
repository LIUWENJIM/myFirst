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
 * LLM 全局设置实体
 *
 * 对应数据库表 llm_global_setting，存储全局默认提供者配置。
 * 单例模式：固定 ID 为 1（SINGLETON_ID），只有一条记录。
 *
 * LlmProviderRegistry 优先从此实体获取默认提供者ID，
 * 如果不存在则回退到 LlmProviderProperties 的配置。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "llm_global_setting")
public class LlmGlobalSettingEntity {

  public static final Long SINGLETON_ID = 1L;  // 单例ID（固定为 1）

  @Id
  private Long id;                                              // 主键（固定为 1）

  @Column(name = "default_chat_provider_id", nullable = false, length = 64)
  private String defaultChatProviderId;                         // 默认 Chat 提供者ID

  @Column(name = "default_embedding_provider_id", nullable = false, length = 64)
  private String defaultEmbeddingProviderId;                    // 默认 Embedding 提供者ID

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private LocalDateTime updatedAt;

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
