package interview.guide.modules.directhire.service;

import interview.guide.modules.directhire.model.ApplicationStatus;
import interview.guide.modules.directhire.model.CompanyCategory;
import interview.guide.modules.directhire.model.CreateDirectHireRequest;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Slf4j
@Service
public class ExcelImportService {

    /**
     * 解析Excel文件并转换为CreateDirectHireRequest列表
     */
    public List<CreateDirectHireRequest> parseExcel(MultipartFile file, CompanyCategory category) throws IOException {
        List<CreateDirectHireRequest> requests = new ArrayList<>();

        try (InputStream inputStream = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(inputStream)) {

            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new IOException("Excel文件为空");
            }

            // 跳过表头行
            int startRow = 1;

            for (int rowNum = startRow; rowNum <= sheet.getLastRowNum(); rowNum++) {
                Row row = sheet.getRow(rowNum);
                if (row == null) {
                    continue;
                }

                try {
                    CreateDirectHireRequest request = parseRow(row, category);
                    if (request != null && request.companyName() != null && !request.companyName().isBlank()) {
                        requests.add(request);
                    }
                } catch (Exception e) {
                    log.warn("解析第{}行数据失败: {}", rowNum + 1, e.getMessage());
                }
            }
        }

        return requests;
    }

    /**
     * 解析单行数据
     */
    private CreateDirectHireRequest parseRow(Row row, CompanyCategory category) {
        // 读取各列数据
        Integer sortOrder = getIntegerValue(row, 0);  // A列：序号
        String companyName = getStringValue(row, 1);   // B列：公司名称
        String applicationLink = getStringValue(row, 2); // C列：投递链接
        String referralCode = getStringValue(row, 3);   // D列：内推码
        String statusStr = getStringValue(row, 4);       // E列：投递状态
        LocalDate lastAccessDate = getDateValue(row, 5); // F列：上次访问时间

        // 如果公司名称为空，跳过
        if (companyName == null || companyName.isBlank()) {
            return null;
        }

        // 解析状态
        ApplicationStatus status = parseStatus(statusStr);

        return new CreateDirectHireRequest(
            category,
            companyName.trim(),
            applicationLink != null ? applicationLink.trim() : null,
            referralCode != null ? referralCode.trim() : null,
            status,
            lastAccessDate
        );
    }

    /**
     * 解析状态字符串
     */
    private ApplicationStatus parseStatus(String statusStr) {
        if (statusStr == null || statusStr.isBlank()) {
            return ApplicationStatus.NOT_APPLIED;
        }

        String trimmed = statusStr.trim();
        return switch (trimmed) {
            case "未投递" -> ApplicationStatus.NOT_APPLIED;
            case "筛选中" -> ApplicationStatus.SCREENING;
            case "已测评" -> ApplicationStatus.ASSESSED;
            case "已拒绝" -> ApplicationStatus.REJECTED;
            case "无对应岗位" -> ApplicationStatus.NO_POSITION;
            default -> ApplicationStatus.NOT_APPLIED;
        };
    }

    /**
     * 获取单元格字符串值
     */
    private String getStringValue(Row row, int cellIndex) {
        Cell cell = row.getCell(cellIndex);
        if (cell == null) {
            return null;
        }

        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getDateCellValue().toString();
                }
                // 处理数字格式的字符串（如序号）
                double numValue = cell.getNumericCellValue();
                if (numValue == Math.floor(numValue) && !Double.isInfinite(numValue)) {
                    yield String.valueOf((int) numValue);
                }
                yield String.valueOf(numValue);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield cell.getStringCellValue();
                } catch (Exception e) {
                    try {
                        yield String.valueOf(cell.getNumericCellValue());
                    } catch (Exception e2) {
                        yield null;
                    }
                }
            }
            default -> null;
        };
    }

    /**
     * 获取单元格整数值
     */
    private Integer getIntegerValue(Row row, int cellIndex) {
        Cell cell = row.getCell(cellIndex);
        if (cell == null) {
            return null;
        }

        return switch (cell.getCellType()) {
            case NUMERIC -> (int) cell.getNumericCellValue();
            case STRING -> {
                try {
                    yield Integer.parseInt(cell.getStringCellValue().trim());
                } catch (NumberFormatException e) {
                    yield null;
                }
            }
            default -> null;
        };
    }

    /**
     * 获取单元格日期值
     */
    private LocalDate getDateValue(Row row, int cellIndex) {
        Cell cell = row.getCell(cellIndex);
        if (cell == null) {
            return null;
        }

        return switch (cell.getCellType()) {
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    Date date = cell.getDateCellValue();
                    yield date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
                }
                yield null;
            }
            case STRING -> {
                try {
                    String dateStr = cell.getStringCellValue().trim();
                    if (!dateStr.isEmpty()) {
                        yield LocalDate.parse(dateStr);
                    }
                    yield null;
                } catch (Exception e) {
                    yield null;
                }
            }
            default -> null;
        };
    }
}
