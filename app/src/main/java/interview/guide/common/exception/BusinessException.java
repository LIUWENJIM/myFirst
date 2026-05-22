package interview.guide.common.exception;

import lombok.Getter;

/**
 * 业务异常基类
 *
 * 项目中所有业务异常都应继承此类（或使用此类），不应直接抛出 RuntimeException。
 * 配合 GlobalExceptionHandler 统一处理，返回 HTTP 200 + Result.error(...) 格式。
 *
 * 使用方式：
 * <pre>
 * throw new BusinessException(ErrorCode.NOT_FOUND, "简历不存在");
 * throw new BusinessException(ErrorCode.INTERNAL_ERROR, "未知错误");
 * </pre>
 *
 * @see ErrorCode
 * @see GlobalExceptionHandler
 */
@Getter
public class BusinessException extends RuntimeException {
    
    private final Integer code;
    private final String message;
    
    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.code = errorCode.getCode();
        this.message = errorCode.getMessage();
    }
    
    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
        this.message = message;
    }
    
    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
        this.message = message;
    }
    
    public BusinessException(String message) {
        super(message);
        this.code = ErrorCode.INTERNAL_ERROR.getCode();
        this.message = message;
    }
    
    public BusinessException(String message, Throwable cause) {
        super(message, cause);
        this.code = ErrorCode.INTERNAL_ERROR.getCode();
        this.message = message;
    }

    public BusinessException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.code = errorCode.getCode();
        this.message = message;
    }
}
