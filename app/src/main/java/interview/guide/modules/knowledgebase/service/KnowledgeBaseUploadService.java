package interview.guide.modules.knowledgebase.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.infrastructure.file.FileHashService;
import interview.guide.infrastructure.file.FileStorageService;
import interview.guide.infrastructure.file.FileValidationService;
import interview.guide.modules.knowledgebase.listener.VectorizeStreamProducer;
import interview.guide.modules.knowledgebase.model.KnowledgeBaseEntity;
import interview.guide.modules.knowledgebase.model.VectorStatus;
import interview.guide.modules.knowledgebase.repository.KnowledgeBaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Optional;

/**
 * 知识库上传服务
 * 处理知识库上传、解析的业务逻辑
 * 向量化改为异步处理，通过 Redis Stream 实现
 *
 * 主要流程：
 * 1. 验证文件（大小、类型）
 * 2. 检查是否重复上传（基于文件哈希去重）
 * 3. 解析知识库文本内容
 * 4. 上传文件到 RustFS 对象存储
 * 5. 保存知识库记录到数据库（状态为 PENDING）
 * 6. 发送向量化任务到 Redis Stream（异步处理）
 * 7. 返回结果（前端可轮询获取向量化状态）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeBaseUploadService {

    private final KnowledgeBaseParseService parseService;           // 知识库解析服务，负责提取文本内容
    private final KnowledgeBasePersistenceService persistenceService; // 持久化服务，负责数据库操作
    private final FileStorageService storageService;                // 文件存储服务，负责上传到 RustFS
    private final KnowledgeBaseRepository knowledgeBaseRepository;  // 知识库仓库，用于数据库查询
    private final FileValidationService fileValidationService;      // 文件验证服务，检查文件大小和类型
    private final FileHashService fileHashService;                  // 文件哈希服务，用于去重
    private final VectorizeStreamProducer vectorizeStreamProducer;  // 异步向量化任务生产者，发送到 Redis Stream

    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024; // 最大文件大小限制：50MB
    
    /**
     * 上传知识库文件
     *
     * 上传流程：
     * 1. 验证文件大小和类型
     * 2. 检查是否重复上传（基于文件哈希）
     * 3. 解析知识库文本内容
     * 4. 上传文件到 RustFS 对象存储
     * 5. 保存知识库记录到数据库（状态为 PENDING）
     * 6. 发送向量化任务到 Redis Stream（异步处理）
     * 7. 返回结果（前端可轮询获取向量化状态）
     *
     * @param file     知识库文件（支持 PDF、DOCX、DOC、TXT、MD 等格式）
     * @param name     知识库名称（可选，如果为空则从文件名提取）
     * @param category 分类（可选）
     * @return 上传结果 Map，包含：
     *         - knowledgeBase: 知识库基本信息（id, name, category, fileSize, contentLength, vectorStatus）
     *         - storage: 存储信息（fileKey, fileUrl）
     *         - duplicate: 是否为重复上传
     * @throws BusinessException 文件验证失败或解析失败时抛出
     */
    public Map<String, Object> uploadKnowledgeBase(MultipartFile file, String name, String category) {
        // 1. 验证文件大小（最大 50MB）
        fileValidationService.validateFile(file, MAX_FILE_SIZE, "知识库");

        String fileName = file.getOriginalFilename();
        log.info("收到知识库上传请求: {}, 大小: {} bytes, category: {}", fileName, file.getSize(), category);

        // 2. 验证文件类型（检查是否在允许的类型列表中）
        String contentType = parseService.detectContentType(file);
        validateContentType(contentType, fileName);

        // 3. 检查知识库是否已存在（基于文件哈希去重）
        String fileHash = fileHashService.calculateHash(file);
        Optional<KnowledgeBaseEntity> existingKb = knowledgeBaseRepository.findByFileHash(fileHash);
        if (existingKb.isPresent()) {
            log.info("检测到重复知识库: hash={}", fileHash);
            return persistenceService.handleDuplicateKnowledgeBase(existingKb.get(), fileHash);
        }

        // 4. 解析知识库文本内容（用于向量化）
        String content = parseService.parseContent(file);
        if (content == null || content.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "无法从文件中提取文本内容，请确保文件格式正确");
        }

        // 5. 保存文件到 RustFS 对象存储
        String fileKey = storageService.uploadKnowledgeBase(file);
        String fileUrl = storageService.getFileUrl(fileKey);
        log.info("知识库已存储到RustFS: {}", fileKey);

        // 6. 保存知识库元数据到数据库（状态为 PENDING，等待异步向量化）
        KnowledgeBaseEntity savedKb = persistenceService.saveKnowledgeBase(file, name, category, fileKey, fileUrl, fileHash);

        // 7. 发送向量化任务到 Redis Stream（异步处理，不阻塞上传流程）
        vectorizeStreamProducer.sendVectorizeTask(savedKb.getId(), content);

        log.info("知识库上传完成，向量化任务已入队: {}, kbId={}", fileName, savedKb.getId());

        // 8. 返回结果（状态为 PENDING，前端可轮询获取最新状态）
        return Map.of(
            "knowledgeBase", Map.of(
                "id", savedKb.getId(),
                "name", savedKb.getName(),
                "category", savedKb.getCategory() != null ? savedKb.getCategory() : "",
                "fileSize", savedKb.getFileSize(),
                "contentLength", content.length(),
                "vectorStatus", VectorStatus.PENDING.name()
            ),
            "storage", Map.of(
                "fileKey", fileKey,
                "fileUrl", fileUrl
            ),
            "duplicate", false
        );
    }

    /**
     * 验证文件类型是否在允许列表中
     *
     * @param contentType 检测到的 MIME 类型
     * @param fileName    文件名（用于日志）
     * @throws BusinessException 如果文件类型不支持
     */
    private void validateContentType(String contentType, String fileName) {
        fileValidationService.validateContentType(
            contentType,
            fileName,
            fileValidationService::isKnowledgeBaseMimeType,
            fileValidationService::isMarkdownExtension,
            "不支持的文件类型: " + contentType + "，支持的类型：PDF、DOCX、DOC、TXT、MD等"
        );
    }

    /**
     * 重新向量化知识库（手动重试）
     *
     * 从 RustFS 重新下载文件并发送向量化任务到 Redis Stream
     * 如果数据库中没有缓存的文本，会尝试重新从存储下载并解析
     *
     * @param kbId 知识库ID
     * @throws BusinessException 如果知识库不存在或无法获取文本内容
     */
    public void revectorize(Long kbId) {
        KnowledgeBaseEntity kb = knowledgeBaseRepository.findById(kbId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "知识库不存在"));

        log.info("开始重新向量化知识库: kbId={}, name={}", kbId, kb.getName());

        // 1. 下载文件并解析内容
        String content = parseService.downloadAndParseContent(kb.getStorageKey(), kb.getOriginalFilename());
        if (content == null || content.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "无法从文件中提取文本内容");
        }

        // 2. 更新状态为 PENDING（通过单独的 Service 保证事务生效）
        persistenceService.updateVectorStatusToPending(kbId);

        // 3. 发送向量化任务到 Redis Stream
        vectorizeStreamProducer.sendVectorizeTask(kbId, content);

        log.info("重新向量化任务已发送: kbId={}", kbId);
    }
}

