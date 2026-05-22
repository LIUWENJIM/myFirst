package interview.guide.common.result;

import interview.guide.common.constant.CommonConstants;
import interview.guide.common.exception.ErrorCode;
import lombok.Getter;

/**
 * 统一 API 响应结果包装类
 *
 * 所有 Controller 返回值都使用此类包装，确保前端收到统一格式的响应。
 * 配合 GlobalExceptionHandler，异常也通过此类返回。
 *
 * 响应格式：
 * <pre>
 * {
 *   "code": 200,       // 业务状态码（200=成功，其他=失败）
 *   "message": "success",
 *   "data": { ... }    // 业务数据（失败时为 null）
 * }
 * </pre>
 *
 * 使用方式：
 * <pre>
 * return Result.success(data);           // 成功
 * return Result.error(ErrorCode.NOT_FOUND);  // 失败
 * </pre>
 *
 * @see CommonConstants.StatusCode
 * @see ErrorCode
 */
@Getter
public class Result<T> {
    
    private final Integer code;
    private final String message;
    private final T data;
    
    private Result(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }
    
    // ========== 成功响应 ==========
    
    public static <T> Result<T> success() {
        return new Result<>(CommonConstants.StatusCode.SUCCESS, "success", null);
    }
    
    public static <T> Result<T> success(T data) {
        return new Result<>(CommonConstants.StatusCode.SUCCESS, "success", data);
    }
    
    public static <T> Result<T> success(String message, T data) {
        return new Result<>(CommonConstants.StatusCode.SUCCESS, message, data);
    }
    
    // ========== 失败响应 ==========
    
    public static <T> Result<T> error(String message) {
        return new Result<>(CommonConstants.StatusCode.SERVER_ERROR, message, null);
    }
    
    public static <T> Result<T> error(Integer code, String message) {
        return new Result<>(code, message, null);
    }
    
    public static <T> Result<T> error(ErrorCode errorCode) {
        return new Result<>(errorCode.getCode(), errorCode.getMessage(), null);
    }
    
    public static <T> Result<T> error(ErrorCode errorCode, String message) {
        return new Result<>(errorCode.getCode(), message, null);
    }
    
    // ========== 辅助方法 ==========
    
    public boolean isSuccess() {
        return CommonConstants.StatusCode.SUCCESS == this.code;
    }
}
