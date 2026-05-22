package interview.guide.common.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Agent 工具配置属性
 *
 * 配置前缀：app.ai.agent-utils
 * 管理面试技能知识库的根目录路径。
 *
 * YAML 配置示例：
 * <pre>
 * app:
 *   ai:
 *     agent-utils:
 *       skills-root: classpath:skills
 * </pre>
 *
 * @see AgentUtilsConfiguration
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.ai.agent-utils")
public class AgentUtilsProperties {

    private String skillsRoot = "classpath:skills";  // 技能文件根目录（每个子目录是一个技能，包含 SKILL.md）
}
