package interview.guide.modules.directhire.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 直达招聘公司响应DTO
 */
public record DirectHireCompanyDTO(
    Long id,
    Integer sortOrder,
    String companyName,
    String applicationLink,
    String referralCode,
    ApplicationStatus status,
    LocalDate lastAccessDate,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
