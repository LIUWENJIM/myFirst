package interview.guide.modules.voiceinterview.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket 字幕消息 DTO
 *
 * 向前端发送的实时字幕消息，用于显示语音识别结果。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketSubtitleMessage {
    private String type;     // 消息类型（固定为 "subtitle"）
    private String text;     // 字幕文本
    private Boolean isFinal; // 是否为最终结果（true=确认，false=中间识别结果）
}
