package interview.guide.modules.voiceinterview.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 语音面试消息实体
 *
 * 对应数据库表 voice_interview_messages，存储语音面试中的每轮对话。
 * 每条消息包含用户的语音识别文本和 AI 生成的回复文本。
 *
 * 消息类型（messageType）：
 * - DIALOGUE: 普通对话（一问一答）
 * - SYSTEM: 系统消息（阶段切换通知等）
 */
@Entity
@Table(name = "voice_interview_messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoiceInterviewMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "message_type", nullable = false)
    private String messageType; // USER_SPEECH, AI_SPEECH, SYSTEM

    @Column(name = "phase")
    @Enumerated(EnumType.STRING)
    private VoiceInterviewSessionEntity.InterviewPhase phase;

    @Column(name = "user_recognized_text", columnDefinition = "TEXT")
    private String userRecognizedText;

    @Column(name = "ai_generated_text", columnDefinition = "TEXT")
    private String aiGeneratedText;

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "sequence_num")
    private Integer sequenceNum;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.timestamp = LocalDateTime.now();
    }
}
