package interview.guide.modules.voiceinterview.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 语音面试消息 DTO
 *
 * 用于向前端返回对话历史记录。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoiceInterviewMessageDTO {
    private Long id;                    // 消息ID
    private Long sessionId;             // 会话ID
    private String messageType;         // 消息类型（DIALOGUE/SYSTEM）
    private String phase;               // 所属阶段（INTRO/TECH/PROJECT/HR）
    private String userRecognizedText;  // 用户语音识别文本
    private String aiGeneratedText;     // AI 生成的回复文本
    private LocalDateTime timestamp;    // 消息时间戳
    private Integer sequenceNum;        // 消息序号
}
