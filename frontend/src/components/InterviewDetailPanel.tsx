import {useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {getScoreColor} from '../utils/score';
import type {InterviewDetail} from '../api/history';

interface InterviewDetailPanelProps {
  interview: InterviewDetail;
}

export default function InterviewDetailPanel({ interview }: InterviewDetailPanelProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(() => {
    const allIndices = new Set<number>();
    if (interview.answers) {
      interview.answers.forEach((_, idx) => allIndices.add(idx));
    }
    return allIndices;
  });

  const toggleQuestion = (index: number) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const { scorePercent, circumference, strokeDashoffset } = useMemo(() => {
    const percent = interview.overallScore !== null ? (interview.overallScore / 100) * 100 : 0;
    const circ = 2 * Math.PI * 54;
    const offset = circ - (percent / 100) * circ;
    return { scorePercent: percent, circumference: circ, strokeDashoffset: offset };
  }, [interview.overallScore]);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ScoreCard
        score={interview.overallScore}
        feedback={interview.overallFeedback}
        scorePercent={scorePercent}
        circumference={circumference}
        strokeDashoffset={strokeDashoffset}
      />

      {interview.strengths && interview.strengths.length > 0 && (
        <StrengthsSection strengths={interview.strengths} />
      )}

      {interview.improvements && interview.improvements.length > 0 && (
        <ImprovementsSection improvements={interview.improvements} />
      )}

      <QuestionsSection
        answers={interview.answers || []}
        expandedQuestions={expandedQuestions}
        toggleQuestion={toggleQuestion}
      />
    </motion.div>
  );
}

function ScoreCard({
  score,
  feedback,
  circumference,
  strokeDashoffset
}: {
  score: number | null;
  feedback: string | null;
  scorePercent: number;
  circumference: number;
  strokeDashoffset: number;
}) {
  return (
    <div className="rounded-lg p-8 text-white" style={{backgroundColor: 'var(--color-surface-dark)'}}>
      <div className="flex flex-col items-center text-center">
        <div className="relative w-32 h-32 mb-6">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="8"
              fill="none"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="54"
              stroke="var(--color-primary)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-4xl font-bold"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              style={{fontFamily: 'var(--font-display)'}}
            >
              {score ?? '-'}
            </motion.span>
            <span className="text-sm" style={{color: 'rgba(255,255,255,0.7)'}}>总分</span>
          </div>
        </div>

        <h3 className="text-2xl font-bold mb-3" style={{fontFamily: 'var(--font-display)'}}>面试评估</h3>
        <p className="max-w-2xl leading-relaxed" style={{color: 'rgba(255,255,255,0.9)'}}>
          {feedback || '表现良好，展示了扎实的技术基础。'}
        </p>
      </div>
    </div>
  );
}

function StrengthsSection({ strengths }: { strengths: string[] }) {
  return (
    <motion.div
      className="card-container p-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <h4 className="font-semibold mb-4 flex items-center gap-2" style={{color: '#10b981'}}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        表现优势
      </h4>
      <ul className="space-y-3">
        {strengths.map((s: string, i: number) => (
          <li key={i} className="flex items-start gap-3" style={{color: 'var(--color-body-text)'}}>
            <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{backgroundColor: 'var(--color-primary)'}}></span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function ImprovementsSection({ improvements }: { improvements: string[] }) {
  return (
    <motion.div
      className="card-container p-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h4 className="font-semibold mb-4 flex items-center gap-2" style={{color: 'var(--color-warning)'}}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        改进建议
      </h4>
      <ul className="space-y-3">
        {improvements.map((s: string, i: number) => (
          <li key={i} className="flex items-start gap-3" style={{color: 'var(--color-body-text)'}}>
            <span className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0"></span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function QuestionsSection({
  answers,
  expandedQuestions,
  toggleQuestion
}: {
  answers: any[];
  expandedQuestions: Set<number>;
  toggleQuestion: (index: number) => void;
}) {
  return (
    <div>
      <h4 className="font-semibold mb-4 flex items-center gap-2" style={{color: 'var(--color-ink)'}}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" style={{color: 'var(--color-primary)'}}>
          <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        问答记录详情
      </h4>

      <div className="space-y-4">
        {answers.map((answer, idx) => (
          <QuestionCard
            key={idx}
            answer={answer}
            index={idx}
            isExpanded={expandedQuestions.has(idx)}
            onToggle={() => toggleQuestion(idx)}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({
  answer,
  index,
  isExpanded,
  onToggle
}: {
  answer: any;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      className="card-container overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05 }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer transition-colors"
        style={{backgroundColor: isExpanded ? 'var(--color-surface-soft)' : 'transparent'}}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
        onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold" style={{backgroundColor: 'var(--color-surface-soft)', color: 'var(--color-body-text)'}}>
            {answer.questionIndex + 1}
          </span>
          <span className="px-3 py-1 text-xs font-medium rounded-full" style={{backgroundColor: 'var(--color-surface-soft)', color: 'var(--color-primary)'}}>
            {answer.category || '综合'}
          </span>
          <span className={`font-semibold ${getScoreColor(answer.score, [80, 60])}`}>
            得分: {answer.score}
          </span>
        </div>
        <motion.svg
          className="w-5 h-5"
          style={{color: 'var(--color-muted)'}}
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          viewBox="0 0 24 24"
          fill="none"
        >
          <polyline points="6,9 12,15 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </motion.svg>
      </div>

      <div className="px-5 pb-2">
        <p className="font-medium leading-relaxed" style={{color: 'var(--color-ink)'}}>{answer.question}</p>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              <div className="rounded-lg p-4" style={{backgroundColor: 'var(--color-surface-soft)'}}>
                <p className="text-sm mb-2 flex items-center gap-1" style={{color: 'var(--color-muted)'}}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  你的回答
                </p>
                <p className={`leading-relaxed ${
                  !answer.userAnswer || answer.userAnswer === '不知道'
                    ? ''
                    : ''
                }`}
                  style={{
                    color: (!answer.userAnswer || answer.userAnswer === '不知道') ? 'var(--color-error)' : 'var(--color-body-text)',
                    fontWeight: (!answer.userAnswer || answer.userAnswer === '不知道') ? 500 : 400,
                  }}
                >
                  "{answer.userAnswer || '(未回答)'}"
                </p>
              </div>

              {answer.feedback && (
                <div>
                  <p className="text-sm mb-2 flex items-center gap-2 font-medium" style={{color: 'var(--color-body-text)'}}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" style={{color: 'var(--color-primary)'}}>
                      <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18 9L12 15L9 12L3 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    AI 深度评价
                  </p>
                  <p className="leading-relaxed pl-6" style={{color: 'var(--color-body-text)'}}>{answer.feedback}</p>
                </div>
              )}

              {answer.referenceAnswer && (
                <div className="rounded-lg p-4 border" style={{backgroundColor: 'var(--color-surface-soft)', borderColor: 'var(--color-hairline)'}}>
                  <p className="text-sm mb-3 flex items-center gap-2 font-medium" style={{color: 'var(--color-body-text)'}}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" style={{color: 'var(--color-primary)'}}>
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M12 9V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    参考答案
                  </p>
                  <div className="leading-relaxed whitespace-pre-line" style={{color: 'var(--color-body-text)'}}>{answer.referenceAnswer}</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
