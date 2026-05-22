package interview.guide.modules.directhire;

import interview.guide.common.result.Result;
import interview.guide.modules.directhire.model.*;
import interview.guide.modules.directhire.service.DirectHireService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "直达招聘", description = "大厂公司投递信息管理")
public class DirectHireController {

    private final DirectHireService directHireService;

    @GetMapping("/api/direct-hire/companies")
    @Operation(summary = "获取公司列表", description = "获取所有公司列表，支持搜索")
    public Result<List<DirectHireCompanyDTO>> getCompanies(
        @Parameter(description = "搜索关键词")
        @RequestParam(required = false) String search) {
        return Result.success(directHireService.getCompanies(search));
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
}
