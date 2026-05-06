import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface InterviewPageHeaderProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
}

export default function InterviewPageHeader({
  title,
  subtitle,
  icon,
}: InterviewPageHeaderProps) {
  return (
    <motion.div
      className="text-center mb-8"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h1 className="text-3xl mb-2 flex items-center justify-center gap-3" style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)', fontWeight: 600}}>
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{backgroundColor: 'var(--color-primary)'}}>
          {icon}
        </div>
        {title}
      </h1>
      <p style={{color: 'var(--color-muted)'}}>{subtitle}</p>
    </motion.div>
  );
}
