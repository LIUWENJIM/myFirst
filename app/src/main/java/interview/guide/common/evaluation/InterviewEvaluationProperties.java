package interview.guide.common.evaluation;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 面试评估配置属性
 *
 * 配置前缀：app.interview.evaluation
 *
 * YAML 配置示例：
 * <pre>
 * app:
 *   interview:
 *     evaluation:
 *       batch-size: 8
 *       system-prompt-path: classpath:prompts/interview-evaluation-system.st
 *       user-prompt-path: classpath:prompts/interview-evaluation-user.st
 *       summary-system-prompt-path: classpath:prompts/interview-evaluation-summary-system.st
 *       summary-user-prompt-path: classpath:prompts/interview-evaluation-summary-user.st
 * </pre>
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.interview.evaluation")
public class InterviewEvaluationProperties {

    private int batchSize = 8;                                                          // 每批评估的题目数量
    private String systemPromptPath = "classpath:prompts/interview-evaluation-system.st";           // 分批评估系统提示词路径
    private String userPromptPath = "classpath:prompts/interview-evaluation-user.st";               // 分批评估用户提示词路径
    private String summarySystemPromptPath = "classpath:prompts/interview-evaluation-summary-system.st";  // 二次汇总系统提示词路径
    private String summaryUserPromptPath = "classpath:prompts/interview-evaluation-summary-user.st";      // 二次汇总用户提示词路径
}
