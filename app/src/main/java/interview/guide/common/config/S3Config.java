package interview.guide.common.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

/**
 * S3 客户端配置（用于 RustFS/MinIO 对象存储）
 *
 * 创建 AWS S3 SDK 客户端，连接本地 RustFS 或 MinIO 服务。
 * 使用路径风格访问（path-style），而非虚拟主机风格（virtual-hosted-style），
 * 因为本地 MinIO 不支持虚拟主机风格的 DNS 解析。
 *
 * 配置来源：StorageConfigProperties（app.storage.*）
 *
 * @see StorageConfigProperties
 */
@Configuration
@RequiredArgsConstructor
public class S3Config {

    private final StorageConfigProperties storageConfig;

    @Bean
    public S3Client s3Client() {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(
            storageConfig.getAccessKey(),
            storageConfig.getSecretKey()
        );

        return S3Client.builder()
            .endpointOverride(URI.create(storageConfig.getEndpoint()))
            .region(Region.of(storageConfig.getRegion()))
            .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .forcePathStyle(true) // 关键配置：使用路径风格访问，否则 SDK 会使用虚拟主机风格（`bucket.endpoint`）导致 DNS 解析失败
            .build();
    }
}
