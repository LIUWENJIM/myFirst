package interview.guide.modules.directhire.repository;

import interview.guide.modules.directhire.model.ApplicationStatus;
import interview.guide.modules.directhire.model.DirectHireCompanyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DirectHireCompanyRepository extends JpaRepository<DirectHireCompanyEntity, Long> {

    /**
     * 按排序顺序查询所有公司
     */
    List<DirectHireCompanyEntity> findAllByOrderBySortOrderAsc();

    /**
     * 按公司名称模糊搜索
     */
    List<DirectHireCompanyEntity> findByCompanyNameContainingIgnoreCaseOrderBySortOrderAsc(String companyName);

    /**
     * 按状态查询
     */
    List<DirectHireCompanyEntity> findByStatusOrderBySortOrderAsc(ApplicationStatus status);

    /**
     * 检查公司名称是否存在
     */
    boolean existsByCompanyNameIgnoreCase(String companyName);

    /**
     * 检查公司名称是否存在（排除指定ID）
     */
    @Query("SELECT COUNT(d) > 0 FROM DirectHireCompanyEntity d WHERE LOWER(d.companyName) = LOWER(:name) AND d.id != :id")
    boolean existsByCompanyNameIgnoreCaseAndIdNot(@Param("name") String companyName, @Param("id") Long id);

    /**
     * 获取最大排序值
     */
    @Query("SELECT COALESCE(MAX(d.sortOrder), 0) FROM DirectHireCompanyEntity d")
    Integer findMaxSortOrder();
}
