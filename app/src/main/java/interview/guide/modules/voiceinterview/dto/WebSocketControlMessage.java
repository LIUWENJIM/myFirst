package interview.guide.modules.voiceinterview.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * WebSocket 控制消息 DTO
 *
 * 前端通过 WebSocket 发送的控制指令，用于管理面试流程。
 * 与音频数据消息（binary）区分，控制消息是文本类型的 JSON。
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketControlMessage {
    private String type;                // 消息类型（固定为 "control"）
    private String action;              // 操作类型：start_phase / end_phase / end_interview / submit
    private String phase;               // 目标阶段：INTRO / TECH / PROJECT / HR
    private Map<String, Object> data;   // 附加数据
}
