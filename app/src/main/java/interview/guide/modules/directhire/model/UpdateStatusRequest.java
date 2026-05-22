package interview.guide.modules.directhire.model;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * 更新投递状态请求
 */
public record UpdateStatusRequest(
    @NotNull(message = "状态不能为空")
    ApplicationStatus status,

    LocalDate lastAccessDate
) {}
