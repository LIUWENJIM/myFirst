package interview.guide.modules.directhire.repository;

import interview.guide.modules.directhire.model.ApplicationStatus;
import interview.guide.modules.directhire.model.CompanyCategory;
import interview.guide.modules.directhire.model.DirectHireCompanyEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DirectHireCompanyRepository extends JpaRepository<DirectHireCompanyEntity, Long> {

    /**
     * 按分类查询所有公司（按排序顺序）
     */
    List<DirectHireCompanyEntity> findByCategoryOrderBySortOrderAsc(CompanyCategory category);

    /**
     * 按分类分页查询公司（按排序顺序）
     */
    Page<DirectHireCompanyEntity> findByCategoryOrderBySortOrderAsc(CompanyCategory category, Pageable pageable);

    /**
     * 按分类和公司名称模糊搜索
     */
    List<DirectHireCompanyEntity> findByCategoryAndCompanyNameContainingIgnoreCaseOrderBySortOrderAsc(
        CompanyCategory category, String companyName);

    /**
     * 按分类和公司名称模糊搜索（分页）
     */
    Page<DirectHireCompanyEntity> findByCategoryAndCompanyNameContainingIgnoreCaseOrderBySortOrderAsc(
        CompanyCategory category, String companyName, Pageable pageable);

    /**
     * 按公司名称模糊搜索（所有分类）
     */
    List<DirectHireCompanyEntity> findByCompanyNameContainingIgnoreCaseOrderBySortOrderAsc(String companyName);

    /**
     * 按状态查询
     */
    List<DirectHireCompanyEntity> findByStatusOrderBySortOrderAsc(ApplicationStatus status);

    /**
     * 检查公司名称是否存在（同一分类内）
     */
    boolean existsByCategoryAndCompanyNameIgnoreCase(CompanyCategory category, String companyName);

    /**
     * 检查公司名称是否存在（同一分类内，排除指定ID）
     */
    @Query("SELECT COUNT(d) > 0 FROM DirectHireCompanyEntity d WHERE d.category = :category AND LOWER(d.companyName) = LOWER(:name) AND d.id != :id")
    boolean existsByCategoryAndCompanyNameIgnoreCaseAndIdNot(
        @Param("category") CompanyCategory category,
        @Param("name") String companyName,
        @Param("id") Long id);

    /**
     * 获取指定分类的最大排序值
     */
    @Query("SELECT COALESCE(MAX(d.sortOrder), 0) FROM DirectHireCompanyEntity d WHERE d.category = :category")
    Integer findMaxSortOrderByCategory(@Param("category") CompanyCategory category);

    /**
     * 删除指定分类的所有公司
     */
    @Modifying
    @Query("DELETE FROM DirectHireCompanyEntity d WHERE d.category = :category")
    int deleteByCategory(@Param("category") CompanyCategory category);
}
