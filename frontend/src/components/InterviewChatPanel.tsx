import {useMemo, useRef} from 'react';
import {motion} from 'framer-motion';
import {Virtuoso, type VirtuosoHandle} from 'react-virtuoso';
import type {InterviewQuestion, InterviewSession} from '../types/interview';
import {Send} from 'lucide-react';
import InterviewMessageBubble from './InterviewMessageBubble';

interface Message {
  type: 'interviewer' | 'user';
  content: string;
  category?: string;
  questionIndex?: number;
}

interface InterviewChatPanelProps {
  session: InterviewSession;
  currentQuestion: InterviewQuestion | null;
  messages: Message[];
  answer: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  onCompleteEarly: () => void;
  isSubmitting: boolean;
  showCompleteConfirm: boolean;
  onShowCompleteConfirm: (show: boolean) => void;
}

export default function InterviewChatPanel({
  session,
  currentQuestion,
  messages,
  answer,
  onAnswerChange,
  onSubmit,
  isSubmitting,
  onShowCompleteConfirm
}: InterviewChatPanelProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const progress = useMemo(() => {
    if (!session || !currentQuestion) return 0;
    return ((currentQuestion.questionIndex + 1) / session.totalQuestions) * 100;
  }, [session, currentQuestion]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-4xl mx-auto">
      {/* Progress */}
      <div className="card-container p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold" style={{color: 'var(--color-body-text)'}}>
            题目 {currentQuestion ? currentQuestion.questionIndex + 1 : 0} / {session.totalQuestions}
          </span>
          <span className="text-sm" style={{color: 'var(--color-muted)'}}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{backgroundColor: 'var(--color-hairline)'}}>
          <motion.div
            className="h-full rounded-full"
            style={{backgroundColor: 'var(--color-primary)'}}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 card-container overflow-hidden flex flex-col min-h-0">
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          initialTopMostItemIndex={messages.length - 1}
          followOutput="smooth"
          className="flex-1"
          itemContent={(_index, msg) => (
            <div className="pb-4 px-6 first:pt-6">
              <InterviewMessageBubble
                role={msg.type === 'interviewer' ? 'interviewer' : 'user'}
                text={msg.content}
                category={msg.category}
              />
            </div>
          )}
        />

        {/* Input */}
        <div className="border-t p-4" style={{borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-surface-soft)'}}>
          <div className="flex gap-3">
            <textarea
              value={answer}
              onChange={(e) => onAnswerChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入你的回答... (Ctrl/Cmd + Enter 提交)"
              className="flex-1 px-4 py-3 border rounded-lg resize-none focus:outline-none"
              style={{
                borderColor: 'var(--color-hairline)',
                backgroundColor: 'var(--color-surface-card)',
                color: 'var(--color-ink)',
              }}
              rows={3}
              disabled={isSubmitting}
            />
            <div className="flex flex-col gap-2">
              <motion.button
                onClick={onSubmit}
                disabled={!answer.trim() || isSubmitting}
                className="px-6 py-3 rounded-lg font-medium text-white flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{backgroundColor: 'var(--color-primary)'}}
                whileHover={{ scale: isSubmitting || !answer.trim() ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting || !answer.trim() ? 1 : 0.98 }}
              >
                {isSubmitting ? (
                  <>
                    <motion.div
                      className="w-4 h-4 border border-white rounded-full"
                      style={{borderTopColor: 'transparent'}}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    提交中
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    提交
                  </>
                )}
              </motion.button>
              <motion.button
                onClick={() => onShowCompleteConfirm(true)}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-body-text)'}}
                whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              >
                提前交卷
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
