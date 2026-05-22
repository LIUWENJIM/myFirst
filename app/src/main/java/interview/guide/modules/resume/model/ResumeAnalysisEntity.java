package interview.guide.modules.resume.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * 简历评测结果实体
 * Resume Analysis Entity
 *
 * 简历评测结果实体存储 AI 分析简历后的评分和建议
 * 每次分析都会创建一条新的记录，形成历史记录
 *
 * 数据库表：resume_analyses
 * 关联关系：多对一关联 ResumeEntity（一个简历可以有多次分析）
 *
 * 评分维度：
 * - 总分 (overallScore): 0-100 分
 * - 内容完整性 (contentScore): 0-25 分
 * - 结构清晰度 (structureScore): 0-20 分
 * - 技能匹配度 (skillMatchScore): 0-25 分
 * - 表达专业性 (expressionScore): 0-15 分
 * - 项目经验 (projectScore): 0-15 分
 */
@Entity
@Table(name = "resume_analyses")
public class ResumeAnalysisEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;  // 主键ID，自增

    // 关联的简历（多对一关系，懒加载）
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resume_id", nullable = false)
    private ResumeEntity resume;

    // 总分 (0-100)
    private Integer overallScore;

    // ==================== 各维度评分 ====================
    private Integer contentScore;      // 内容完整性评分 (0-25)
    private Integer structureScore;    // 结构清晰度评分 (0-20)
    private Integer skillMatchScore;   // 技能匹配度评分 (0-25)
    private Integer expressionScore;   // 表达专业性评分 (0-15)
    private Integer projectScore;      // 项目经验评分 (0-15)

    // 简历摘要（AI 生成的简历内容概括）
    @Column(columnDefinition = "TEXT")
    private String summary;

    // 优点列表（JSON 格式存储，包含多个优点字符串）
    @Column(columnDefinition = "TEXT")
    private String strengthsJson;

    // 改进建议列表（JSON 格式存储，包含多个建议对象）
    // 每个建议对象包含：category, priority, issue, recommendation
    @Column(columnDefinition = "TEXT")
    private String suggestionsJson;

    // 评测时间（自动设置）
    @Column(nullable = false)
    private LocalDateTime analyzedAt;

    /**
     * JPA 生命周期回调：实体创建前自动执行
     * 设置评测时间为当前时间
     */
    @PrePersist
    protected void onCreate() {
        analyzedAt = LocalDateTime.now();
    }
    
    // ==================== Getters and Setters ====================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    /** 获取关联的简历实体 */
    public ResumeEntity getResume() {
        return resume;
    }

    public void setResume(ResumeEntity resume) {
        this.resume = resume;
    }

    /** 获取总分 (0-100) */
    public Integer getOverallScore() {
        return overallScore;
    }

    public void setOverallScore(Integer overallScore) {
        this.overallScore = overallScore;
    }

    /** 获取内容完整性评分 (0-25) */
    public Integer getContentScore() {
        return contentScore;
    }

    public void setContentScore(Integer contentScore) {
        this.contentScore = contentScore;
    }

    /** 获取结构清晰度评分 (0-20) */
    public Integer getStructureScore() {
        return structureScore;
    }

    public void setStructureScore(Integer structureScore) {
        this.structureScore = structureScore;
    }

    /** 获取技能匹配度评分 (0-25) */
    public Integer getSkillMatchScore() {
        return skillMatchScore;
    }

    public void setSkillMatchScore(Integer skillMatchScore) {
        this.skillMatchScore = skillMatchScore;
    }

    /** 获取表达专业性评分 (0-15) */
    public Integer getExpressionScore() {
        return expressionScore;
    }

    public void setExpressionScore(Integer expressionScore) {
        this.expressionScore = expressionScore;
    }

    /** 获取项目经验评分 (0-15) */
    public Integer getProjectScore() {
        return projectScore;
    }

    public void setProjectScore(Integer projectScore) {
        this.projectScore = projectScore;
    }

    /** 获取简历摘要 */
    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    /** 获取优点列表 JSON（需要反序列化） */
    public String getStrengthsJson() {
        return strengthsJson;
    }

    public void setStrengthsJson(String strengthsJson) {
        this.strengthsJson = strengthsJson;
    }

    /** 获取改进建议列表 JSON（需要反序列化） */
    public String getSuggestionsJson() {
        return suggestionsJson;
    }

    public void setSuggestionsJson(String suggestionsJson) {
        this.suggestionsJson = suggestionsJson;
    }

    /** 获取评测时间 */
    public LocalDateTime getAnalyzedAt() {
        return analyzedAt;
    }

    public void setAnalyzedAt(LocalDateTime analyzedAt) {
        this.analyzedAt = analyzedAt;
    }
}
