package interview.guide.modules.directhire.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 创建直达招聘公司请求
 */
public record CreateDirectHireRequest(
    @NotNull(message = "公司分类不能为空")
    CompanyCategory category,

    @NotBlank(message = "公司名称不能为空")
    @Size(max = 100, message = "公司名称长度不能超过100")
    String companyName,

    @Size(max = 500, message = "投递链接长度不能超过500")
    String applicationLink,

    @Size(max = 100, message = "内推码长度不能超过100")
    String referralCode,

    ApplicationStatus status,

    LocalDate lastAccessDate
) {}
