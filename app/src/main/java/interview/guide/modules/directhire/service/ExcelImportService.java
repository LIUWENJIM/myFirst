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
     * Excel列顺序: A=招聘岗位, B=内推码, C=工作地点, D=投递链接, E=发布日期, F=公司名称, G=招聘类型, H=招聘方向, I=备注
     */
    private CreateDirectHireRequest parseRow(Row row, CompanyCategory category) {
        // 读取各列数据（按实际Excel列顺序）
        String jobPosition = getStringValue(row, 0);    // A列：招聘岗位
        String referralCode = getStringValue(row, 1);   // B列：内推码
        String workLocation = getStringValue(row, 2);   // C列：工作地点
        String applicationLink = getStringValue(row, 3); // D列：投递链接
        String publishDate = getStringValue(row, 4);     // E列：发布日期
        String companyName = getStringValue(row, 5);     // F列：公司名称
        String recruitType = getStringValue(row, 6);     // G列：招聘类型
        String recruitDirection = getStringValue(row, 7); // H列：招聘方向
        String remark = getStringValue(row, 8);           // I列：备注

        // 如果公司名称为空，跳过
        if (companyName == null || companyName.isBlank()) {
            return null;
        }

        // 清理投递链接中的markdown格式
        if (applicationLink != null) {
            applicationLink = cleanMarkdownLink(applicationLink);
        }

        // 解析发布日期为LocalDate
        LocalDate lastAccessDate = parseDateString(publishDate);

        return new CreateDirectHireRequest(
            category,
            companyName.trim(),
            applicationLink != null ? applicationLink.trim() : null,
            referralCode != null ? referralCode.trim() : null,
            ApplicationStatus.NOT_APPLIED,  // 默认未投递
            lastAccessDate
        );
    }

    /**
     * 清理markdown格式的链接
     * 例如: [https://example.com](https://example.com) -> https://example.com
     */
    private String cleanMarkdownLink(String link) {
        if (link == null) return null;

        // 处理markdown链接格式 [text](url)
        if (link.startsWith("[") && link.contains("](")) {
            int start = link.indexOf("](");
            int end = link.indexOf(")", start);
            if (start > 0 && end > start) {
                return link.substring(start + 2, end);
            }
        }

        return link;
    }

    /**
     * 解析日期字符串
     * 支持格式: "2026 年 5 月 21 日" 或 "2026-05-21"
     */
    private LocalDate parseDateString(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            return null;
        }

        try {
            // 处理中文日期格式: "2026 年 5 月 21 日"
            if (dateStr.contains("年") && dateStr.contains("月")) {
                String cleaned = dateStr.replace(" ", "");
                int year = Integer.parseInt(cleaned.substring(0, cleaned.indexOf("年")));
                int month = Integer.parseInt(cleaned.substring(cleaned.indexOf("年") + 1, cleaned.indexOf("月")));
                int day = 1;
                int dayIndex = cleaned.indexOf("月") + 1;
                int dayEnd = cleaned.indexOf("日");
                if (dayEnd > dayIndex) {
                    day = Integer.parseInt(cleaned.substring(dayIndex, dayEnd));
                }
                return LocalDate.of(year, month, day);
            }

            // 处理标准日期格式: "2026-05-21"
            if (dateStr.contains("-")) {
                return LocalDate.parse(dateStr.trim());
            }

            return null;
        } catch (Exception e) {
            log.warn("解析日期失败: {}", dateStr, e);
            return null;
        }
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
