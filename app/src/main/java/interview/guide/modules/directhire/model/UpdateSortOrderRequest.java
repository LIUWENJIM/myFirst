package interview.guide.modules.directhire.model;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * 更新排序请求
 */
public record UpdateSortOrderRequest(
    @NotNull(message = "排序列表不能为空")
    List<SortItem> items
) {
    public record SortItem(
        @NotNull(message = "公司ID不能为空")
        Long id,

        @NotNull(message = "排序值不能为空")
        Integer sortOrder
    ) {}
}
