package interview.guide.modules.directhire.service;

import interview.guide.modules.directhire.model.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DirectHireService {

    private final DirectHirePersistenceService persistenceService;

    /**
     * 获取所有公司列表
     */
    public List<DirectHireCompanyDTO> getCompanies(String search) {
        List<DirectHireCompanyEntity> entities = persistenceService.search(search);
        return entities.stream()
            .map(this::toDTO)
            .toList();
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
     * 实体转DTO
     */
    private DirectHireCompanyDTO toDTO(DirectHireCompanyEntity entity) {
        return new DirectHireCompanyDTO(
            entity.getId(),
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
