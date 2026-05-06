import {useState, useEffect, useCallback, useMemo} from 'react';
import type {ReactNode} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {
  Settings, Plus, Trash2, Plug, CheckCircle, XCircle,
  Loader2, Eye, EyeOff, RefreshCw, Server, Edit2, Mic, Volume2, ChevronDown, Database,
} from 'lucide-react';
import {llmProviderApi} from '../api/llmProvider';
import ConfirmDialog from '../components/ConfirmDialog';
import type {
  ProviderItem, CreateProviderRequest, UpdateProviderRequest,
  ProviderTestResult, AsrConfig, TtsConfig, AsrConfigRequest, TtsConfigRequest,
} from '../types/llmProvider';

const PROVIDER_PRESETS: Record<string, {
  baseUrl: string;
  models: { value: string; label: string }[];
  embeddingModels?: { value: string; label: string }[];
  embeddingDimensions?: number;
  supportsEmbedding: boolean;
}> = {
  dashscope: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      {value: 'qwen3.6-flash', label: 'Qwen3.6 Flash — 最新旗舰'},
      {value: 'qwen3.5-plus', label: 'Qwen3.5 Plus — 高性能'},
      {value: 'qwen3.5-flash', label: 'Qwen3.5 Flash — 性价比'},
      {value: 'qwen3-max', label: 'Qwen3 Max — 旗舰'},
      {value: 'qwen-max', label: 'Qwen Max — 稳定版'},
      {value: 'qwen-plus', label: 'Qwen Plus — 均衡'},
      {value: 'qwen-flash', label: 'Qwen Flash — 经济'},
      {value: 'qwq-32b', label: 'QwQ-32B — 推理专用'},
    ],
    embeddingModels: [
      {value: 'text-embedding-v3', label: 'text-embedding-v3 — 推荐'},
    ],
    embeddingDimensions: 1024,
    supportsEmbedding: true,
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    models: [
      {value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash — 最新·快速'},
      {value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro — 最强推理'},
      {value: 'deepseek-chat', label: 'DeepSeek V3.2 — 旧版对话（即将弃用）'},
      {value: 'deepseek-reasoner', label: 'DeepSeek R1 — 旧版推理（即将弃用）'},
    ],
    supportsEmbedding: false,
  },
  glm: {
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    models: [
      {value: 'glm-5.1', label: 'GLM-5.1 — 最新旗舰'},
      {value: 'glm-5', label: 'GLM-5 — 旗舰'},
      {value: 'glm-4.7', label: 'GLM-4.7 — Coding 强'},
      {value: 'glm-4.7-flash', label: 'GLM-4.7 Flash — 免费'},
      {value: 'glm-4.6', label: 'GLM-4.6 — 200K 上下文'},
      {value: 'glm-4-plus', label: 'GLM-4 Plus — 高性能'},
      {value: 'glm-4-air-250414', label: 'GLM-4 Air — 高性价比'},
      {value: 'glm-4-flash-250414', label: 'GLM-4 Flash — 免费'},
    ],
    embeddingModels: [
      {value: 'embedding-3', label: 'embedding-3 — 推荐'},
    ],
    embeddingDimensions: 1024,
    supportsEmbedding: true,
  },
  kimi: {
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      {value: 'kimi-k2.6', label: 'Kimi K2.6 — 最新最智能'},
      {value: 'kimi-k2.5', label: 'Kimi K2.5 — 多模态'},
      {value: 'kimi-k2', label: 'Kimi K2 — MoE 基座'},
      {value: 'kimi-k2-thinking', label: 'Kimi K2 Thinking — 深度推理'},
      {value: 'kimi-latest', label: 'kimi-latest — 自动最新'},
    ],
    supportsEmbedding: false,
  },
};

type ConfigRowProps = {
  label: string;
  value: ReactNode;
  title?: string;
  monospace?: boolean;
  emphasis?: boolean;
};

type StatusBadgeProps = {
  icon: ReactNode;
  children: ReactNode;
};

function StatusBadge({icon, children}: StatusBadgeProps) {
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded px-2 text-[11px] font-medium"
      style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-primary)'}}
    >
      {icon}
      {children}
    </span>
  );
}

function ConfigRow({label, value, title, monospace = false, emphasis = false}: ConfigRowProps) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-2.5 rounded px-1.5 py-1.5 text-xs"
    style={emphasis ? {backgroundColor: 'var(--color-surface-card)', boxShadow: '0 0 0 1px var(--color-hairline)'} : {}}
    >
      <dt className="whitespace-nowrap" style={{color: 'var(--color-muted)'}}>{label}</dt>
      <dd className={`min-w-0 truncate text-right font-medium ${monospace ? 'font-mono' : ''}`}
        style={{color: 'var(--color-body-text)'}} title={title}>
        {value}
      </dd>
    </div>
  );
}

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [defaultProviderId, setDefaultProviderId] = useState('');
  const [defaultEmbeddingProviderId, setDefaultEmbeddingProviderId] = useState('');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [formId, setFormId] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formEmbeddingModel, setFormEmbeddingModel] = useState('');
  const [formEmbeddingDimensions, setFormEmbeddingDimensions] = useState('1024');
  const [formSupportsEmbedding, setFormSupportsEmbedding] = useState(false);
  const [formTemperature, setFormTemperature] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showEmbeddingDropdown, setShowEmbeddingDropdown] = useState(false);

  const currentPreset = useMemo(() => PROVIDER_PRESETS[formId.toLowerCase()], [formId]);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingDefaultProviderId, setPendingDefaultProviderId] = useState<string | null>(null);
  const [pendingDefaultEmbeddingProviderId, setPendingDefaultEmbeddingProviderId] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);
  const [settingEmbeddingDefault, setSettingEmbeddingDefault] = useState(false);

  const pendingEmbeddingProvider = useMemo(
    () => providers.find(p => p.id === pendingDefaultEmbeddingProviderId) ?? null,
    [pendingDefaultEmbeddingProviderId, providers],
  );

  const [asrConfig, setAsrConfig] = useState<AsrConfig | null>(null);
  const [ttsConfig, setTtsConfig] = useState<TtsConfig | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState<'asr' | 'tts' | null>(null);
  const [testingAsr, setTestingAsr] = useState(false);
  const [asrTestResult, setAsrTestResult] = useState<ProviderTestResult | null>(null);
  const [voiceSaving, setVoiceSaving] = useState(false);

  const [asrForm, setAsrForm] = useState<AsrConfigRequest>({});
  const [ttsForm, setTtsForm] = useState<TtsConfigRequest>({});

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  }, []);

  const isGlobalDefaultProvider = useCallback((id: string) => defaultProviderId === id, [defaultProviderId]);
  const isDefaultEmbeddingProvider = useCallback((id: string) => defaultEmbeddingProviderId === id, [defaultEmbeddingProviderId]);

  const loadData = useCallback(async () => {
    try {
      const [providerList, defaultProvider, asr, tts] = await Promise.all([
        llmProviderApi.list(),
        llmProviderApi.getDefaultProvider(),
        llmProviderApi.getAsrConfig(),
        llmProviderApi.getTtsConfig(),
      ]);
      setProviders(providerList);
      setDefaultProviderId(defaultProvider.defaultProvider);
      setDefaultEmbeddingProviderId(defaultProvider.defaultEmbeddingProvider);
      setAsrConfig(asr);
      setTtsConfig(tts);
    } catch (err) {
      console.error('Failed to load settings:', err);
      showToast('加载数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreateModal = () => {
    setEditingProvider(null);
    setFormId('');
    setFormBaseUrl('');
    setFormApiKey('');
    setFormModel('');
    setFormEmbeddingModel('');
    setFormEmbeddingDimensions('1024');
    setFormSupportsEmbedding(false);
    setShowApiKey(false);
    setShowModal(true);
  };

  const openEditModal = (provider: ProviderItem) => {
    setEditingProvider(provider);
    setFormId(provider.id);
    setFormBaseUrl(provider.baseUrl);
    setFormApiKey('');
    setFormModel(provider.model);
    setFormEmbeddingModel(provider.embeddingModel || '');
    setFormEmbeddingDimensions(provider.embeddingDimensions != null ? String(provider.embeddingDimensions) : '1024');
    setFormSupportsEmbedding(provider.supportsEmbedding);
    setFormTemperature(provider.temperature != null ? String(provider.temperature) : '');
    setShowApiKey(false);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingProvider(null); };

  const handleCreate = async () => {
    if (!formId.trim() || !formBaseUrl.trim() || !formApiKey.trim() || !formModel.trim()) {
      showToast('请填写必填字段', 'error');
      return;
    }
    if (formSupportsEmbedding && !formEmbeddingModel.trim()) {
      showToast('支持向量化时需要填写向量模型', 'error');
      return;
    }
    const embeddingDimensions = parseInt(formEmbeddingDimensions.trim(), 10);
    if (formSupportsEmbedding && (!Number.isFinite(embeddingDimensions) || embeddingDimensions <= 0)) {
      showToast('向量维度必须为正整数', 'error');
      return;
    }
    setSaving(true);
    try {
      const data: CreateProviderRequest = {
        id: formId.trim(), baseUrl: formBaseUrl.trim(), apiKey: formApiKey.trim(),
        model: formModel.trim(), supportsEmbedding: formSupportsEmbedding,
      };
      if (formEmbeddingModel.trim()) { data.embeddingModel = formEmbeddingModel.trim(); data.embeddingDimensions = embeddingDimensions; }
      if (formTemperature.trim()) { const t = parseFloat(formTemperature.trim()); if (!isNaN(t)) data.temperature = t; }
      await llmProviderApi.create(data);
      showToast('Provider 创建成功');
      closeModal();
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '创建失败', 'error');
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editingProvider) return;
    if (!formBaseUrl.trim() || !formModel.trim()) { showToast('请填写必填字段', 'error'); return; }
    if (formSupportsEmbedding && !formEmbeddingModel.trim()) { showToast('支持向量化时需要填写向量模型', 'error'); return; }
    const embeddingDimensions = parseInt(formEmbeddingDimensions.trim(), 10);
    if (formSupportsEmbedding && (!Number.isFinite(embeddingDimensions) || embeddingDimensions <= 0)) { showToast('向量维度必须为正整数', 'error'); return; }
    setSaving(true);
    try {
      const data: UpdateProviderRequest = {
        baseUrl: formBaseUrl.trim(), model: formModel.trim(),
        embeddingModel: formEmbeddingModel.trim(), supportsEmbedding: formSupportsEmbedding,
      };
      if (formSupportsEmbedding) data.embeddingDimensions = embeddingDimensions;
      if (formApiKey.trim()) data.apiKey = formApiKey.trim();
      if (formTemperature.trim()) { const t = parseFloat(formTemperature.trim()); if (!isNaN(t)) data.temperature = t; }
      await llmProviderApi.update(editingProvider.id, data);
      showToast('Provider 更新成功');
      closeModal();
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '更新失败', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await llmProviderApi.delete(deleteConfirmId);
      showToast('Provider 已删除');
      setDeleteConfirmId(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败', 'error');
    } finally { setDeleting(false); }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResults(prev => { const next = {...prev}; delete next[id]; return next; });
    try {
      const result = await llmProviderApi.test(id);
      setTestResults(prev => ({...prev, [id]: result}));
    } catch (err) {
      setTestResults(prev => ({...prev, [id]: {success: false, message: err instanceof Error ? err.message : '连接测试失败', model: ''}}));
    } finally { setTestingId(null); }
  };

  const handleSetDefault = async (providerId: string) => { setPendingDefaultProviderId(providerId); };

  const handleConfirmSetDefault = async () => {
    if (!pendingDefaultProviderId) return;
    setSettingDefault(true);
    try {
      await llmProviderApi.updateDefaultProvider({defaultProvider: pendingDefaultProviderId, defaultEmbeddingProvider: defaultEmbeddingProviderId});
      showToast(`已将 "${pendingDefaultProviderId}" 设为默认聊天服务`);
      setPendingDefaultProviderId(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '设置失败', 'error');
    } finally { setSettingDefault(false); }
  };

  const handleSetEmbeddingDefault = async (provider: ProviderItem) => {
    if (!provider.supportsEmbedding || !provider.embeddingModel) { showToast('该 Provider 不支持 Embedding', 'error'); return; }
    setPendingDefaultEmbeddingProviderId(provider.id);
  };

  const handleConfirmSetEmbeddingDefault = async () => {
    if (!pendingDefaultEmbeddingProviderId) return;
    setSettingEmbeddingDefault(true);
    try {
      await llmProviderApi.updateDefaultEmbeddingProvider({defaultProvider: defaultProviderId, defaultEmbeddingProvider: pendingDefaultEmbeddingProviderId});
      showToast(`已将 "${pendingDefaultEmbeddingProviderId}" 设为默认向量服务`);
      setPendingDefaultEmbeddingProviderId(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '设置失败', 'error');
    } finally { setSettingEmbeddingDefault(false); }
  };

  const handleSaveModal = () => { if (editingProvider) handleUpdate(); else handleCreate(); };

  const openAsrModal = () => {
    if (!asrConfig) return;
    setAsrForm({
      url: asrConfig.url, model: asrConfig.model, language: asrConfig.language,
      format: asrConfig.format, sampleRate: asrConfig.sampleRate,
      enableTurnDetection: asrConfig.enableTurnDetection, turnDetectionType: asrConfig.turnDetectionType,
      turnDetectionThreshold: asrConfig.turnDetectionThreshold, turnDetectionSilenceDurationMs: asrConfig.turnDetectionSilenceDurationMs,
    });
    setShowVoiceModal('asr');
  };

  const openTtsModal = () => {
    if (!ttsConfig) return;
    setTtsForm({
      model: ttsConfig.model, voice: ttsConfig.voice, format: ttsConfig.format,
      sampleRate: ttsConfig.sampleRate, mode: ttsConfig.mode, languageType: ttsConfig.languageType,
      speechRate: ttsConfig.speechRate, volume: ttsConfig.volume,
    });
    setShowVoiceModal('tts');
  };

  const handleSaveAsr = async () => {
    setVoiceSaving(true);
    try { await llmProviderApi.updateAsrConfig(asrForm); showToast('ASR 配置已更新'); setShowVoiceModal(null); await loadData(); }
    catch (err) { showToast(err instanceof Error ? err.message : '更新失败', 'error'); }
    finally { setVoiceSaving(false); }
  };

  const handleSaveTts = async () => {
    setVoiceSaving(true);
    try { await llmProviderApi.updateTtsConfig(ttsForm); showToast('TTS 配置已更新'); setShowVoiceModal(null); await loadData(); }
    catch (err) { showToast(err instanceof Error ? err.message : '更新失败', 'error'); }
    finally { setVoiceSaving(false); }
  };

  const handleTestAsr = async () => {
    setTestingAsr(true);
    setAsrTestResult(null);
    try { const result = await llmProviderApi.testAsr(); setAsrTestResult(result); }
    catch (err) { setAsrTestResult({success: false, message: err instanceof Error ? err.message : '连接测试失败', model: ''}); }
    finally { setTestingAsr(false); }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors";
  const inputStyle: React.CSSProperties = {
    borderColor: 'var(--color-hairline)',
    backgroundColor: 'var(--color-canvas)',
    color: 'var(--color-ink)',
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-primary)'}}
          >
            <Settings className="w-4 h-4"/>
          </div>
          <h1 className="text-xl font-semibold" style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)'}}>系统设置</h1>
        </div>
        <p className="text-sm ml-11" style={{color: 'var(--color-muted)'}}>管理聊天模型、向量模型和模块配置</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{color: 'var(--color-primary)'}}/>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key="providers" initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -8}} transition={{duration: 0.15}}>
            {/* Provider header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{color: 'var(--color-ink)'}}>模型服务</h2>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{backgroundColor: 'var(--color-primary)'}}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-active)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary)'; }}
              >
                <Plus className="w-4 h-4"/>
                新增 Provider
              </button>
            </div>

            {/* Provider grid */}
            {providers.length === 0 ? (
              <div className="text-center py-16 rounded-lg border" style={{backgroundColor: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)'}}>
                <Server className="w-10 h-10 mx-auto mb-3" style={{color: 'var(--color-muted-soft)'}}/>
                <p className="text-sm" style={{color: 'var(--color-muted)'}}>暂无 Provider，点击上方按钮新增</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
                {providers.map((provider, index) => {
                  const isGlobalDefault = isGlobalDefaultProvider(provider.id);
                  const isEmbeddingDefault = isDefaultEmbeddingProvider(provider.id);
                  const canUseEmbedding = provider.supportsEmbedding && !!provider.embeddingModel;

                  return (
                    <motion.div key={provider.id} initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} transition={{delay: index * 0.03}}
                      className="flex h-full flex-col rounded-lg border p-4"
                      style={{borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-surface-card)'}}
                    >
                      {/* Card header */}
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded"
                            style={{backgroundColor: 'var(--color-surface-soft)', color: 'var(--color-primary)'}}>
                            <Server className="h-3.5 w-3.5"/>
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium" style={{color: 'var(--color-ink)'}}>{provider.id}</h3>
                            <p className="text-[11px]" style={{color: 'var(--color-muted-soft)'}}>聊天/向量 Provider</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isGlobalDefault && <StatusBadge icon={<Plug className="h-3 w-3"/>}>文字默认</StatusBadge>}
                          {isEmbeddingDefault && <StatusBadge icon={<Database className="h-3 w-3"/>}>向量默认</StatusBadge>}
                        </div>
                      </div>

                      {/* Card details */}
                      <dl className="mb-3 flex-1 space-y-0.5 rounded border p-2.5"
                        style={{borderColor: 'var(--color-hairline-soft)', backgroundColor: 'var(--color-surface-soft)'}}>
                        <ConfigRow label="Base URL" value={provider.baseUrl} title={provider.baseUrl} emphasis/>
                        <ConfigRow label="聊天模型" value={provider.model} title={provider.model} emphasis/>
                        <ConfigRow label="向量模型" value={canUseEmbedding ? '支持' : '不支持'} title={canUseEmbedding ? provider.embeddingModel ?? '' : ''}/>
                        {provider.embeddingModel && <ConfigRow label="实际向量" value={provider.embeddingModel} title={provider.embeddingModel} emphasis={isEmbeddingDefault}/>}
                        {canUseEmbedding && <ConfigRow label="向量维度" value={`${provider.embeddingDimensions ?? 1024} 维`} emphasis={isEmbeddingDefault}/>}
                        {provider.temperature != null && <ConfigRow label="温度" value={provider.temperature}/>}
                        <ConfigRow label="API Key" value={provider.maskedApiKey} title={provider.maskedApiKey} monospace emphasis/>
                      </dl>

                      {/* Test result */}
                      {testResults[provider.id] && (
                        <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}}
                          className="mb-2.5 px-2.5 py-1.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: testResults[provider.id].success ? 'rgba(16,185,129,0.1)' : 'rgba(198,69,69,0.1)',
                            color: testResults[provider.id].success ? '#10b981' : 'var(--color-error)',
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            {testResults[provider.id].success ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0"/> : <XCircle className="w-3.5 h-3.5 flex-shrink-0"/>}
                            <span>{testResults[provider.id].message}</span>
                          </div>
                        </motion.div>
                      )}

                      {/* Card actions */}
                      <div className="mt-auto flex min-h-10 flex-wrap items-center gap-1.5 border-t pt-2.5" style={{borderColor: 'var(--color-hairline-soft)'}}>
                        <button onClick={() => openEditModal(provider)}
                          className="inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors"
                          style={{color: 'var(--color-muted)'}}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <Edit2 className="w-3 h-3"/> 编辑
                        </button>
                        <button onClick={() => handleTest(provider.id)} disabled={testingId === provider.id}
                          className="inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors disabled:opacity-50"
                          style={{color: 'var(--color-primary)'}}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          {testingId === provider.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
                          测试
                        </button>
                        <button onClick={() => handleSetDefault(provider.id)} disabled={isGlobalDefault || settingDefault}
                          className="inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors disabled:opacity-50"
                          style={{color: 'var(--color-primary)'}}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <Plug className="w-3 h-3"/> 设为文字
                        </button>
                        <button onClick={() => handleSetEmbeddingDefault(provider)} disabled={!canUseEmbedding || isEmbeddingDefault || settingEmbeddingDefault}
                          className="inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors disabled:opacity-50"
                          style={{color: 'var(--color-success)'}}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <Database className="w-3 h-3"/> 设为向量
                        </button>
                        <button onClick={() => setDeleteConfirmId(provider.id)}
                          className="ml-auto inline-flex h-7 items-center rounded px-2 transition-colors"
                          style={{color: 'var(--color-muted-soft)'}}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-error)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted-soft)'; }}
                        >
                          <Trash2 className="w-3 h-3"/>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Voice service cards */}
            <div className="mt-6">
              <h2 className="text-sm font-semibold mb-3" style={{color: 'var(--color-ink)'}}>语音服务</h2>
              <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
                {/* ASR Card */}
                {asrConfig && (
                  <motion.div initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}}
                    className="flex h-full flex-col rounded-lg border p-4"
                    style={{borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-surface-card)'}}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded"
                          style={{backgroundColor: 'var(--color-surface-soft)', color: 'var(--color-primary)'}}>
                          <Mic className="h-3.5 w-3.5"/>
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium" style={{color: 'var(--color-ink)'}}>ASR 语音识别</h3>
                          <p className="text-[11px]" style={{color: 'var(--color-muted-soft)'}}>实时语音转写配置</p>
                        </div>
                      </div>
                      <StatusBadge icon={<Mic className="h-3 w-3"/>}>语音服务</StatusBadge>
                    </div>

                    <dl className="mb-3 flex-1 space-y-0.5 rounded border p-2.5"
                      style={{borderColor: 'var(--color-hairline-soft)', backgroundColor: 'var(--color-surface-soft)'}}>
                      <ConfigRow label="WebSocket" value={asrConfig.url} title={asrConfig.url} emphasis/>
                      <ConfigRow label="识别模型" value={asrConfig.model} title={asrConfig.model} emphasis/>
                      <ConfigRow label="识别语言" value={asrConfig.language}/>
                      <ConfigRow label="采样率" value={`${asrConfig.sampleRate}Hz`}/>
                      <ConfigRow label="API Key" value={asrConfig.maskedApiKey} title={asrConfig.maskedApiKey} monospace emphasis/>
                    </dl>

                    {asrTestResult && (
                      <div className="mb-2.5 px-2.5 py-1.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: asrTestResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(198,69,69,0.1)',
                          color: asrTestResult.success ? '#10b981' : 'var(--color-error)',
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          {asrTestResult.success ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0"/> : <XCircle className="w-3.5 h-3.5 flex-shrink-0"/>}
                          <span>{asrTestResult.message}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex items-center gap-1.5 border-t pt-2.5" style={{borderColor: 'var(--color-hairline-soft)'}}>
                      <button onClick={openAsrModal}
                        className="inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors"
                        style={{color: 'var(--color-muted)'}}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        <Edit2 className="w-3 h-3"/> 编辑
                      </button>
                      <button onClick={handleTestAsr} disabled={testingAsr}
                        className="inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors disabled:opacity-50"
                        style={{color: 'var(--color-primary)'}}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        {testingAsr ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
                        测试
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* TTS Card */}
                {ttsConfig && (
                  <motion.div initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} transition={{delay: 0.03}}
                    className="flex h-full flex-col rounded-lg border p-4"
                    style={{borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-surface-card)'}}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded"
                          style={{backgroundColor: 'var(--color-surface-soft)', color: 'var(--color-primary)'}}>
                          <Volume2 className="h-3.5 w-3.5"/>
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium" style={{color: 'var(--color-ink)'}}>TTS 语音合成</h3>
                          <p className="text-[11px]" style={{color: 'var(--color-muted-soft)'}}>文本转语音输出配置</p>
                        </div>
                      </div>
                      <StatusBadge icon={<Volume2 className="h-3 w-3"/>}>语音服务</StatusBadge>
                    </div>

                    <dl className="mb-3 flex-1 space-y-0.5 rounded border p-2.5"
                      style={{borderColor: 'var(--color-hairline-soft)', backgroundColor: 'var(--color-surface-soft)'}}>
                      <ConfigRow label="合成模型" value={ttsConfig.model} title={ttsConfig.model} emphasis/>
                      <ConfigRow label="音色" value={ttsConfig.voice} title={ttsConfig.voice} emphasis/>
                      <ConfigRow label="采样率" value={`${ttsConfig.sampleRate}Hz`}/>
                      <ConfigRow label="音量" value={ttsConfig.volume}/>
                      <ConfigRow label="API Key" value={ttsConfig.maskedApiKey} title={ttsConfig.maskedApiKey} monospace emphasis/>
                    </dl>

                    <div className="mt-auto flex items-center gap-1.5 border-t pt-2.5" style={{borderColor: 'var(--color-hairline-soft)'}}>
                      <button onClick={openTtsModal}
                        className="inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors"
                        style={{color: 'var(--color-muted)'}}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        <Edit2 className="w-3 h-3"/> 编辑
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={closeModal} className="fixed inset-0 z-50" style={{backgroundColor: 'rgba(20,20,19,0.5)'}}/>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{opacity: 0, scale: 0.95, y: 16}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.95, y: 16}}
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg border max-w-lg w-full p-5"
                style={{backgroundColor: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)'}}
              >
                <h3 className="text-base font-semibold mb-4" style={{color: 'var(--color-ink)'}}>
                  {editingProvider ? '编辑 Provider' : '新增 Provider'}
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Provider ID <span style={{color: 'var(--color-error)'}}>*</span></label>
                    <input type="text" value={formId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setFormId(newId);
                        if (!editingProvider) {
                          const preset = PROVIDER_PRESETS[newId.toLowerCase()];
                          if (preset) {
                            setFormBaseUrl(preset.baseUrl);
                            setFormSupportsEmbedding(preset.supportsEmbedding);
                            setFormEmbeddingModel(preset.embeddingModels?.[0]?.value ?? '');
                            setFormEmbeddingDimensions(String(preset.embeddingDimensions ?? 1024));
                          }
                        }
                      }}
                      disabled={!!editingProvider}
                      placeholder="例如: dashscope, deepseek, glm, kimi"
                      className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Base URL <span style={{color: 'var(--color-error)'}}>*</span></label>
                    <input type="text" value={formBaseUrl} onChange={(e) => setFormBaseUrl(e.target.value)} placeholder="例如: https://api.openai.com/v1" className={inputClass} style={inputStyle}/>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>
                      API Key {editingProvider && <span style={{color: 'var(--color-muted)'}}>(留空不改)</span>}{!editingProvider && <span style={{color: 'var(--color-error)'}}>*</span>}
                    </label>
                    <div className="relative">
                      <input type={showApiKey ? 'text' : 'password'} value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)}
                        placeholder={editingProvider ? '留空则保持原值' : '输入 API Key'} className={`${inputClass} pr-9`} style={inputStyle}/>
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                        style={{color: 'var(--color-muted)'}}>
                        {showApiKey ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>聊天模型 <span style={{color: 'var(--color-error)'}}>*</span></label>
                    <div className="relative">
                      <input type="text" value={formModel}
                        onChange={(e) => { setFormModel(e.target.value); setShowModelDropdown(false); }}
                        onFocus={() => currentPreset && setShowModelDropdown(true)}
                        onBlur={() => setTimeout(() => setShowModelDropdown(false), 150)}
                        placeholder={currentPreset ? '从下拉列表选择或输入模型名' : '例如: qwen3.5-flash, deepseek-v4-flash'} className={inputClass} style={inputStyle}/>
                      {currentPreset && (
                        <button type="button" onClick={() => setShowModelDropdown(!showModelDropdown)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                          style={{color: 'var(--color-muted)'}}>
                          <ChevronDown className="w-4 h-4"/>
                        </button>
                      )}
                      {showModelDropdown && currentPreset && (
                        <div className="absolute z-10 mt-1 w-full border rounded-lg shadow-lg max-h-52 overflow-auto"
                          style={{backgroundColor: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)'}}>
                          {currentPreset.models.map((m) => (
                            <button key={m.value} type="button" onClick={() => { setFormModel(m.value); setShowModelDropdown(false); }}
                              className="w-full px-3 py-2 text-left text-xs transition-colors flex justify-between items-center"
                              style={{
                                color: formModel === m.value ? 'var(--color-primary)' : 'var(--color-body-text)',
                                backgroundColor: formModel === m.value ? 'var(--color-surface-soft)' : 'transparent',
                              }}
                              onMouseEnter={e => { if (formModel !== m.value) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                              onMouseLeave={e => { if (formModel !== m.value) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            >
                              <span className="font-mono">{m.value}</span>
                              <span className="text-[11px] ml-2 whitespace-nowrap" style={{color: 'var(--color-muted)'}}>{m.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <label className="block text-xs font-medium" style={{color: 'var(--color-body-text)'}}>向量模型</label>
                      <label className="inline-flex items-center gap-1.5 text-xs" style={{color: 'var(--color-muted)'}}>
                        <input type="checkbox" checked={formSupportsEmbedding}
                          onChange={(e) => { setFormSupportsEmbedding(e.target.checked); if (!e.target.checked) { setFormEmbeddingModel(''); setFormEmbeddingDimensions('1024'); }}}
                          className="h-3.5 w-3.5 rounded"
                          style={{accentColor: 'var(--color-primary)'}}
                        />
                        支持 Embedding
                      </label>
                    </div>
                    <div className="relative">
                      <input type="text" value={formEmbeddingModel}
                        onChange={(e) => { setFormEmbeddingModel(e.target.value); setShowEmbeddingDropdown(false); }}
                        onFocus={() => formSupportsEmbedding && currentPreset?.embeddingModels && setShowEmbeddingDropdown(true)}
                        onBlur={() => setTimeout(() => setShowEmbeddingDropdown(false), 150)}
                        disabled={!formSupportsEmbedding}
                        placeholder={formSupportsEmbedding ? '选择或输入向量模型名' : '该 Provider 通常不支持 Embedding'}
                        className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
                        style={inputStyle}/>
                      {formSupportsEmbedding && currentPreset?.embeddingModels && (
                        <button type="button" onClick={() => setShowEmbeddingDropdown(!showEmbeddingDropdown)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                          style={{color: 'var(--color-muted)'}}>
                          <ChevronDown className="w-4 h-4"/>
                        </button>
                      )}
                      {formSupportsEmbedding && showEmbeddingDropdown && currentPreset?.embeddingModels && (
                        <div className="absolute z-10 mt-1 w-full border rounded-lg shadow-lg max-h-52 overflow-auto"
                          style={{backgroundColor: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)'}}>
                          {currentPreset.embeddingModels.map((m) => (
                            <button key={m.value} type="button" onClick={() => { setFormEmbeddingModel(m.value); setShowEmbeddingDropdown(false); }}
                              className="w-full px-3 py-2 text-left text-xs transition-colors flex justify-between items-center"
                              style={{
                                color: formEmbeddingModel === m.value ? 'var(--color-primary)' : 'var(--color-body-text)',
                                backgroundColor: formEmbeddingModel === m.value ? 'var(--color-surface-soft)' : 'transparent',
                              }}
                            >
                              <span className="font-mono">{m.value}</span>
                              <span className="text-[11px] ml-2 whitespace-nowrap" style={{color: 'var(--color-muted)'}}>{m.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {formSupportsEmbedding && (
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>向量维度</label>
                      <input type="number" min={1} value={formEmbeddingDimensions} onChange={(e) => setFormEmbeddingDimensions(e.target.value)} placeholder="1024" className={inputClass} style={inputStyle}/>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Temperature <span style={{color: 'var(--color-muted)'}}>(可选, 默认 0.2)</span></label>
                    <input type="text" value={formTemperature} onChange={(e) => setFormTemperature(e.target.value)} placeholder="例如: 0.2, 0.7, 1" className={inputClass} style={inputStyle}/>
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-5">
                  <button onClick={closeModal} disabled={saving}
                    className="px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{borderColor: 'var(--color-hairline)', color: 'var(--color-body-text)'}}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    取消
                  </button>
                  <button onClick={handleSaveModal} disabled={saving}
                    className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{backgroundColor: 'var(--color-primary)'}}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-active)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary)'; }}
                  >
                    {saving ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> 保存中...</span> : '保存'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Voice Edit Modal */}
      <AnimatePresence>
        {showVoiceModal && (
          <>
            <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={() => setShowVoiceModal(null)} className="fixed inset-0 z-50" style={{backgroundColor: 'rgba(20,20,19,0.5)'}}/>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{opacity: 0, scale: 0.95, y: 16}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.95, y: 16}}
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg border max-w-lg w-full p-5 max-h-[85vh] overflow-y-auto"
                style={{backgroundColor: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)'}}
              >
                <h3 className="text-base font-semibold mb-4" style={{color: 'var(--color-ink)'}}>
                  {showVoiceModal === 'asr' ? '编辑 ASR 语音识别' : '编辑 TTS 语音合成'}
                </h3>

                {showVoiceModal === 'asr' ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider pt-1" style={{color: 'var(--color-muted)'}}>连接配置</p>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>WebSocket URL</label>
                      <input type="text" value={asrForm.url || ''} onChange={(e) => setAsrForm(f => ({...f, url: e.target.value}))} className={inputClass} style={inputStyle}/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Model</label>
                        <input type="text" value={asrForm.model || ''} onChange={(e) => setAsrForm(f => ({...f, model: e.target.value}))} className={inputClass} style={inputStyle}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>API Key <span style={{color: 'var(--color-muted)'}}>(留空不改)</span></label>
                        <input type="password" value={asrForm.apiKey || ''} onChange={(e) => setAsrForm(f => ({...f, apiKey: e.target.value}))} placeholder="留空则保持原值" className={inputClass} style={inputStyle}/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Language</label>
                      <input type="text" value={asrForm.language || ''} onChange={(e) => setAsrForm(f => ({...f, language: e.target.value}))} className={inputClass} style={inputStyle}/>
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider pt-1" style={{color: 'var(--color-muted)'}}>音频参数</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Format</label>
                        <input type="text" value={asrForm.format || ''} onChange={(e) => setAsrForm(f => ({...f, format: e.target.value}))} className={inputClass} style={inputStyle}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Sample Rate</label>
                        <input type="number" value={asrForm.sampleRate || 0} onChange={(e) => setAsrForm(f => ({...f, sampleRate: Number(e.target.value)}))} className={inputClass} style={inputStyle}/>
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider pt-1" style={{color: 'var(--color-muted)'}}>VAD 参数</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Turn Detection</label>
                        <select value={asrForm.enableTurnDetection ? 'true' : 'false'} onChange={(e) => setAsrForm(f => ({...f, enableTurnDetection: e.target.value === 'true'}))} className={inputClass} style={inputStyle}>
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Detection Type</label>
                        <input type="text" value={asrForm.turnDetectionType || ''} onChange={(e) => setAsrForm(f => ({...f, turnDetectionType: e.target.value}))} className={inputClass} style={inputStyle}/>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Threshold</label>
                        <input type="number" step="0.1" value={asrForm.turnDetectionThreshold || 0} onChange={(e) => setAsrForm(f => ({...f, turnDetectionThreshold: Number(e.target.value)}))} className={inputClass} style={inputStyle}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Silence (ms)</label>
                        <input type="number" value={asrForm.turnDetectionSilenceDurationMs || 0} onChange={(e) => setAsrForm(f => ({...f, turnDetectionSilenceDurationMs: Number(e.target.value)}))} className={inputClass} style={inputStyle}/>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider pt-1" style={{color: 'var(--color-muted)'}}>连接配置</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Model</label>
                        <input type="text" value={ttsForm.model || ''} onChange={(e) => setTtsForm(f => ({...f, model: e.target.value}))} className={inputClass} style={inputStyle}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>API Key <span style={{color: 'var(--color-muted)'}}>(留空不改)</span></label>
                        <input type="password" value={ttsForm.apiKey || ''} onChange={(e) => setTtsForm(f => ({...f, apiKey: e.target.value}))} placeholder="留空则保持原值" className={inputClass} style={inputStyle}/>
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider pt-1" style={{color: 'var(--color-muted)'}}>语音参数</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Voice</label>
                        <input type="text" value={ttsForm.voice || ''} onChange={(e) => setTtsForm(f => ({...f, voice: e.target.value}))} className={inputClass} style={inputStyle}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Format</label>
                        <input type="text" value={ttsForm.format || ''} onChange={(e) => setTtsForm(f => ({...f, format: e.target.value}))} className={inputClass} style={inputStyle}/>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Sample Rate</label>
                        <input type="number" value={ttsForm.sampleRate || 0} onChange={(e) => setTtsForm(f => ({...f, sampleRate: Number(e.target.value)}))} className={inputClass} style={inputStyle}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Mode</label>
                        <input type="text" value={ttsForm.mode || ''} onChange={(e) => setTtsForm(f => ({...f, mode: e.target.value}))} className={inputClass} style={inputStyle}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Language</label>
                        <input type="text" value={ttsForm.languageType || ''} onChange={(e) => setTtsForm(f => ({...f, languageType: e.target.value}))} className={inputClass} style={inputStyle}/>
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider pt-1" style={{color: 'var(--color-muted)'}}>输出控制</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Speech Rate</label>
                        <input type="number" step="0.1" value={ttsForm.speechRate || 0} onChange={(e) => setTtsForm(f => ({...f, speechRate: Number(e.target.value)}))} className={inputClass} style={inputStyle}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{color: 'var(--color-body-text)'}}>Volume</label>
                        <input type="number" value={ttsForm.volume || 0} onChange={(e) => setTtsForm(f => ({...f, volume: Number(e.target.value)}))} className={inputClass} style={inputStyle}/>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end mt-5">
                  <button onClick={() => setShowVoiceModal(null)} disabled={voiceSaving}
                    className="px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{borderColor: 'var(--color-hairline)', color: 'var(--color-body-text)'}}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    取消
                  </button>
                  <button onClick={showVoiceModal === 'asr' ? handleSaveAsr : handleSaveTts} disabled={voiceSaving}
                    className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{backgroundColor: 'var(--color-primary)'}}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-active)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary)'; }}
                  >
                    {voiceSaving ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> 保存中...</span> : '保存'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog open={pendingDefaultProviderId !== null} title="设为默认聊天服务"
        message={`确定要将 "${pendingDefaultProviderId ?? ''}" 设为默认聊天服务吗？该操作不会改变知识库使用的向量模型。`}
        confirmText="确认设置" cancelText="取消" loading={settingDefault}
        onConfirm={handleConfirmSetDefault} onCancel={() => { if (!settingDefault) setPendingDefaultProviderId(null); }}/>

      <ConfirmDialog open={pendingDefaultEmbeddingProviderId !== null} title="设为默认向量服务"
        message={`确定要将 "${pendingDefaultEmbeddingProviderId ?? ''}" 的向量模型 "${pendingEmbeddingProvider?.embeddingModel ?? ''}"（${pendingEmbeddingProvider?.embeddingDimensions ?? 1024}维）设为知识库默认向量服务吗？`}
        confirmText="确认设置" cancelText="取消" loading={settingEmbeddingDefault}
        onConfirm={handleConfirmSetEmbeddingDefault} onCancel={() => { if (!settingEmbeddingDefault) setPendingDefaultEmbeddingProviderId(null); }}/>

      <AnimatePresence>
        {deleteConfirmId && (
          <>
            <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={() => setDeleteConfirmId(null)} className="fixed inset-0 z-50" style={{backgroundColor: 'rgba(20,20,19,0.5)'}}/>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{opacity: 0, scale: 0.95, y: 16}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.95, y: 16}}
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg border max-w-md w-full p-5"
                style={{backgroundColor: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)'}}
              >
                <h3 className="text-base font-semibold mb-3" style={{color: 'var(--color-ink)'}}>删除 Provider</h3>
                <p className="text-sm mb-5" style={{color: 'var(--color-body-text)'}}>
                  确定要删除 Provider &ldquo;{deleteConfirmId}&rdquo; 吗？删除后无法恢复。
                  如果有模块正在使用此 Provider，请先切换到其他 Provider。
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setDeleteConfirmId(null)} disabled={deleting}
                    className="px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{borderColor: 'var(--color-hairline)', color: 'var(--color-body-text)'}}
                  >
                    取消
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{backgroundColor: 'var(--color-error)'}}
                  >
                    {deleting ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> 删除中...</span> : '确定删除'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{opacity: 0, y: 40, x: '-50%'}}
            animate={{opacity: 1, y: 0, x: '-50%'}}
            exit={{opacity: 0, y: 40, x: '-50%'}}
            className="fixed bottom-5 left-1/2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 z-[60]"
            style={{
              backgroundColor: toast.type === 'success' ? 'var(--color-ink)' : 'var(--color-error)',
              color: 'white',
            }}
          >
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
