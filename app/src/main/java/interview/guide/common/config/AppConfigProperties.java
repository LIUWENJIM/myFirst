package interview.guide.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 简历模块配置属性
 *
 * 配置前缀：app.resume
 * 管理简历上传目录和允许的文件类型。
 *
 * YAML 配置示例：
 * <pre>
 * app:
 *   resume:
 *     upload-dir: ./uploads/resumes
 *     allowed-types:
 *       - application/pdf
 *       - application/vnd.openxmlformats-officedocument.wordprocessingml.document
 * </pre>
 */
@Component
@ConfigurationProperties(prefix = "app.resume")
public class AppConfigProperties {
    
    private String uploadDir;
    private List<String> allowedTypes;
    
    public String getUploadDir() {
        return uploadDir;
    }
    
    public void setUploadDir(String uploadDir) {
        this.uploadDir = uploadDir;
    }
    
    public List<String> getAllowedTypes() {
        return allowedTypes;
    }
    
    public void setAllowedTypes(List<String> allowedTypes) {
        this.allowedTypes = allowedTypes;
    }
}
