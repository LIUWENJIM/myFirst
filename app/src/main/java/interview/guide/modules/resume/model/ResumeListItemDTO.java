package interview.guide.modules.resume.model;

import interview.guide.common.model.AsyncTaskStatus;

import java.time.LocalDateTime;

/**
 * 简历列表项 DTO
 *
 * 用于简历列表页面展示，包含简历的基本信息和统计数据
 * 使用 Java Record 实现，不可变数据结构
 *
 * 包含字段：
 * - 简历基本信息（ID、文件名、大小、上传时间）
 * - 访问统计（访问次数）
 * - 分析信息（最新分数、最后分析时间、分析状态）
 * - 面试统计（面试次数）
 */
public record ResumeListItemDTO(
    Long id,                      // 简历ID
    String filename,              // 原始文件名
    Long fileSize,                // 文件大小（字节）
    LocalDateTime uploadedAt,     // 上传时间
    Integer accessCount,          // 访问次数
    Integer latestScore,          // 最新分析分数（可能为 null，表示未分析）
    LocalDateTime lastAnalyzedAt, // 最后分析时间（可能为 null）
    Integer interviewCount,       // 面试次数
    AsyncTaskStatus analyzeStatus, // 分析状态（PENDING/PROCESSING/COMPLETED/FAILED）
    String analyzeError           // 分析错误信息（失败时有值）
) {}

