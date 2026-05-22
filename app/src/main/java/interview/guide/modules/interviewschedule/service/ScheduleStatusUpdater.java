package interview.guide.modules.interviewschedule.service;

import interview.guide.modules.interviewschedule.model.InterviewStatus;
import interview.guide.modules.interviewschedule.repository.InterviewScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 面试日程状态定时更新器
 *
 * 每小时执行一次，将过期的待确认面试自动标记为已取消。
 * 过期条件：面试时间早于当前时间且状态仍为 PENDING。
 *
 * 调度表达式：0 0 * * * ?（每小时整点执行）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduleStatusUpdater {

    private final InterviewScheduleRepository repository;  // 面试日程数据库仓库

    /**
     * 将过期的待确认面试标记为已取消
     * 每小时整点执行一次
     */
    @Scheduled(cron = "0 0 * * * ?")
    @Transactional
    public void updateExpiredInterviews() {
        int updated = repository.updateStatusByStatusAndInterviewTimeBefore(
            InterviewStatus.CANCELLED, InterviewStatus.PENDING, LocalDateTime.now());

        if (updated > 0) {
            log.info("已将 {} 条过期面试标记为已取消", updated);
        }
    }
}
