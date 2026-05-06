// frontend/src/components/interviewschedule/InterviewFormModal.tsx

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import type { InterviewFormData, ParseResponse, InterviewType } from '../../types/interviewSchedule';
import { interviewScheduleApi } from '../../api/interviewSchedule';
import dayjs from 'dayjs';

interface InterviewFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InterviewFormData) => Promise<void>;
  onDelete?: (id: number) => void;
  initialData?: InterviewFormData;
  mode: 'create' | 'edit';
}

type Step = 'text' | 'parse-result' | 'form';

const INTERVIEW_INVITE_EXAMPLE = `【阿里巴巴】后端开发工程师一面邀请
候选人：张三
面试时间：2026-04-15 19:30
面试形式：视频面试（腾讯会议）
会议链接：https://meeting.tencent.com/abc-defg-hij
面试轮次：第一轮技术面
面试官：李老师
备注：请提前10分钟入会，准备项目介绍与系统设计案例。`;

export const InterviewFormModal: React.FC<InterviewFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  initialData,
  mode,
}) => {
  const [step, setStep] = useState<Step>(mode === 'edit' ? 'form' : 'text');
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<InterviewFormData>(initialData || {
    companyName: '',
    position: '',
    interviewTime: '',
    interviewType: 'VIDEO' as InterviewType,
    meetingLink: '',
    roundNumber: 1,
    interviewer: '',
    notes: '',
  });

  // Reset state when modal opens or mode changes
  React.useEffect(() => {
    if (isOpen) {
      setStep(mode === 'edit' ? 'form' : 'text');
      setRawText('');
      setParseResult(null);
      setSubmitError(null);
      setFormData(initialData || {
        companyName: '',
        position: '',
        interviewTime: '',
        interviewType: 'VIDEO' as InterviewType,
        meetingLink: '',
        roundNumber: 1,
        interviewer: '',
        notes: '',
      });
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!rawText.trim()) return;

    setParsing(true);
    try {
      const result = await interviewScheduleApi.parse(rawText);
      setParseResult(result);

      if (result.success && result.data) {
        setFormData({
          ...result.data,
          interviewTime: result.data.interviewTime || '',
        });
      }

      setStep('parse-result');
    } catch (error) {
      console.error('Parse failed:', error);
      setParseResult({
        success: false,
        data: null,
        confidence: 0,
        parseMethod: 'ai',
        log: '解析失败,请手动输入',
      });
      setStep('parse-result');
    } finally {
      setParsing(false);
    }
  };

  const handleFormChange = (field: keyof InterviewFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error: any) {
      console.error('Submit failed:', error);
      setSubmitError(error.message || '保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep('text');
    setRawText('');
    setParseResult(null);
    setFormData({
      companyName: '',
      position: '',
      interviewTime: '',
      interviewType: 'VIDEO',
      meetingLink: '',
      roundNumber: 1,
      interviewer: '',
      notes: '',
    });
  };

  const inputClass = "w-full px-4 py-3 rounded-lg focus:outline-none transition-all";
  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--color-hairline)',
    backgroundColor: 'var(--color-surface-card)',
    color: 'var(--color-ink)',
  };

  const renderTextInput = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-px" style={{backgroundColor: 'var(--color-hairline)'}} />
        <span className="text-sm font-medium" style={{color: 'var(--color-muted)'}}>选择添加方式</span>
        <div className="flex-1 h-px" style={{backgroundColor: 'var(--color-hairline)'}} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          className="p-4 rounded-lg text-left transition-all"
          style={{border: '2px solid var(--color-primary)', backgroundColor: 'rgba(204,120,92,0.08)'}}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: 'var(--color-primary)'}}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold" style={{color: 'var(--color-ink)'}}>粘贴文本</div>
              <div className="text-xs" style={{color: 'var(--color-primary)'}}>自动解析面试信息</div>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => setStep('form')}
          className="p-4 rounded-lg text-left transition-all"
          style={{border: '1px solid var(--color-hairline)', backgroundColor: 'var(--color-surface-card)'}}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-hairline)'; }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: 'var(--color-surface-soft)'}}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{color: 'var(--color-body-text)'}}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold" style={{color: 'var(--color-ink)'}}>手动输入</div>
              <div className="text-xs" style={{color: 'var(--color-muted)'}}>填写面试详情</div>
            </div>
          </div>
        </motion.button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-semibold" style={{color: 'var(--color-body-text)'}}>
            粘贴面试邀约文本
          </label>
          <button
            type="button"
            onClick={() => setRawText(INTERVIEW_INVITE_EXAMPLE)}
            className="text-xs font-medium transition-colors"
            style={{color: 'var(--color-primary)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            使用示例
          </button>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder='支持飞书、腾讯会议、Zoom 等格式，或点击右上角"使用示例"快速体验解析。'
          className={`${inputClass} resize-none`}
          style={{...inputStyle, height: '12rem'}}
        />
      </div>

      <div className="flex justify-end gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-lg font-medium transition-all"
          style={{color: 'var(--color-body-text)'}}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          取消
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleParse}
          disabled={!rawText.trim() || parsing}
          className="px-5 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{backgroundColor: 'var(--color-primary)'}}
        >
          {parsing ? '解析中...' : '解析文本'}
        </motion.button>
      </div>
    </div>
  );

  const renderParseResult = () => (
    <div className="space-y-6">
      {parseResult && (
        <>
          <div className="p-5 rounded-lg" style={{
            backgroundColor: parseResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(198,69,69,0.08)',
            border: `1px solid ${parseResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(198,69,69,0.3)'}`,
          }}>
            <div className="flex items-center gap-3 mb-3">
              {parseResult.success ? (
                <CheckCircle className="w-5 h-5" style={{color: '#10b981'}} />
              ) : (
                <AlertCircle className="w-5 h-5" style={{color: 'var(--color-error)'}} />
              )}
              <span className="font-semibold text-lg" style={{color: 'var(--color-ink)'}}>
                {parseResult.success ? '解析成功' : '解析失败'}
              </span>
              {parseResult.success && (
                <span className="text-sm ml-auto" style={{color: 'var(--color-muted)'}}>
                  置信度: <span className="font-semibold" style={{color: '#10b981'}}>{(parseResult.confidence * 100).toFixed(0)}%</span>
                </span>
              )}
            </div>

            {parseResult.success && parseResult.data && (
              <div className="p-4 rounded-lg space-y-2.5 text-sm" style={{backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-hairline)'}}>
                <div className="flex">
                  <span className="font-semibold w-20" style={{color: 'var(--color-body-text)'}}>公司:</span>
                  <span className="font-medium" style={{color: 'var(--color-ink)'}}>{parseResult.data.companyName}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-20" style={{color: 'var(--color-body-text)'}}>岗位:</span>
                  <span className="font-medium" style={{color: 'var(--color-ink)'}}>{parseResult.data.position}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-20" style={{color: 'var(--color-body-text)'}}>时间:</span>
                  <span className="font-medium" style={{color: 'var(--color-ink)'}}>{dayjs(parseResult.data.interviewTime).format('YYYY-MM-DD HH:mm')}</span>
                </div>
                {parseResult.data.meetingLink && (
                  <div className="flex">
                    <span className="font-semibold w-20" style={{color: 'var(--color-body-text)'}}>会议:</span>
                    <span className="font-medium truncate" style={{color: 'var(--color-ink)'}}>{parseResult.data.meetingLink}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <details className="p-4 rounded-lg" style={{backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)'}}>
            <summary className="cursor-pointer font-semibold text-sm transition-colors" style={{color: 'var(--color-body-text)'}}>
              详细日志
            </summary>
            <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap p-3 rounded-lg" style={{color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-hairline)'}}>
              {parseResult.log}
            </pre>
          </details>
        </>
      )}

      <div className="flex justify-between gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => setStep('text')}
          className="px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all"
          style={{color: 'var(--color-body-text)'}}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <ChevronLeft className="w-4 h-4" />
          重新输入
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => setStep('form')}
          className="px-5 py-2.5 text-white rounded-lg font-medium flex items-center gap-2 transition-all"
          style={{backgroundColor: 'var(--color-primary)'}}
        >
          {parseResult?.success ? '确认并编辑' : '手动输入'}
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>
          公司名称 <span style={{color: 'var(--color-error)'}}>*</span>
        </label>
        <input
          type="text"
          value={formData.companyName}
          onChange={(e) => handleFormChange('companyName', e.target.value)}
          required
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>
          岗位 <span style={{color: 'var(--color-error)'}}>*</span>
        </label>
        <input
          type="text"
          value={formData.position}
          onChange={(e) => handleFormChange('position', e.target.value)}
          required
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>
          面试时间 <span style={{color: 'var(--color-error)'}}>*</span>
        </label>
        <input
          type="datetime-local"
          value={formData.interviewTime ? dayjs(formData.interviewTime).format('YYYY-MM-DDTHH:mm') : ''}
          onChange={(e) => handleFormChange('interviewTime', e.target.value)}
          required
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>面试形式</label>
        <select
          value={formData.interviewType}
          onChange={(e) => handleFormChange('interviewType', e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="VIDEO">视频面试</option>
          <option value="ONSITE">现场面试</option>
          <option value="PHONE">电话面试</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>会议链接</label>
        <input
          type="url"
          value={formData.meetingLink}
          onChange={(e) => handleFormChange('meetingLink', e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>第几轮面试</label>
          <input
            type="number"
            min="1"
            value={formData.roundNumber}
            onChange={(e) => handleFormChange('roundNumber', parseInt(e.target.value))}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>面试官</label>
          <input
            type="text"
            value={formData.interviewer}
            onChange={(e) => handleFormChange('interviewer', e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>备注</label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleFormChange('notes', e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      </div>

      {submitError && (
        <div className="p-4 rounded-lg flex items-start gap-3" style={{backgroundColor: 'rgba(198,69,69,0.08)', border: '1px solid rgba(198,69,69,0.3)', color: 'var(--color-error)'}}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{submitError}</div>
        </div>
      )}

      <div className="flex justify-between pt-5 gap-3">
        {mode === 'create' && step !== 'text' ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleReset}
            className="px-5 py-2.5 rounded-lg font-medium transition-all"
            style={{color: 'var(--color-body-text)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            重置
          </motion.button>
        ) : mode === 'edit' && onDelete && initialData?.id ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onDelete(initialData.id!)}
            className="px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all"
            style={{color: 'var(--color-error)', border: '1px solid rgba(198,69,69,0.3)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(198,69,69,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Trash2 className="w-4 h-4" />
            删除
          </motion.button>
        ) : null}
        <div className="flex gap-3 ml-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg font-medium transition-all"
            style={{color: 'var(--color-body-text)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            取消
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{backgroundColor: 'var(--color-primary)'}}
          >
            {submitting ? '保存中...' : '保存'}
          </motion.button>
        </div>
      </div>
    </form>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{backgroundColor: 'rgba(20,20,19,0.5)'}}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-hairline)'}}
      >
        <div className="flex items-center justify-between p-6" style={{borderBottom: '1px solid var(--color-hairline)'}}>
          <h2 className="text-2xl font-bold" style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)'}}>
            {mode === 'edit' ? '编辑面试' : '添加面试'}
          </h2>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-lg transition-all"
            style={{color: 'var(--color-muted)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        <div className="p-6">
          {step === 'text' && renderTextInput()}
          {step === 'parse-result' && renderParseResult()}
          {step === 'form' && renderForm()}
        </div>
      </motion.div>
    </motion.div>
  );
};
