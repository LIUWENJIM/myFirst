package interview.guide.modules.voiceinterview.model;

import interview.guide.common.model.AsyncTaskStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Builder.Default;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 语音面试会话实体
 *
 * 对应数据库表 voice_interview_sessions，存储语音面试会话的完整状态。
 * 支持多阶段面试流程：自我介绍 -> 技术面 -> 项目面 -> HR面
 *
 * 状态流转：IN_PROGRESS -> PAUSED -> IN_PROGRESS -> COMPLETED
 * 阶段流转：INTRO -> TECH -> PROJECT -> HR -> COMPLETED
 */
@Entity
@Table(name = "voice_interview_sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoiceInterviewSessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;                    // 会话ID（主键）

    @Column(name = "user_id")
    private String userId;              // 用户ID

    @Column(name = "role_type", nullable = false)
    private String roleType;            // 角色类型（如 "java-backend"、"frontend"）

    @Column(name = "skill_id", length = 64)
    @Builder.Default
    private String skillId = "java-backend";  // 面试技能ID（用于加载 SKILL.md）

    @Column(name = "difficulty", length = 16)
    @Builder.Default
    private String difficulty = "mid";        // 难度级别（junior/mid/senior）

    @Column(name = "custom_jd_text", columnDefinition = "TEXT")
    private String customJdText;              // 自定义职位描述文本（可选）

    @Column(name = "resume_id")
    private Long resumeId;                    // 关联的简历ID（可选）

    // 四个面试阶段的启用开关
    @Column(name = "intro_enabled")
    @Builder.Default
    private Boolean introEnabled = true;      // 是否启用自我介绍阶段

    @Column(name = "tech_enabled")
    @Builder.Default
    private Boolean techEnabled = true;       // 是否启用技术面阶段

    @Column(name = "project_enabled")
    @Builder.Default
    private Boolean projectEnabled = true;    // 是否启用项目面阶段

    @Column(name = "hr_enabled")
    @Builder.Default
    private Boolean hrEnabled = true;         // 是否启用 HR 面阶段

    @Column(name = "llm_provider", length = 50)
    @Builder.Default
    private String llmProvider = "dashscope"; // LLM 提供者（用于生成面试问题）

    @Column(name = "current_phase")
    @Enumerated(EnumType.STRING)
    private InterviewPhase currentPhase;      // 当前面试阶段

    @Column(name = "status")
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private VoiceInterviewSessionStatus status = VoiceInterviewSessionStatus.IN_PROGRESS;  // 会话状态

    @Column(name = "planned_duration")
    @Builder.Default
    private Integer plannedDuration = 30;     // 计划面试时长（分钟）

    @Column(name = "actual_duration")
    private Integer actualDuration;           // 实际面试时长（秒）

    @Column(name = "start_time")
    private LocalDateTime startTime;          // 面试开始时间

    @Column(name = "end_time")
    private LocalDateTime endTime;            // 面试结束时间

    @Column(name = "created_at")
    private LocalDateTime createdAt;          // 记录创建时间

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;          // 记录更新时间

    @Column(name = "paused_at")
    private LocalDateTime pausedAt;           // 暂停时间

    @Column(name = "resumed_at")
    private LocalDateTime resumedAt;          // 恢复时间

    @Column(name = "evaluate_status")
    @Enumerated(EnumType.STRING)
    private AsyncTaskStatus evaluateStatus;   // 评估状态（PENDING/PROCESSING/COMPLETED/FAILED）

    @Column(name = "evaluate_error", length = 500)
    private String evaluateError;             // 评估失败时的错误信息

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.startTime = LocalDateTime.now();
    }

    public enum InterviewPhase {
        INTRO, TECH, PROJECT, HR, COMPLETED
    }
}
