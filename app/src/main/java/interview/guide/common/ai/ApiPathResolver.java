package interview.guide.common.ai;

import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.util.regex.Pattern;

/**
 * OpenAI API 路径解析器
 *
 * 解决不同 LLM 提供者 base URL 格式不一致的问题。
 * 有些提供者 URL 已包含版本号（如 https://api.openai.com/v1），
 * 有些不包含（如 https://api.deepseek.com）。
 * 此工具类统一处理 URL 格式，构建正确的 OpenAiApi 实例。
 *
 * 超时配置：
 * - 连接超时：10 秒
 * - 读取超时：300 秒（LLM 生成可能较慢）
 */
public final class ApiPathResolver {

  private static final int DEFAULT_CONNECT_TIMEOUT = 10000;   // 连接超时（毫秒）
  private static final int DEFAULT_READ_TIMEOUT = 300000;      // 读取超时（毫秒，5分钟）

  // URL 末尾版本号模式（如 /v1、/v1beta）
  private static final Pattern TRAILING_VERSION = Pattern.compile("/v\\d+[a-zA-Z0-9]*$");

  private ApiPathResolver() {}

  /**
   * 构建 OpenAiApi 实例（使用默认超时）
   *
   * @param baseUrl LLM 提供者的 base URL
   * @param apiKey  API Key
   * @return OpenAiApi 实例
   */
  public static OpenAiApi buildOpenAiApi(String baseUrl, String apiKey) {
    return buildOpenAiApi(baseUrl, apiKey, DEFAULT_CONNECT_TIMEOUT, DEFAULT_READ_TIMEOUT);
  }

  /**
   * 构建 OpenAiApi 实例
   *
   * 如果 base URL 已包含版本号（如 /v1），则设置明确的 completions/embeddings 路径，
   * 避免 Spring AI 自动追加 /v1 导致路径重复。
   *
   * @param baseUrl        LLM 提供者的 base URL
   * @param apiKey         API Key
   * @param connectTimeout 连接超时（毫秒）
   * @param readTimeout    读取超时（毫秒）
   * @return OpenAiApi 实例
   */
  public static OpenAiApi buildOpenAiApi(String baseUrl, String apiKey,
      int connectTimeout, int readTimeout) {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(connectTimeout);
    requestFactory.setReadTimeout(readTimeout);

    RestClient.Builder restClientBuilder = RestClient.builder()
        .requestFactory(requestFactory);

    OpenAiApi.Builder apiBuilder = OpenAiApi.builder()
        .baseUrl(baseUrl)
        .apiKey(apiKey)
        .restClientBuilder(restClientBuilder);
    if (baseUrlContainsVersion(baseUrl)) {
      apiBuilder.completionsPath("/chat/completions").embeddingsPath("/embeddings");
    }
    return apiBuilder.build();
  }

  public static boolean baseUrlContainsVersion(String baseUrl) {
    if (baseUrl == null || baseUrl.isBlank()) {
      return false;
    }
    String stripped = stripTrailingSlashes(baseUrl.trim());
    return TRAILING_VERSION.matcher(stripped).find();
  }

  public static String stripTrailingSlashes(String value) {
    if (value == null) {
      return "";
    }
    String result = value.trim();
    while (result.endsWith("/")) {
      result = result.substring(0, result.length() - 1);
    }
    return result;
  }
}
