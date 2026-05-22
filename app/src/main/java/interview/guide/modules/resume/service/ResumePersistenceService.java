package interview.guide.modules.resume.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.infrastructure.file.FileHashService;
import interview.guide.infrastructure.mapper.ResumeMapper;
import interview.guide.modules.interview.model.ResumeAnalysisResponse;
import interview.guide.modules.resume.model.ResumeAnalysisEntity;
import interview.guide.modules.resume.model.ResumeEntity;
import interview.guide.modules.resume.repository.ResumeAnalysisRepository;
import interview.guide.modules.resume.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

/**
 * 简历持久化服务
 * 简历和评测结果的持久化，简历删除时删除所有关联数据
 *
 * 主要职责：
 * 1. 简历的 CRUD 操作
 * 2. 简历分析结果的保存和查询
 * 3. 文件哈希计算和去重检查
 * 4. 实体与 DTO 之间的转换
 * 5. 简历删除时的级联删除（分析记录、面试会话等）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumePersistenceService {

    private final ResumeRepository resumeRepository;           // 简历仓库，负责简历实体的数据库操作
    private final ResumeAnalysisRepository analysisRepository; // 分析记录仓库，负责分析结果的数据库操作
    private final ObjectMapper objectMapper;                   // JSON 序列化工具，用于解析优点和建议
    private final ResumeMapper resumeMapper;                   // MapStruct 映射器，用于实体和 DTO 转换
    private final FileHashService fileHashService;             // 文件哈希服务，用于计算文件哈希值
    
    /**
     * 检查简历是否已存在（基于文件内容哈希）
     *
     * 使用 SHA-256 哈希算法计算文件内容的哈希值
     * 如果哈希值已存在，说明是重复上传，返回已有的简历实体
     * 同时更新访问次数和最后访问时间
     *
     * @param file 上传的文件
     * @return 如果存在返回已有的简历实体，否则返回空
     */
    public Optional<ResumeEntity> findExistingResume(MultipartFile file) {
        try {
            // 计算文件内容的 SHA-256 哈希值
            String fileHash = fileHashService.calculateHash(file);
            Optional<ResumeEntity> existing = resumeRepository.findByFileHash(fileHash);

            if (existing.isPresent()) {
                log.info("检测到重复简历: hash={}", fileHash);
                // 更新访问次数和最后访问时间
                ResumeEntity resume = existing.get();
                resume.incrementAccessCount();
                resumeRepository.save(resume);
            }

            return existing;
        } catch (Exception e) {
            log.error("检查简历重复时出错: {}", e.getMessage());
            return Optional.empty();
        }
    }
    
    /**
     * 保存新简历到数据库
     *
     * 保存简历的基本信息、存储信息和解析后的文本内容
     * 使用事务确保数据一致性
     *
     * @param file        上传的文件（用于获取文件名、大小、类型等信息）
     * @param resumeText  解析后的简历文本内容
     * @param storageKey  RustFS 存储键
     * @param storageUrl  RustFS 存储 URL
     * @return 保存后的简历实体（包含生成的 ID）
     * @throws BusinessException 如果保存失败
     */
    @Transactional(rollbackFor = Exception.class)
    public ResumeEntity saveResume(MultipartFile file, String resumeText,
                                   String storageKey, String storageUrl) {
        try {
            // 计算文件哈希值（用于去重）
            String fileHash = fileHashService.calculateHash(file);

            // 创建简历实体并设置属性
            ResumeEntity resume = new ResumeEntity();
            resume.setFileHash(fileHash);
            resume.setOriginalFilename(file.getOriginalFilename());
            resume.setFileSize(file.getSize());
            resume.setContentType(file.getContentType());
            resume.setStorageKey(storageKey);
            resume.setStorageUrl(storageUrl);
            resume.setResumeText(resumeText);

            // 保存到数据库
            ResumeEntity saved = resumeRepository.save(resume);
            log.info("简历已保存: id={}, hash={}", saved.getId(), fileHash);

            return saved;
        } catch (Exception e) {
            log.error("保存简历失败: {}", e.getMessage(), e);
            throw new BusinessException(ErrorCode.RESUME_UPLOAD_FAILED, "保存简历失败");
        }
    }
    
    /**
     * 保存简历评测结果到数据库
     *
     * 保存流程：
     * 1. 使用 MapStruct 映射基础字段
     * 2. 手动序列化 JSON 字段（优点列表和建议列表）
     * 3. 保存到数据库
     *
     * @param resume    关联的简历实体
     * @param analysis  AI 分析结果
     * @return 保存后的分析记录实体
     * @throws BusinessException 如果序列化或保存失败
     */
    @Transactional(rollbackFor = Exception.class)
    public ResumeAnalysisEntity saveAnalysis(ResumeEntity resume, ResumeAnalysisResponse analysis) {
        try {
            // 使用 MapStruct 映射基础字段
            ResumeAnalysisEntity entity = resumeMapper.toAnalysisEntity(analysis);
            entity.setResume(resume);

            // JSON 字段需要手动序列化（优点列表和建议列表）
            entity.setStrengthsJson(objectMapper.writeValueAsString(analysis.strengths()));
            entity.setSuggestionsJson(objectMapper.writeValueAsString(analysis.suggestions()));

            // 保存到数据库
            ResumeAnalysisEntity saved = analysisRepository.save(entity);
            log.info("简历评测结果已保存: analysisId={}, resumeId={}, score={}",
                    saved.getId(), resume.getId(), analysis.overallScore());

            return saved;
        } catch (JacksonException e) {
            log.error("序列化评测结果失败: {}", e.getMessage(), e);
            throw new BusinessException(ErrorCode.RESUME_ANALYSIS_FAILED, "保存评测结果失败");
        }
    }
    
    /**
     * 获取简历的最新评测结果
     *
     * 按分析时间倒序查询，返回最新的分析记录
     *
     * @param resumeId 简历ID
     * @return 最新的分析记录实体，如果不存在返回空
     */
    public Optional<ResumeAnalysisEntity> getLatestAnalysis(Long resumeId) {
        return Optional.ofNullable(analysisRepository.findFirstByResumeIdOrderByAnalyzedAtDesc(resumeId));
    }

    /**
     * 获取简历的最新评测结果（返回 DTO）
     *
     * 将实体转换为 DTO 格式，包含解析后的 JSON 字段
     *
     * @param resumeId 简历ID
     * @return 最新的分析结果 DTO，如果不存在返回空
     */
    public Optional<ResumeAnalysisResponse> getLatestAnalysisAsDTO(Long resumeId) {
        return getLatestAnalysis(resumeId).map(this::entityToDTO);
    }

    /**
     * 获取所有简历列表
     *
     * @return 所有简历实体列表
     */
    public List<ResumeEntity> findAllResumes() {
        return resumeRepository.findAll();
    }

    /**
     * 获取简历的所有评测记录
     *
     * 按分析时间倒序查询，返回所有历史分析记录
     *
     * @param resumeId 简历ID
     * @return 分析记录列表（按时间倒序）
     */
    public List<ResumeAnalysisEntity> findAnalysesByResumeId(Long resumeId) {
        return analysisRepository.findByResumeIdOrderByAnalyzedAtDesc(resumeId);
    }
    
    /**
     * 将分析记录实体转换为 DTO
     *
     * 转换流程：
     * 1. 解析 JSON 字段（优点列表和建议列表）
     * 2. 使用 MapStruct 映射评分详情
     * 3. 组装成完整的 DTO 对象
     *
     * @param entity 分析记录实体
     * @return 转换后的 DTO 对象
     * @throws BusinessException 如果 JSON 解析失败
     */
    public ResumeAnalysisResponse entityToDTO(ResumeAnalysisEntity entity) {
        try {
            // 解析优点列表 JSON
            List<String> strengths = objectMapper.readValue(
                entity.getStrengthsJson() != null ? entity.getStrengthsJson() : "[]",
                    new TypeReference<>() {
                    }
            );

            // 解析改进建议列表 JSON
            List<ResumeAnalysisResponse.Suggestion> suggestions = objectMapper.readValue(
                entity.getSuggestionsJson() != null ? entity.getSuggestionsJson() : "[]",
                    new TypeReference<>() {
                    }
            );

            // 组装 DTO 对象
            return new ResumeAnalysisResponse(
                entity.getOverallScore(),
                resumeMapper.toScoreDetail(entity),  // 使用 MapStruct 自动映射评分详情
                entity.getSummary(),
                strengths,
                suggestions,
                entity.getResume().getResumeText()
            );
        } catch (JacksonException e) {
            log.error("反序列化评测结果失败: {}", e.getMessage());
            throw new BusinessException(ErrorCode.RESUME_ANALYSIS_FAILED, "获取评测结果失败");
        }
    }

    /**
     * 根据 ID 获取简历
     *
     * @param id 简历ID
     * @return 简历实体，如果不存在返回空
     */
    public Optional<ResumeEntity> findById(Long id) {
        return resumeRepository.findById(id);
    }
    
    /**
     * 删除简历及其所有关联数据
     *
     * 删除顺序：
     * 1. 删除所有简历分析记录
     * 2. 删除简历实体（面试会话会在服务层删除）
     *
     * 注意：面试会话的删除由 ResumeDeleteService 负责
     *
     * @param id 简历ID
     * @throws BusinessException 如果简历不存在
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteResume(Long id) {
        Optional<ResumeEntity> resumeOpt = resumeRepository.findById(id);
        if (resumeOpt.isEmpty()) {
            throw new BusinessException(ErrorCode.RESUME_NOT_FOUND);
        }

        ResumeEntity resume = resumeOpt.get();

        // 1. 删除所有简历分析记录
        List<ResumeAnalysisEntity> analyses = analysisRepository.findByResumeIdOrderByAnalyzedAtDesc(id);
        if (!analyses.isEmpty()) {
            analysisRepository.deleteAll(analyses);
            log.info("已删除 {} 条简历分析记录", analyses.size());
        }

        // 2. 删除简历实体（面试会话会在服务层删除）
        resumeRepository.delete(resume);
        log.info("简历已删除: id={}, filename={}", id, resume.getOriginalFilename());
    }
}
