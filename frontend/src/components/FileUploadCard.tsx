import {ChangeEvent, DragEvent, useCallback, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {AlertCircle, FileText, Loader2, Upload, X} from 'lucide-react';

export interface FileUploadCardProps {
  title: string;
  subtitle: string;
  accept: string;
  formatHint: string;
  maxSizeHint: string;
  uploading?: boolean;
  uploadButtonText?: string;
  selectButtonText?: string;
  showNameInput?: boolean;
  namePlaceholder?: string;
  nameLabel?: string;
  error?: string;
  onFileSelect?: (file: File) => void;
  onUpload: (file: File, name?: string) => void;
  onBack?: () => void;
}

export default function FileUploadCard({
  title,
  subtitle,
  accept,
  formatHint,
  maxSizeHint,
  uploading = false,
  uploadButtonText = '开始上传',
  selectButtonText = '选择文件',
  showNameInput = false,
  namePlaceholder = '留空则使用文件名',
  nameLabel = '名称（可选）',
  error,
  onFileSelect,
  onUpload,
  onBack,
}: FileUploadCardProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState('');

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
      onFileSelect?.(files[0]);
    }
  }, [onFileSelect]);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      onFileSelect?.(files[0]);
    }
  }, [onFileSelect]);

  const handleUpload = () => {
    if (!selectedFile) return;
    onUpload(selectedFile, name.trim() || undefined);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <motion.div
      className="max-w-2xl mx-auto pt-16"
      initial={{opacity: 0, y: 16}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.3}}
    >
      {/* 标题 */}
      <div className="text-center mb-10">
        <motion.h1
          className="text-3xl mb-3"
          style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)', fontWeight: 500}}
          initial={{opacity: 0, y: 16}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: 0.1}}
        >
          {title}
        </motion.h1>
        <motion.p
          className="text-sm"
          style={{color: 'var(--color-muted)'}}
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          transition={{delay: 0.15}}
        >
          {subtitle}
        </motion.p>
      </div>

      {/* 上传区域 */}
      <motion.div
        className="relative rounded-lg p-10 cursor-pointer transition-all duration-200 border-2 border-dashed"
        style={{
          backgroundColor: dragOver ? 'var(--color-surface-soft)' : 'var(--color-surface-card)',
          borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-hairline)',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload-input')?.click()}
        initial={{opacity: 0, y: 16}}
        animate={{opacity: 1, y: 0}}
        transition={{delay: 0.2}}
      >
        <input
          type="file"
          id="file-upload-input"
          className="hidden"
          accept={accept}
          onChange={handleFileChange}
          disabled={uploading}
        />

        <div className="text-center">
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key="file-selected"
                initial={{opacity: 0, scale: 0.95}}
                animate={{opacity: 1, scale: 1}}
                exit={{opacity: 0, scale: 0.95}}
                className="space-y-4"
              >
                <div className="w-16 h-16 mx-auto rounded-lg flex items-center justify-center" style={{backgroundColor: 'var(--color-surface-soft)'}}>
                  <FileText className="w-8 h-8" style={{color: 'var(--color-primary)'}}/>
                </div>
                <div className="flex items-center gap-4 px-5 py-3 rounded-lg max-w-sm mx-auto" style={{backgroundColor: 'var(--color-surface-soft)'}}>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{color: 'var(--color-ink)'}}>{selectedFile.name}</p>
                    <p className="text-xs" style={{color: 'var(--color-muted)'}}>{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                    style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-error)'}}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="no-file"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                className="space-y-4"
              >
                <motion.div
                  className="w-16 h-16 mx-auto rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: dragOver ? 'var(--color-surface-cream-strong)' : 'var(--color-surface-soft)',
                    color: dragOver ? 'var(--color-primary)' : 'var(--color-muted)',
                  }}
                  animate={{y: dragOver ? -4 : 0}}
                >
                  <Upload className="w-8 h-8"/>
                </motion.div>
                <div>
                  <h3 className="text-base font-semibold mb-1.5" style={{color: 'var(--color-ink)'}}>点击或拖拽文件至此处</h3>
                  <p className="text-xs mb-4" style={{color: 'var(--color-muted-soft)'}}>
                    {formatHint}（{maxSizeHint}）
                  </p>
                </div>
                <button
                  className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                  style={{backgroundColor: 'var(--color-primary)'}}
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('file-upload-input')?.click();
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-active)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary)'; }}
                >
                  {selectButtonText}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* 名称输入框 */}
      {showNameInput && selectedFile && (
        <motion.div
          className="mt-5 rounded-lg p-5 border"
          style={{backgroundColor: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)'}}
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
        >
          <label className="block text-sm font-medium mb-1.5" style={{color: 'var(--color-body-strong)'}}>{nameLabel}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none transition-colors"
            style={{borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-canvas)', color: 'var(--color-ink)'}}
            disabled={uploading}
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}

      {/* 错误提示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{opacity: 0, y: -8}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -8}}
            className="mt-5 p-3 rounded-lg text-sm text-center flex items-center justify-center gap-2"
            style={{backgroundColor: 'rgba(198,69,69,0.1)', color: 'var(--color-error)', border: '1px solid rgba(198,69,69,0.2)'}}
          >
            <AlertCircle className="w-4 h-4"/>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 操作按钮 */}
      <div className="mt-6 flex gap-3 justify-center">
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2.5 border rounded-lg text-sm font-medium transition-colors"
            style={{borderColor: 'var(--color-hairline)', color: 'var(--color-body-text)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            返回
          </button>
        )}
        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{backgroundColor: 'var(--color-primary)'}}
            onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-active)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary)'; }}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin"/>
                处理中...
              </>
            ) : (
              uploadButtonText
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
