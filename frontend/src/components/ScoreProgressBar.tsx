import {motion} from 'framer-motion';
import {calculatePercentage} from '../utils/score';

interface ScoreProgressBarProps {
  label: string;
  score: number;
  maxScore: number;
  color?: string;
  delay?: number;
  className?: string;
}

export default function ScoreProgressBar({
  label,
  score,
  maxScore,
  color = 'var(--color-primary)',
  delay = 0,
  className = ''
}: ScoreProgressBarProps) {
  const percentage = calculatePercentage(score, maxScore);

  return (
    <div className={`rounded-lg p-3 ${className}`} style={{backgroundColor: 'var(--color-surface-soft)'}}>
      <div className="text-xs mb-1" style={{color: 'var(--color-muted)'}}>{label}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{backgroundColor: 'var(--color-hairline)'}}>
          <motion.div
            className="h-full rounded-full"
            style={{backgroundColor: color}}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, delay }}
          />
        </div>
        <span className="text-sm font-semibold w-8 text-right" style={{color: 'var(--color-body-text)'}}>
          {score}/{maxScore}
        </span>
      </div>
    </div>
  );
}
