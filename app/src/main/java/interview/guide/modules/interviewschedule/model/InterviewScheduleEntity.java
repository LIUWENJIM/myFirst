package interview.guide.modules.interviewschedule.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 面试日程实体
 *
 * 对应数据库表 interview_schedule，存储面试邀约信息。
 * 支持从飞书、腾讯会议、Zoom 等平台的邀约文本中自动解析。
 */
@Entity
@Table(name = "interview_schedule")
@Data
public class InterviewScheduleEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;                    // 日程ID（主键）

    @Column(name = "company_name", nullable = false)
    private String companyName;         // 公司名称

    @Column(nullable = false)
    private String position;            // 职位名称

    @Column(name = "interview_time", nullable = false)
    private LocalDateTime interviewTime; // 面试时间

    @Column(name = "interview_type")
    private String interviewType;       // 面试类型：ONSITE（现场）/ VIDEO（视频）/ PHONE（电话）

    @Column(name = "meeting_link", columnDefinition = "TEXT")
    private String meetingLink;         // 会议链接

    @Column(name = "round_number")
    private Integer roundNumber = 1;    // 面试轮次（默认第 1 轮）

    private String interviewer;         // 面试官姓名

    @Column(columnDefinition = "TEXT")
    private String notes;               // 备注信息

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InterviewStatus status = InterviewStatus.PENDING;  // 面试状态

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;    // 创建时间

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;    // 更新时间

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
