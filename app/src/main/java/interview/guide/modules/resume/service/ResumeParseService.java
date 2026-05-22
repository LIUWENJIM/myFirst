package interview.guide.modules.resume.service;

import interview.guide.infrastructure.file.ContentTypeDetectionService;
import interview.guide.infrastructure.file.DocumentParseService;
import interview.guide.infrastructure.file.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * 简历解析服务
 * 委托给通用的 DocumentParseService 处理
 *
 * 本服务是简历模块的解析入口，负责：
 * 1. 解析上传的简历文件，提取文本内容
 * 2. 支持多种文件格式（PDF、DOCX、DOC、TXT、MD 等）
 * 3. 检测文件的 MIME 类型
 * 4. 从存储下载文件并解析内容
 *
 * 实际解析逻辑由 infrastructure.file.DocumentParseService 实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeParseService {

    private final DocumentParseService documentParseService;           // 通用文档解析服务，使用 Apache Tika
    private final ContentTypeDetectionService contentTypeDetectionService; // MIME 类型检测服务
    private final FileStorageService storageService;                   // 文件存储服务，用于下载文件

    /**
     * 解析上传的简历文件，提取文本内容
     *
     * 使用 Apache Tika 解析多种格式的文件，提取纯文本内容
     * 支持的格式：PDF、DOCX、DOC、TXT、MD 等
     *
     * @param file 上传的文件（MultipartFile）
     * @return 提取的文本内容，如果解析失败返回 null
     */
    public String parseResume(MultipartFile file) {
        log.info("开始解析简历文件: {}", file.getOriginalFilename());
        return documentParseService.parseContent(file);
    }

    /**
     * 解析字节数组形式的简历文件
     *
     * 当文件已经以字节数组形式存在时使用此方法
     * 例如从存储下载后的文件内容
     *
     * @param fileBytes 文件字节数组
     * @param fileName  原始文件名（用于日志记录和文件类型判断）
     * @return 提取的文本内容，如果解析失败返回 null
     */
    public String parseResume(byte[] fileBytes, String fileName) {
        log.info("开始解析简历文件（从字节数组）: {}", fileName);
        return documentParseService.parseContent(fileBytes, fileName);
    }

    /**
     * 从存储下载文件并解析内容
     *
     * 使用场景：重新分析简历时，从 RustFS 下载文件并解析
     *
     * @param storageKey       RustFS 存储键（文件在存储中的唯一标识）
     * @param originalFilename 原始文件名（用于日志和文件类型判断）
     * @return 提取的文本内容，如果下载或解析失败返回 null
     */
    public String downloadAndParseContent(String storageKey, String originalFilename) {
        log.info("从存储下载并解析简历文件: {}", originalFilename);
        return documentParseService.downloadAndParseContent(storageService, storageKey, originalFilename);
    }

    /**
     * 检测文件的 MIME 类型
     *
     * 使用 ContentTypeDetectionService 检测文件的真实 MIME 类型
     * 用于验证文件类型是否在允许列表中
     *
     * @param file 上传的文件
     * @return 检测到的 MIME 类型，如 "application/pdf"、"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
     */
    public String detectContentType(MultipartFile file) {
        return contentTypeDetectionService.detectContentType(file);
    }
}
