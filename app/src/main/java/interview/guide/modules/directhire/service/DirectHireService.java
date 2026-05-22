package interview.guide.modules.directhire.service;

import interview.guide.common.result.PageResponse;
import interview.guide.modules.directhire.model.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DirectHireService {

    private final DirectHirePersistenceService persistenceService;

    /**
     * 按分类获取公司列表
     */
    public List<DirectHireCompanyDTO> getCompanies(CompanyCategory category, String search) {
        List<DirectHireCompanyEntity> entities = persistenceService.searchByCategory(category, search);
        return entities.stream()
            .map(this::toDTO)
            .toList();
    }

    /**
     * 按分类分页获取公司列表
     */
    public PageResponse<DirectHireCompanyDTO> getCompaniesPaged(CompanyCategory category, String search, int page, int size) {
        Page<DirectHireCompanyEntity> pageResult = persistenceService.searchByCategoryPaged(category, search, page, size);
        List<DirectHireCompanyDTO> content = pageResult.getContent().stream()
            .map(this::toDTO)
            .toList();
        return PageResponse.of(content, page, size, pageResult.getTotalElements());
    }

    /**
     * 根据ID获取公司
     */
    public DirectHireCompanyDTO getCompany(Long id) {
        DirectHireCompanyEntity entity = persistenceService.findById(id);
        return toDTO(entity);
    }

    /**
     * 创建公司
     */
    public DirectHireCompanyDTO createCompany(CreateDirectHireRequest request) {
        DirectHireCompanyEntity entity = persistenceService.create(request);
        return toDTO(entity);
    }

    /**
     * 批量创建公司（用于导入）
     */
    public List<DirectHireCompanyDTO> createBatch(CompanyCategory category, List<CreateDirectHireRequest> requests) {
        List<DirectHireCompanyEntity> entities = persistenceService.createBatch(category, requests);
        return entities.stream()
            .map(this::toDTO)
            .toList();
    }

    /**
     * 更新公司信息
     */
    public DirectHireCompanyDTO updateCompany(Long id, UpdateDirectHireRequest request) {
        DirectHireCompanyEntity entity = persistenceService.update(id, request);
        return toDTO(entity);
    }

    /**
     * 更新投递状态
     */
    public DirectHireCompanyDTO updateStatus(Long id, UpdateStatusRequest request) {
        DirectHireCompanyEntity entity = persistenceService.updateStatus(id, request.status(), request.lastAccessDate());
        return toDTO(entity);
    }

    /**
     * 更新排序
     */
    public void updateSortOrder(UpdateSortOrderRequest request) {
        persistenceService.updateSortOrder(request.items());
    }

    /**
     * 删除公司
     */
    public void deleteCompany(Long id) {
        persistenceService.delete(id);
    }

    /**
     * 清空指定分类的所有公司
     */
    public int clearCompanies(CompanyCategory category) {
        return persistenceService.deleteByCategory(category);
    }

    /**
     * 实体转DTO
     */
    private DirectHireCompanyDTO toDTO(DirectHireCompanyEntity entity) {
        return new DirectHireCompanyDTO(
            entity.getId(),
            entity.getCategory(),
            entity.getSortOrder(),
            entity.getCompanyName(),
            entity.getApplicationLink(),
            entity.getReferralCode(),
            entity.getStatus(),
            entity.getLastAccessDate(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }
}
