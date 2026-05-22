package interview.guide.modules.resume.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.infrastructure.file.FileStorageService;
import interview.guide.modules.interview.service.InterviewPersistenceService;
import interview.guide.modules.resume.model.ResumeEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 简历删除服务
 * 处理简历删除的业务逻辑
 *
 * 删除流程：
 * 1. 获取简历信息（用于删除存储文件）
 * 2. 删除 RustFS 中的存储文件
 * 3. 删除关联的面试会话（会自动删除面试答案）
 * 4. 删除数据库记录（包括简历和分析记录）
 *
 * 注意：删除操作是不可逆的，请谨慎使用
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeDeleteService {

    private final ResumePersistenceService persistenceService;      // 简历持久化服务，负责数据库操作
    private final InterviewPersistenceService interviewPersistenceService; // 面试持久化服务，删除关联的面试会话
    private final FileStorageService storageService;                // 文件存储服务，删除 RustFS 中的文件

    /**
     * 删除简历及其所有关联数据
     *
     * 删除顺序：
     * 1. 先删除存储文件（即使失败也继续删除数据库记录）
     * 2. 删除关联的面试会话（会自动删除面试答案）
     * 3. 删除简历记录和分析记录
     *
     * @param id 简历ID
     * @throws BusinessException 如果简历不存在
     */
    public void deleteResume(Long id) {
        log.info("收到删除简历请求: id={}", id);

        // 获取简历信息（用于删除存储文件）
        ResumeEntity resume = persistenceService.findById(id)
            .orElseThrow(() -> new BusinessException(
                ErrorCode.RESUME_NOT_FOUND));

        // 1. 删除 RustFS 中的存储文件（FileStorageService 已内置存在性检查）
        try {
            storageService.deleteResume(resume.getStorageKey());
        } catch (Exception e) {
            // 即使删除存储文件失败，也继续删除数据库记录
            log.warn("删除存储文件失败，继续删除数据库记录: {}", e.getMessage());
        }

        // 2. 删除关联的面试会话（会自动删除面试答案）
        interviewPersistenceService.deleteSessionsByResumeId(id);

        // 3. 删除数据库记录（包括简历和分析记录）
        persistenceService.deleteResume(id);

        log.info("简历删除完成: id={}", id);
    }
}

