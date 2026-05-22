package interview.guide.modules.voiceinterview.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 创建语音面试会话请求
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSessionRequest {
    private String roleType;            // 角色类型（向后兼容，新请求可不传，服务层会用 skillId 填充）
    private String skillId;             // 面试技能ID，如 "java-backend", "bytedance-backend" 等
    private String difficulty;          // 难度级别："junior", "mid", "senior"
    private String customJdText;        // 自定义职位描述文本（可选）
    private Long resumeId;              // 关联的简历ID（可选）

    // 四个面试阶段的启用开关
    @Builder.Default
    private Boolean introEnabled = false;    // 是否启用自我介绍阶段（默认关闭）
    @Builder.Default
    private Boolean techEnabled = true;      // 是否启用技术面阶段
    @Builder.Default
    private Boolean projectEnabled = true;   // 是否启用项目面阶段
    @Builder.Default
    private Boolean hrEnabled = true;        // 是否启用 HR 面阶段
    @Builder.Default
    private Integer plannedDuration = 30;    // 计划面试时长（分钟）

    private String llmProvider;              // LLM 提供者（可选，为空则使用默认提供者）
}
