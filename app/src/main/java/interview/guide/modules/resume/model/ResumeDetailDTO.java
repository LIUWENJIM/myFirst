package interview.guide.modules.resume.model;

import interview.guide.common.model.AsyncTaskStatus;
import interview.guide.modules.interview.model.InterviewHistoryItemDTO;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 简历详情 DTO
 *
 * 用于简历详情页面展示，包含简历的完整信息
 * 包括基本信息、解析文本、分析历史和面试历史
 *
 * 使用 Java Record 实现，不可变数据结构
 * 嵌套 AnalysisHistoryDTO 记录分析历史
 */
public record ResumeDetailDTO(
    Long id,                              // 简历ID
    String filename,                      // 原始文件名
    Long fileSize,                        // 文件大小（字节）
    String contentType,                   // 文件类型（MIME 类型）
    String storageUrl,                    // RustFS 存储 URL
    LocalDateTime uploadedAt,             // 上传时间
    Integer accessCount,                  // 访问次数
    String resumeText,                    // 解析后的简历文本内容
    AsyncTaskStatus analyzeStatus,        // 分析状态
    String analyzeError,                  // 分析错误信息
    List<AnalysisHistoryDTO> analyses,    // 分析历史记录列表
    List<InterviewHistoryItemDTO> interviews // 面试历史记录列表
) {
    /**
     * 分析历史 DTO
     *
     * 存储单次分析的详细结果
     * 包含各维度评分、摘要、优点和建议
     */
    public record AnalysisHistoryDTO(
        Long id,                          // 分析记录ID
        Integer overallScore,             // 总分 (0-100)
        Integer contentScore,             // 内容完整性评分 (0-25)
        Integer structureScore,           // 结构清晰度评分 (0-20)
        Integer skillMatchScore,          // 技能匹配度评分 (0-25)
        Integer expressionScore,          // 表达专业性评分 (0-15)
        Integer projectScore,             // 项目经验评分 (0-15)
        String summary,                   // 简历摘要
        LocalDateTime analyzedAt,         // 分析时间
        List<String> strengths,           // 优点列表
        List<Object> suggestions          // 改进建议列表
    ) {}
}

