package interview.guide.modules.directhire.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.directhire.model.*;
import interview.guide.modules.directhire.repository.DirectHireCompanyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DirectHirePersistenceService {

    private final DirectHireCompanyRepository repository;

    /**
     * 按分类获取所有公司（按排序顺序）
     */
    public List<DirectHireCompanyEntity> findByCategory(CompanyCategory category) {
        return repository.findByCategoryOrderBySortOrderAsc(category);
    }

    /**
     * 按分类分页查询公司
     */
    public Page<DirectHireCompanyEntity> findByCategoryPaged(CompanyCategory category, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return repository.findByCategoryOrderBySortOrderAsc(category, pageable);
    }

    /**
     * 按分类搜索公司
     */
    public List<DirectHireCompanyEntity> searchByCategory(CompanyCategory category, String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return findByCategory(category);
        }
        return repository.findByCategoryAndCompanyNameContainingIgnoreCaseOrderBySortOrderAsc(category, keyword);
    }

    /**
     * 按分类搜索公司（分页）
     */
    public Page<DirectHireCompanyEntity> searchByCategoryPaged(CompanyCategory category, String keyword, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        if (keyword == null || keyword.isBlank()) {
            return repository.findByCategoryOrderBySortOrderAsc(category, pageable);
        }
        return repository.findByCategoryAndCompanyNameContainingIgnoreCaseOrderBySortOrderAsc(category, keyword, pageable);
    }

    /**
     * 根据ID查找公司
     */
    public DirectHireCompanyEntity findById(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.DIRECT_HIRE_COMPANY_NOT_FOUND, "公司不存在: " + id));
    }

    /**
     * 创建公司
     */
    @Transactional(rollbackFor = Exception.class)
    public DirectHireCompanyEntity create(CreateDirectHireRequest request) {
        if (repository.existsByCategoryAndCompanyNameIgnoreCase(request.category(), request.companyName())) {
            throw new BusinessException(ErrorCode.DIRECT_HIRE_COMPANY_ALREADY_EXISTS,
                "该分类下公司名称已存在: " + request.companyName());
        }

        DirectHireCompanyEntity entity = new DirectHireCompanyEntity();
        entity.setCategory(request.category());
        entity.setCompanyName(request.companyName());
        entity.setApplicationLink(request.applicationLink());
        entity.setReferralCode(request.referralCode());
        entity.setStatus(request.status() != null ? request.status() : ApplicationStatus.NOT_APPLIED);
        entity.setLastAccessDate(request.lastAccessDate());
        entity.setSortOrder(repository.findMaxSortOrderByCategory(request.category()) + 1);

        return repository.save(entity);
    }

    /**
     * 批量创建公司（用于导入）
     */
    @Transactional(rollbackFor = Exception.class)
    public List<DirectHireCompanyEntity> createBatch(CompanyCategory category, List<CreateDirectHireRequest> requests) {
        int startSortOrder = repository.findMaxSortOrderByCategory(category) + 1;
        List<DirectHireCompanyEntity> entities = new java.util.ArrayList<>();

        for (int i = 0; i < requests.size(); i++) {
            CreateDirectHireRequest request = requests.get(i);
            DirectHireCompanyEntity entity = new DirectHireCompanyEntity();
            entity.setCategory(category);
            entity.setCompanyName(request.companyName());
            entity.setApplicationLink(request.applicationLink());
            entity.setReferralCode(request.referralCode());
            entity.setStatus(request.status() != null ? request.status() : ApplicationStatus.NOT_APPLIED);
            entity.setLastAccessDate(request.lastAccessDate());
            entity.setSortOrder(startSortOrder + i);
            entities.add(entity);
        }

        return repository.saveAll(entities);
    }

    /**
     * 更新公司信息
     */
    @Transactional(rollbackFor = Exception.class)
    public DirectHireCompanyEntity update(Long id, UpdateDirectHireRequest request) {
        DirectHireCompanyEntity entity = findById(id);

        if (request.companyName() != null) {
            if (repository.existsByCategoryAndCompanyNameIgnoreCaseAndIdNot(
                    entity.getCategory(), request.companyName(), id)) {
                throw new BusinessException(ErrorCode.DIRECT_HIRE_COMPANY_ALREADY_EXISTS,
                    "该分类下公司名称已存在: " + request.companyName());
            }
            entity.setCompanyName(request.companyName());
        }

        if (request.applicationLink() != null) {
            entity.setApplicationLink(request.applicationLink());
        }

        if (request.referralCode() != null) {
            entity.setReferralCode(request.referralCode());
        }

        if (request.status() != null) {
            entity.setStatus(request.status());
        }

        if (request.lastAccessDate() != null) {
            entity.setLastAccessDate(request.lastAccessDate());
        }

        return repository.save(entity);
    }

    /**
     * 更新投递状态
     */
    @Transactional(rollbackFor = Exception.class)
    public DirectHireCompanyEntity updateStatus(Long id, ApplicationStatus status, java.time.LocalDate lastAccessDate) {
        DirectHireCompanyEntity entity = findById(id);
        entity.setStatus(status);
        if (lastAccessDate != null) {
            entity.setLastAccessDate(lastAccessDate);
        }
        return repository.save(entity);
    }

    /**
     * 更新排序
     */
    @Transactional(rollbackFor = Exception.class)
    public void updateSortOrder(List<UpdateSortOrderRequest.SortItem> items) {
        for (UpdateSortOrderRequest.SortItem item : items) {
            DirectHireCompanyEntity entity = findById(item.id());
            entity.setSortOrder(item.sortOrder());
            repository.save(entity);
        }
    }

    /**
     * 删除公司
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new BusinessException(ErrorCode.DIRECT_HIRE_COMPANY_NOT_FOUND, "公司不存在: " + id);
        }
        repository.deleteById(id);
    }

    /**
     * 清空指定分类的所有公司
     */
    @Transactional(rollbackFor = Exception.class)
    public int deleteByCategory(CompanyCategory category) {
        return repository.deleteByCategory(category);
    }
}
