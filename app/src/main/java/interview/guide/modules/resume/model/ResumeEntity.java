package interview.guide.modules.resume.model;

import interview.guide.common.model.AsyncTaskStatus;
import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * 简历实体
 * Resume Entity for deduplication and persistence
 *
 * 简历实体是简历模块的核心数据模型，负责：
 * 1. 存储简历的基本信息（文件名、大小、类型等）
 * 2. 存储文件在 RustFS 中的存储信息（Key 和 URL）
 * 3. 存储解析后的简历文本内容
 * 4. 通过文件哈希实现去重功能
 * 5. 跟踪简历的分析状态（PENDING/PROCESSING/COMPLETED/FAILED）
 *
 * 数据库表：resumes
 * 索引：fileHash（唯一索引，用于去重）
 */
@Entity
@Table(name = "resumes", indexes = {
    @Index(name = "idx_resume_hash", columnList = "fileHash", unique = true)
})
public class ResumeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;  // 主键ID，自增

    // 文件内容的 SHA-256 哈希值，用于去重
    // 相同哈希值的文件不会重复存储
    @Column(nullable = false, unique = true, length = 64)
    private String fileHash;

    // 原始文件名（用户上传时的文件名）
    @Column(nullable = false)
    private String originalFilename;

    // 文件大小（字节）
    private Long fileSize;

    // 文件类型（MIME 类型，如 application/pdf）
    private String contentType;

    // RustFS 存储的文件 Key（唯一标识）
    @Column(length = 500)
    private String storageKey;

    // RustFS 存储的文件 URL（可直接访问的链接）
    @Column(length = 1000)
    private String storageUrl;

    // 解析后的简历文本内容（纯文本，用于 AI 分析）
    @Column(columnDefinition = "TEXT")
    private String resumeText;

    // 上传时间（自动设置）
    @Column(nullable = false)
    private LocalDateTime uploadedAt;

    // 最后访问时间（每次访问时更新）
    private LocalDateTime lastAccessedAt;

    // 访问次数（用于统计和去重判断）
    private Integer accessCount = 0;

    // 分析状态（新上传时为 PENDING，异步分析完成后变为 COMPLETED）
    // 枚举值：PENDING, PROCESSING, COMPLETED, FAILED
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private AsyncTaskStatus analyzeStatus = AsyncTaskStatus.PENDING;

    // 分析错误信息（失败时记录，最多 500 字符）
    @Column(length = 500)
    private String analyzeError;

    /**
     * JPA 生命周期回调：实体创建前自动执行
     * 设置上传时间、最后访问时间和初始访问次数
     */
    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
        lastAccessedAt = LocalDateTime.now();
        accessCount = 1;
    }
    
    // ==================== Getters and Setters ====================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    /** 获取文件哈希值（用于去重） */
    public String getFileHash() {
        return fileHash;
    }

    public void setFileHash(String fileHash) {
        this.fileHash = fileHash;
    }

    /** 获取原始文件名 */
    public String getOriginalFilename() {
        return originalFilename;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFilename = originalFilename;
    }

    /** 获取文件大小（字节） */
    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    /** 获取文件类型（MIME 类型） */
    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    /** 获取 RustFS 存储 Key */
    public String getStorageKey() {
        return storageKey;
    }

    public void setStorageKey(String storageKey) {
        this.storageKey = storageKey;
    }

    /** 获取 RustFS 存储 URL */
    public String getStorageUrl() {
        return storageUrl;
    }

    public void setStorageUrl(String storageUrl) {
        this.storageUrl = storageUrl;
    }

    /** 获取解析后的简历文本 */
    public String getResumeText() {
        return resumeText;
    }

    public void setResumeText(String resumeText) {
        this.resumeText = resumeText;
    }

    /** 获取上传时间 */
    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(LocalDateTime uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    /** 获取最后访问时间 */
    public LocalDateTime getLastAccessedAt() {
        return lastAccessedAt;
    }

    public void setLastAccessedAt(LocalDateTime lastAccessedAt) {
        this.lastAccessedAt = lastAccessedAt;
    }

    /** 获取访问次数 */
    public Integer getAccessCount() {
        return accessCount;
    }

    public void setAccessCount(Integer accessCount) {
        this.accessCount = accessCount;
    }

    /**
     * 增加访问次数并更新最后访问时间
     * 用于去重时更新重复简历的访问统计
     */
    public void incrementAccessCount() {
        this.accessCount++;
        this.lastAccessedAt = LocalDateTime.now();
    }

    /** 获取分析状态 */
    public AsyncTaskStatus getAnalyzeStatus() {
        return analyzeStatus;
    }

    public void setAnalyzeStatus(AsyncTaskStatus analyzeStatus) {
        this.analyzeStatus = analyzeStatus;
    }

    /** 获取分析错误信息 */
    public String getAnalyzeError() {
        return analyzeError;
    }

    public void setAnalyzeError(String analyzeError) {
        this.analyzeError = analyzeError;
    }
}
