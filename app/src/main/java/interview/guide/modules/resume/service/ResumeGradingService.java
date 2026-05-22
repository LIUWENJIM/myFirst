package interview.guide.modules.resume.service;

import interview.guide.common.ai.LlmProviderRegistry;
import interview.guide.common.ai.StructuredOutputInvoker;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.interview.model.ResumeAnalysisResponse;
import interview.guide.modules.interview.model.ResumeAnalysisResponse.ScoreDetail;
import interview.guide.modules.interview.model.ResumeAnalysisResponse.Suggestion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 简历评分服务
 * 使用 Spring AI 调用 LLM 对简历进行评分和建议
 *
 * 核心功能：
 * 1. 加载提示词模板（系统提示词 + 用户提示词）
 * 2. 调用 LLM 进行简历分析
 * 3. 使用结构化输出确保返回格式一致
 * 4. 解析 AI 响应并转换为业务对象
 * 5. 提供错误处理和降级机制
 *
 * 评分维度：
 * - 内容完整性 (contentScore): 0-25 分
 * - 结构清晰度 (structureScore): 0-20 分
 * - 技能匹配度 (skillMatchScore): 0-25 分
 * - 表达专业性 (expressionScore): 0-15 分
 * - 项目经验 (projectScore): 0-15 分
 * - 总分 (overallScore): 0-100 分
 */
@Service
public class ResumeGradingService {

    private static final Logger log = LoggerFactory.getLogger(ResumeGradingService.class);

    private final LlmProviderRegistry llmProviderRegistry;  // LLM 提供商注册中心，获取 ChatClient
    private final PromptTemplate systemPromptTemplate;      // 系统提示词模板
    private final PromptTemplate userPromptTemplate;        // 用户提示词模板
    private final BeanOutputConverter<ResumeAnalysisResponseDTO> outputConverter;  // 结构化输出转换器
    private final StructuredOutputInvoker structuredOutputInvoker;  // 结构化输出调用器（含重试机制）

    // 中间 DTO 用于接收 AI 响应
    // AI 返回的 JSON 会自动映射到这个 record
    private record ResumeAnalysisResponseDTO(
        int overallScore,           // 总分 (0-100)
        ScoreDetailDTO scoreDetail, // 各维度评分详情
        String summary,             // 简历摘要
        List<String> strengths,     // 优点列表
        List<SuggestionDTO> suggestions  // 改进建议列表
    ) {}

    // 各维度评分明细
    private record ScoreDetailDTO(
        int contentScore,      // 内容完整性评分 (0-25)
        int structureScore,    // 结构清晰度评分 (0-20)
        int skillMatchScore,   // 技能匹配度评分 (0-25)
        int expressionScore,   // 表达专业性评分 (0-15)
        int projectScore       // 项目经验评分 (0-15)
    ) {}

    // 改进建议项
    private record SuggestionDTO(
        String category,      // 建议类别（如"内容"、"结构"、"技能"等）
        String priority,      // 优先级（"高"、"中"、"低"）
        String issue,         // 问题描述
        String recommendation // 改进建议
    ) {}
    
    /**
     * 构造函数，初始化提示词模板和输出转换器
     *
     * @param llmProviderRegistry      LLM 提供商注册中心
     * @param structuredOutputInvoker  结构化输出调用器（含重试机制）
     * @param properties               简历分析配置属性（提示词路径）
     * @param resourceLoader           资源加载器，用于加载 classpath 下的提示词文件
     * @throws IOException 如果提示词文件加载失败
     */
    public ResumeGradingService(
            LlmProviderRegistry llmProviderRegistry,
            StructuredOutputInvoker structuredOutputInvoker,
            ResumeAnalysisProperties properties,
            ResourceLoader resourceLoader) throws IOException {
        this.llmProviderRegistry = llmProviderRegistry;
        this.structuredOutputInvoker = structuredOutputInvoker;

        // 加载系统提示词模板（定义 AI 的角色和评分规则）
        this.systemPromptTemplate = new PromptTemplate(
            resourceLoader.getResource(properties.getSystemPromptPath())
                .getContentAsString(StandardCharsets.UTF_8)
        );

        // 加载用户提示词模板（包含简历文本的占位符）
        this.userPromptTemplate = new PromptTemplate(
            resourceLoader.getResource(properties.getUserPromptPath())
                .getContentAsString(StandardCharsets.UTF_8)
        );

        // 初始化结构化输出转换器（将 AI 的 JSON 响应映射到 DTO）
        this.outputConverter = new BeanOutputConverter<>(ResumeAnalysisResponseDTO.class);
    }
    
    /**
     * 分析简历并返回评分和建议
     *
     * 分析流程：
     * 1. 渲染系统提示词（定义 AI 角色和评分规则）
     * 2. 渲染用户提示词（填充简历文本）
     * 3. 添加结构化输出格式指令
     * 4. 调用 LLM 进行分析（含重试机制）
     * 5. 解析 AI 响应并转换为业务对象
     *
     * @param resumeText 简历文本内容（纯文本，已通过解析服务提取）
     * @return 分析结果，包含总分、各维度评分、摘要、优点和改进建议
     */
    public ResumeAnalysisResponse analyzeResume(String resumeText) {
        log.info("开始分析简历，文本长度: {} 字符", resumeText.length());

        try {
            // 1. 渲染系统提示词（定义 AI 的角色、评分规则和输出格式）
            String systemPrompt = systemPromptTemplate.render();

            // 2. 渲染用户提示词（将简历文本填充到模板中）
            Map<String, Object> variables = new HashMap<>();
            variables.put("resumeText", resumeText);
            String userPrompt = userPromptTemplate.render(variables);

            // 3. 添加结构化输出格式指令到系统提示词（确保 AI 返回 JSON 格式）
            String systemPromptWithFormat = systemPrompt + "\n\n" + outputConverter.getFormat();

            // 4. 调用 LLM 进行分析（使用结构化输出调用器，含重试机制）
            ResumeAnalysisResponseDTO dto;
            try {
                ChatClient chatClient = llmProviderRegistry.getDefaultChatClient();
                dto = structuredOutputInvoker.invoke(
                    chatClient,
                    systemPromptWithFormat,
                    userPrompt,
                    outputConverter,
                    ErrorCode.RESUME_ANALYSIS_FAILED,
                    "简历分析失败：",
                    "简历分析",
                    log
                );
                log.debug("AI响应解析成功: overallScore={}", dto.overallScore());
            } catch (Exception e) {
                log.error("简历分析AI调用失败: {}", e.getMessage(), e);
                throw new BusinessException(ErrorCode.RESUME_ANALYSIS_FAILED, "简历分析失败：" + e.getMessage());
            }

            // 5. 转换为业务对象
            ResumeAnalysisResponse result = convertToResponse(dto, resumeText);
            log.info("简历分析完成，总分: {}", result.overallScore());

            return result;

        } catch (Exception e) {
            log.error("简历分析失败: {}", e.getMessage(), e);
            // 返回错误响应（降级处理，确保不会因为 AI 调用失败而阻塞流程）
            return createErrorResponse(resumeText, e.getMessage());
        }
    }
    
    /**
     * 转换 DTO 为业务对象
     *
     * 将 AI 返回的 DTO 转换为业务层使用的 ResumeAnalysisResponse
     * 包括评分详情、优点列表和改进建议的转换
     *
     * @param dto          AI 返回的 DTO 对象
     * @param originalText 原始简历文本（用于返回给前端）
     * @return 转换后的业务对象
     */
    private ResumeAnalysisResponse convertToResponse(ResumeAnalysisResponseDTO dto, String originalText) {
        // 转换评分详情
        ScoreDetail scoreDetail = new ScoreDetail(
            dto.scoreDetail().contentScore(),
            dto.scoreDetail().structureScore(),
            dto.scoreDetail().skillMatchScore(),
            dto.scoreDetail().expressionScore(),
            dto.scoreDetail().projectScore()
        );

        // 转换改进建议列表
        List<Suggestion> suggestions = dto.suggestions().stream()
            .map(s -> new Suggestion(s.category(), s.priority(), s.issue(), s.recommendation()))
            .toList();

        return new ResumeAnalysisResponse(
            dto.overallScore(),
            scoreDetail,
            dto.summary(),
            dto.strengths(),
            suggestions,
            originalText
        );
    }

    /**
     * 创建错误响应（降级处理）
     *
     * 当 AI 分析失败时，返回一个默认的错误响应
     * 确保不会因为 AI 调用失败而阻塞整个流程
     *
     * @param originalText 原始简历文本
     * @param errorMessage 错误信息
     * @return 包含错误信息的默认响应
     */
    private ResumeAnalysisResponse createErrorResponse(String originalText, String errorMessage) {
        return new ResumeAnalysisResponse(
            0,
            new ScoreDetail(0, 0, 0, 0, 0),
            "分析过程中出现错误: " + errorMessage,
            List.of(),
            List.of(new Suggestion(
                "系统",
                "高",
                "AI分析服务暂时不可用",
                "请稍后重试，或检查AI服务是否正常运行"
            )),
            originalText
        );
    }
}
