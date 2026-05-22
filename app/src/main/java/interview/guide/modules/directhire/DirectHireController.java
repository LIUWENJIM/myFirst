package interview.guide.modules.directhire;

import interview.guide.common.result.PageResponse;
import interview.guide.common.result.Result;
import interview.guide.modules.directhire.model.*;
import interview.guide.modules.directhire.service.DirectHireService;
import interview.guide.modules.directhire.service.ExcelImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "直达招聘", description = "大厂公司投递信息管理")
public class DirectHireController {

    private final DirectHireService directHireService;
    private final ExcelImportService excelImportService;

    @GetMapping("/api/direct-hire/companies")
    @Operation(summary = "获取公司列表", description = "按分类获取公司列表，支持搜索")
    public Result<List<DirectHireCompanyDTO>> getCompanies(
        @Parameter(description = "公司分类", required = true)
        @RequestParam CompanyCategory category,
        @Parameter(description = "搜索关键词")
        @RequestParam(required = false) String search) {
        return Result.success(directHireService.getCompanies(category, search));
    }

    @GetMapping("/api/direct-hire/companies/paged")
    @Operation(summary = "分页获取公司列表", description = "按分类分页获取公司列表，支持搜索")
    public Result<PageResponse<DirectHireCompanyDTO>> getCompaniesPaged(
        @Parameter(description = "公司分类", required = true)
        @RequestParam CompanyCategory category,
        @Parameter(description = "搜索关键词")
        @RequestParam(required = false) String search,
        @Parameter(description = "页码（从0开始）")
        @RequestParam(defaultValue = "0") int page,
        @Parameter(description = "每页数量")
        @RequestParam(defaultValue = "15") int size) {
        return Result.success(directHireService.getCompaniesPaged(category, search, page, size));
    }

    @GetMapping("/api/direct-hire/companies/{id}")
    @Operation(summary = "获取公司详情", description = "根据ID获取公司详情")
    public Result<DirectHireCompanyDTO> getCompany(@PathVariable Long id) {
        return Result.success(directHireService.getCompany(id));
    }

    @PostMapping("/api/direct-hire/companies")
    @Operation(summary = "创建公司", description = "添加新的公司投递信息")
    public Result<DirectHireCompanyDTO> createCompany(@Valid @RequestBody CreateDirectHireRequest request) {
        return Result.success(directHireService.createCompany(request));
    }

    @PostMapping("/api/direct-hire/companies/batch")
    @Operation(summary = "批量创建公司", description = "批量导入公司投递信息")
    public Result<List<DirectHireCompanyDTO>> createBatch(
        @Parameter(description = "公司分类", required = true)
        @RequestParam CompanyCategory category,
        @Valid @RequestBody List<CreateDirectHireRequest> requests) {
        return Result.success(directHireService.createBatch(category, requests));
    }

    @PostMapping("/api/direct-hire/companies/import-excel")
    @Operation(summary = "Excel导入公司", description = "从Excel文件导入公司投递信息")
    public Result<List<DirectHireCompanyDTO>> importExcel(
        @Parameter(description = "公司分类", required = true)
        @RequestParam CompanyCategory category,
        @Parameter(description = "Excel文件", required = true)
        @RequestParam("file") MultipartFile file) {
        try {
            List<CreateDirectHireRequest> requests = excelImportService.parseExcel(file, category);
            if (requests.isEmpty()) {
                return Result.success(List.of());
            }
            log.info("从Excel解析到{}条公司数据，分类: {}", requests.size(), category);
            return Result.success(directHireService.createBatch(category, requests));
        } catch (Exception e) {
            log.error("Excel导入失败", e);
            return Result.error(500, "Excel导入失败: " + e.getMessage());
        }
    }

    @PutMapping("/api/direct-hire/companies/{id}")
    @Operation(summary = "更新公司", description = "更新公司投递信息")
    public Result<DirectHireCompanyDTO> updateCompany(
        @PathVariable Long id,
        @Valid @RequestBody UpdateDirectHireRequest request) {
        return Result.success(directHireService.updateCompany(id, request));
    }

    @PatchMapping("/api/direct-hire/companies/{id}/status")
    @Operation(summary = "更新投递状态", description = "更新公司投递状态和日期")
    public Result<DirectHireCompanyDTO> updateStatus(
        @PathVariable Long id,
        @Valid @RequestBody UpdateStatusRequest request) {
        return Result.success(directHireService.updateStatus(id, request));
    }

    @PutMapping("/api/direct-hire/companies/sort-order")
    @Operation(summary = "更新排序", description = "批量更新公司排序")
    public Result<Void> updateSortOrder(@Valid @RequestBody UpdateSortOrderRequest request) {
        directHireService.updateSortOrder(request);
        return Result.success();
    }

    @DeleteMapping("/api/direct-hire/companies/{id}")
    @Operation(summary = "删除公司", description = "删除公司投递信息")
    public Result<Void> deleteCompany(@PathVariable Long id) {
        directHireService.deleteCompany(id);
        return Result.success();
    }

    @DeleteMapping("/api/direct-hire/companies/clear")
    @Operation(summary = "清空分类数据", description = "清空指定分类的所有公司数据")
    public Result<Integer> clearCompanies(
        @Parameter(description = "公司分类", required = true)
        @RequestParam CompanyCategory category) {
        int deleted = directHireService.clearCompanies(category);
        log.info("清空分类 {} 的公司数据，共删除 {} 条", category, deleted);
        return Result.success(deleted);
    }
}
