package interview.guide.common.config;

import interview.guide.common.ai.LlmProviderRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * EmbeddingModel Bean 配置
 *
 * 创建一个委托型 EmbeddingModel Bean，实际调用延迟到运行时。
 * 这样 Spring AI 的 VectorStore 等组件可以注入 EmbeddingModel，
 * 但实际使用哪个提供者的 EmbeddingModel 由 LlmProviderRegistry 动态决定。
 *
 * 优势：
 * - 不需要在启动时确定 EmbeddingModel 提供者
 * - 支持运行时切换默认 Embedding 提供者（通过全局设置）
 * - 与 Spring AI 的自动配置解耦
 */
@Configuration
@Slf4j
public class LlmEmbeddingConfig {

  /**
   * 创建委托型 EmbeddingModel Bean
   * 每次调用时委托给 registry.getDefaultEmbeddingModel()
   */
  @Bean
  public EmbeddingModel embeddingModel(LlmProviderRegistry registry) {
    log.info("EmbeddingModel bean initialized as registry delegate");
    return new EmbeddingModel() {
      @Override
      public EmbeddingResponse call(EmbeddingRequest request) {
        return registry.getDefaultEmbeddingModel().call(request);
      }

      @Override
      public float[] embed(Document document) {
        return registry.getDefaultEmbeddingModel().embed(document);
      }
    };
  }
}
