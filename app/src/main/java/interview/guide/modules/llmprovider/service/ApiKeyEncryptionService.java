package interview.guide.modules.llmprovider.service;

import interview.guide.common.config.LlmProviderProperties;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * API Key 加密服务
 *
 * 使用 AES-256-GCM 算法对 LLM 提供者的 API Key 进行加密存储。
 * 加密密钥来源：
 * 1. 配置项 app.ai.security.api-key-encryption-key（生产环境）
 * 2. 开发环境回退密钥（DEV_FALLBACK_KEY）
 *
 * 密钥解析规则：
 * - 如果配置值是合法的 Base64 且解码后为 32 字节，直接使用
 * - 否则对配置值做 SHA-256 哈希，得到 32 字节密钥
 *
 * 加密格式：nonce(12字节 Base64) + ciphertext(GCM加密后 Base64)
 */
@Slf4j
@Service
public class ApiKeyEncryptionService {

  private static final int NONCE_BYTES = 12;     // GCM nonce 长度（字节）
  private static final int GCM_TAG_BITS = 128;    // GCM 认证标签长度（位）
  private static final String CIPHER = "AES/GCM/NoPadding";  // 加密算法
  private static final String DEV_FALLBACK_KEY =             // 开发环境回退密钥
      "interview-guide-dev-only-provider-api-key-encryption";

  private final LlmProviderProperties properties;            // LLM 配置属性
  private final SecureRandom secureRandom = new SecureRandom();  // 安全随机数生成器
  private SecretKeySpec secretKey;                            // AES 密钥

  public ApiKeyEncryptionService(LlmProviderProperties properties) {
    this.properties = properties;
  }

  @PostConstruct
  void init() {
    LlmProviderProperties.SecurityConfig security = properties.getSecurity();
    String configuredKey = security != null ? security.getApiKeyEncryptionKey() : null;
    if (configuredKey == null || configuredKey.isBlank()) {
      if (security != null && security.isRequireEncryptionKey()) {
        throw new BusinessException(ErrorCode.PROVIDER_CONFIG_READ_FAILED,
            "APP_AI_CONFIG_ENCRYPTION_KEY 未配置，无法解密 Provider API Key");
      }
      log.warn("APP_AI_CONFIG_ENCRYPTION_KEY is not configured; using development fallback key");
      configuredKey = DEV_FALLBACK_KEY;
    }
    secretKey = new SecretKeySpec(resolveKeyBytes(configuredKey), "AES");
  }

  public EncryptedValue encrypt(String plainText) {
    try {
      byte[] nonce = new byte[NONCE_BYTES];
      secureRandom.nextBytes(nonce);

      Cipher cipher = Cipher.getInstance(CIPHER);
      cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, nonce));
      byte[] ciphertext = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

      return new EncryptedValue(
          Base64.getEncoder().encodeToString(nonce),
          Base64.getEncoder().encodeToString(ciphertext)
      );
    } catch (Exception e) {
      throw new BusinessException(ErrorCode.PROVIDER_CONFIG_WRITE_FAILED,
          "加密 Provider API Key 失败", e);
    }
  }

  public String decrypt(String nonceBase64, String ciphertextBase64) {
    try {
      byte[] nonce = Base64.getDecoder().decode(nonceBase64);
      byte[] ciphertext = Base64.getDecoder().decode(ciphertextBase64);

      Cipher cipher = Cipher.getInstance(CIPHER);
      cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, nonce));
      byte[] plainText = cipher.doFinal(ciphertext);
      return new String(plainText, StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new BusinessException(ErrorCode.PROVIDER_CONFIG_READ_FAILED,
          "解密 Provider API Key 失败，请检查 APP_AI_CONFIG_ENCRYPTION_KEY", e);
    }
  }

  private byte[] resolveKeyBytes(String configuredKey) {
    String trimmed = configuredKey.trim();
    try {
      byte[] decoded = Base64.getDecoder().decode(trimmed);
      if (decoded.length == 32) {
        return decoded;
      }
    } catch (IllegalArgumentException ignored) {
      // Fall through to SHA-256 derivation for human-readable keys.
    }
    return sha256(trimmed);
  }

  private byte[] sha256(String value) {
    try {
      return MessageDigest.getInstance("SHA-256")
          .digest(value.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw new BusinessException(ErrorCode.PROVIDER_CONFIG_READ_FAILED,
          "初始化 Provider API Key 加密密钥失败", e);
    }
  }

  public record EncryptedValue(String nonce, String ciphertext) {
  }
}
