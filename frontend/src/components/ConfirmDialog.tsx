import {AnimatePresence, motion} from 'framer-motion';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  customContent?: React.ReactNode;
  hideButtons?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  loading = false,
  customContent,
  hideButtons = false
}: ConfirmDialogProps) {
  if (!open) return null;

  const getVariantBg = () => {
    switch (confirmVariant) {
      case 'danger': return 'var(--color-error)';
      case 'warning': return 'var(--color-warning)';
      default: return 'var(--color-primary)';
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            onClick={onCancel}
            className="fixed inset-0 z-50"
            style={{backgroundColor: 'rgba(20,20,19,0.5)'}}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{opacity: 0, scale: 0.95, y: 20}}
              animate={{opacity: 1, scale: 1, y: 0}}
              exit={{opacity: 0, scale: 0.95, y: 20}}
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg border max-w-md w-full p-6"
              style={{backgroundColor: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)'}}
            >
              <h3 className="text-base font-semibold mb-3" style={{color: 'var(--color-ink)'}}>
                {title}
              </h3>

              <div className="text-sm mb-6" style={{color: 'var(--color-body-text)'}}>
                {typeof message === 'string' ? (
                  message && <p className="whitespace-pre-line">{message}</p>
                ) : (
                  message
                )}
                {customContent}
              </div>

              {!hideButtons && (
                <div className="flex gap-3 justify-end">
                  <motion.button
                    onClick={onCancel}
                    disabled={loading}
                    className="px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{borderColor: 'var(--color-hairline)', color: 'var(--color-body-text)'}}
                    whileHover={{scale: 1.01}}
                    whileTap={{scale: 0.99}}
                  >
                    {cancelText}
                  </motion.button>
                  <motion.button
                    onClick={onConfirm}
                    disabled={loading}
                    className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{backgroundColor: getVariantBg()}}
                    whileHover={{scale: 1.01}}
                    whileTap={{scale: 0.99}}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <motion.span
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block"
                          animate={{rotate: 360}}
                          transition={{duration: 1, repeat: Infinity, ease: "linear"}}
                        />
                        处理中...
                      </span>
                    ) : (
                      confirmText
                    )}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
