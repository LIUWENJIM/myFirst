package interview.guide.modules.resume.service;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 简历分析配置属性
 *
 * 配置简历分析服务使用的提示词模板路径
 * 使用 Spring Boot 的 @ConfigurationProperties 绑定配置
 *
 * 配置前缀：app.resume.analysis
 *
 * 配置示例（application.yml）：
 * app:
 *   resume:
 *     analysis:
 *       system-prompt-path: classpath:prompts/resume-analysis-system.st
 *       user-prompt-path: classpath:prompts/resume-analysis-user.st
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.resume.analysis")
public class ResumeAnalysisProperties {

    // 系统提示词模板路径（定义 AI 的角色和评分规则）
    private String systemPromptPath = "classpath:prompts/resume-analysis-system.st";

    // 用户提示词模板路径（包含简历文本的占位符）
    private String userPromptPath = "classpath:prompts/resume-analysis-user.st";
}
