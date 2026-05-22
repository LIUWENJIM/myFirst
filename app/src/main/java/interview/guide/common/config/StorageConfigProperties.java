package interview.guide.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * RustFS (S3兼容) 存储配置属性
 *
 * 配置前缀：app.storage
 * 用于连接本地 RustFS 或 MinIO 对象存储服务。
 *
 * YAML 配置示例：
 * <pre>
 * app:
 *   storage:
 *     endpoint: http://localhost:9000
 *     access-key: minioadmin
 *     secret-key: minioadmin
 *     bucket: interview-guide
 *     region: us-east-1
 * </pre>
 *
 * @see S3Config
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.storage")
public class StorageConfigProperties {

    private String endpoint;
    private String accessKey;
    private String secretKey;
    private String bucket;
    private String region = "us-east-1";
}
