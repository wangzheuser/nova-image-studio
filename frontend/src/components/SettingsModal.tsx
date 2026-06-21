'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Key, Info, Eye, EyeOff, ExternalLink, PencilLine, ShieldCheck, Trash2, RefreshCw, CheckCircle2, XCircle, Database, Download, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackupProgress } from '@/components/BackupProgress';
import { exportAllData, importAllData, downloadBlob, generateBackupFilename, type BackupProgress as BackupProgressType } from '@/lib/backup-utils';
import { checkModelsAvailability, type ModelStatus } from '@/lib/ccode-task-client';
import { MODEL_OPTIONS, TOKEN_MODEL_OPTIONS } from '@/lib/gemini-config';
import { REVERSE_PROMPT_MODEL_OPTIONS } from '@/lib/reverse-prompt-config';
import {
  getApiKeyFromStorage,
  getStoredApiKey,
  hasAnyApiKey,
  removeStoredApiKey,
  setStoredApiKey,
} from '@/lib/settings-storage';
import { BA_RANDOM_URL, BING_WALLPAPER_URL } from '@/lib/constants';
import { PROMPT_DATA_SOURCES, getPromptSourceLabel } from '@/lib/prompt-gallery-data';

export { getApiKeyFromStorage, hasAnyApiKey };

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeyChange?: (hasKey: boolean) => void;
}

export function SettingsModal({ isOpen, onClose, onApiKeyChange }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [checkingModels, setCheckingModels] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[] | null>(null);
  const [modelCheckError, setModelCheckError] = useState<string | null>(null);

  // 备份相关状态
  const [backupProgress, setBackupProgress] = useState<BackupProgressType>({ percent: 0, message: '' });
  const [isBackupActive, setIsBackupActive] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    queueMicrotask(() => {
      const storedKey = getStoredApiKey();
      setHasKey(!!storedKey);
      setApiKey('');
      setEditing(false);
      setShowKey(false);
      setError(null);
      setModelStatuses(null);
      setModelCheckError(null);
      setBackupError(null);
      setBackupSuccess(null);
    });
  }, [isOpen]);

  const saveKey = () => {
    if (!apiKey.trim()) return;
    setError(null);

    if (!setStoredApiKey(apiKey.trim())) {
      setError('浏览器阻止了本地存储，无法保存 API 密钥');
      return;
    }

    setHasKey(true);
    setEditing(false);
    setShowKey(false);
    setApiKey('');
    onApiKeyChange?.(true);
  };

  const removeKey = () => {
    removeStoredApiKey();
    setHasKey(false);
    setApiKey('');
    setEditing(false);
    setShowKey(false);
    setModelStatuses(null);
    setModelCheckError(null);
    onApiKeyChange?.(hasAnyApiKey());
  };

  const handleCheckModels = async () => {
    const storedKey = getStoredApiKey();
    if (!storedKey) {
      setModelCheckError('请先保存 API 密钥');
      return;
    }

    setCheckingModels(true);
    setModelCheckError(null);
    setModelStatuses(null);

    try {
      // 把图像生成模型 + token 模型 + 反推提示词模型一起送去检查（仅匹配 /v1/models 列表，不发付费请求）
      const allIds = [
        ...MODEL_OPTIONS.map(o => o.value),
        ...TOKEN_MODEL_OPTIONS.map(o => o.value),
        ...REVERSE_PROMPT_MODEL_OPTIONS.map(o => o.value),
      ];
      const statuses = await checkModelsAvailability(storedKey, allIds);
      setModelStatuses(statuses);
    } catch (err) {
      setModelCheckError(err instanceof Error ? err.message : '检查模型失败');
    } finally {
      setCheckingModels(false);
    }
  };

  const handleExport = async () => {
    setIsBackupActive(true);
    setBackupError(null);
    setBackupSuccess(null);

    try {
      const blob = await exportAllData((progress) => {
        setBackupProgress(progress);
      });

      const filename = generateBackupFilename();
      downloadBlob(blob, filename);
      setBackupSuccess(`数据已成功导出为 ${filename}`);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setIsBackupActive(false);
    }
  };

  const handleImport = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setBackupError('请选择有效的备份文件（.zip 格式）');
      return;
    }

    setIsBackupActive(true);
    setBackupError(null);
    setBackupSuccess(null);

    try {
      await importAllData(file, (progress) => {
        setBackupProgress(progress);
      });

      setBackupSuccess('数据已成功导入！页面将在 2 秒后刷新以应用更改...');

      // 延迟刷新页面以应用导入的数据
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : '导入失败');
      setIsBackupActive(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImport(file);
    }
    // 重置 input 以允许选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // 在备份操作进行时阻止关闭
      if (!open && isBackupActive) return;
      if (!open) onClose();
    }}>
      <DialogContent className="flex flex-col overflow-hidden p-0 pt-0 gap-0 sm:max-w-xl">
        <DialogHeader className="p-4 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <DialogTitle>设置</DialogTitle>
          </div>
          <DialogDescription>管理你的应用设置</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="api" className="min-h-0 flex-1 gap-0">
          <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger value="api" className="gap-2 rounded-none border-b-2 border-transparent data-active:border-primary data-active:bg-transparent data-active:shadow-none px-4 py-3">
              <Key className="w-4 h-4" />
              API 密钥
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-2 rounded-none border-b-2 border-transparent data-active:border-primary data-active:bg-transparent data-active:shadow-none px-4 py-3">
              <Database className="w-4 h-4" />
              备份
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-2 rounded-none border-b-2 border-transparent data-active:border-primary data-active:bg-transparent data-active:shadow-none px-4 py-3">
              <Info className="w-4 h-4" />
              关于
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 mt-0">
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                <p className="font-medium">你的密钥安全</p>
                <p className="mt-0.5">
                  Nova 密钥会发送到本机后端用于创建任务，但只保存在后端内存中，不会写入数据库。
                </p>
              </div>
            </div>

            {hasKey && !editing ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-3 sm:px-4 py-1.5 bg-muted rounded text-sm font-mono">
                  <span className="text-muted-foreground">KEY=</span>********************
                </code>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditing(true);
                    setApiKey(getStoredApiKey());
                  }} title="修改 API 密钥">
                    <PencilLine className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={removeKey} title="删除 API 密钥" className="hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-0 flex-[1_1_220px]">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setError(null); }}
                      placeholder="粘贴你的 Nova API 密钥"
                      autoComplete="off"
                      className="pl-10 pr-10"
                      onKeyDown={(e) => { if (e.key === 'Enter') saveKey(); }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button onClick={saveKey} disabled={!apiKey.trim()} className="flex-1 sm:flex-none">
                    保存
                  </Button>
                  {hasKey && (
                    <Button variant="outline" onClick={() => { setApiKey(''); setEditing(false); setShowKey(false); }} className="flex-1 sm:flex-none">
                      取消
                    </Button>
                  )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            )}

            {hasKey && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">模型可用性检查</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckModels}
                    disabled={checkingModels}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${checkingModels ? 'animate-spin' : ''}`} />
                    {checkingModels ? '检查中...' : '检查模型'}
                  </Button>
                </div>

                {modelCheckError && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg overflow-hidden">
                    <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-xs text-destructive break-all max-h-32 overflow-y-auto">{modelCheckError}</p>
                    </div>
                  </div>
                )}

                {modelStatuses && (() => {
                  const imageIds = new Set(MODEL_OPTIONS.map(o => o.value as string));
                  const tokenIds = new Set(TOKEN_MODEL_OPTIONS.map(o => o.value as string));
                  const reverseIds = new Set(REVERSE_PROMPT_MODEL_OPTIONS.map(o => o.value as string));
                  const imageStatuses = modelStatuses.filter(s => imageIds.has(s.modelId));
                  const tokenStatuses = modelStatuses.filter(s => tokenIds.has(s.modelId));
                  const reverseStatuses = modelStatuses.filter(s => reverseIds.has(s.modelId));
                  const renderRow = (status: ModelStatus) => {
                    const modelLabel =
                      MODEL_OPTIONS.find(m => m.value === status.modelId)?.label
                      || TOKEN_MODEL_OPTIONS.find(m => m.value === status.modelId)?.label
                      || REVERSE_PROMPT_MODEL_OPTIONS.find(m => m.value === status.modelId)?.label
                      || status.modelId;
                    return (
                      <div
                        key={status.modelId}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {status.available ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                          <span className="min-w-0 break-all text-sm font-medium">{modelLabel}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {status.available ? (
                            <span className="text-emerald-600">√ 可用</span>
                          ) : (
                            <span className="text-destructive">不可用</span>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-3">
                      {imageStatuses.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">图像生成模型</p>
                          <div className="space-y-2">
                            {imageStatuses.map(renderRow)}
                          </div>
                        </div>
                      )}
                      {tokenStatuses.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">按量计费模型</p>
                          <div className="space-y-2">
                            {tokenStatuses.map(renderRow)}
                          </div>
                        </div>
                      )}
                      {reverseStatuses.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">反推提示词模型</p>
                          <div className="space-y-2">
                            {reverseStatuses.map(renderRow)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                请在「提供商」标签页中配置 Google 或 OpenAI 的 API Key 和 Base URL。
              </p>
            </div>
          </TabsContent>

          <TabsContent value="backup" className="min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 mt-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-base font-medium">数据备份与恢复</h3>
                <p className="text-sm text-muted-foreground">
                  导出所有数据（API 密钥、任务历史、设置、图片）为 ZIP 压缩包，或从备份文件恢复数据。
                </p>
              </div>

              {/* 进度条和警告 */}
              <BackupProgress
                percent={backupProgress.percent}
                message={backupProgress.message}
                isActive={isBackupActive}
              />

              {/* 成功提示 */}
              {backupSuccess && !isBackupActive && (
                <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-900 dark:text-emerald-100">{backupSuccess}</p>
                </div>
              )}

              {/* 错误提示 */}
              {backupError && !isBackupActive && (
                <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive break-all">{backupError}</p>
                </div>
              )}

              {/* 导出区域 */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <h4 className="font-medium">导出数据</h4>
                    <p className="text-sm text-muted-foreground">
                      将所有数据打包为 ZIP 文件下载到本地。备份文件包含敏感信息（API 密钥），请妥善保管。
                    </p>
                    <Button
                      onClick={handleExport}
                      disabled={isBackupActive}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      全量备份
                    </Button>
                  </div>
                </div>
              </div>

              {/* 导入区域 */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Upload className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <h4 className="font-medium">导入数据</h4>
                    <p className="text-sm text-muted-foreground">
                      从备份文件恢复数据。<span className="font-medium text-destructive">警告：这将覆盖所有现有数据！</span>
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isBackupActive}
                      variant="outline"
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      选择备份文件
                    </Button>
                  </div>
                </div>
              </div>

              {/* 注意事项 */}
              <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">注意事项：</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>导出和导入过程中请勿关闭或刷新页面</li>
                  <li>备份文件包含 API 密钥等敏感信息，请勿分享给他人</li>
                  <li>导入数据会完全覆盖现有数据，建议先导出当前数据作为备份</li>
                  <li>导入完成后页面会自动刷新以应用更改</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="about" className="min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 mt-0">
            <div className="space-y-4 text-sm">
              <h3 className="text-lg font-medium">Nova Image <span className="text-xs text-muted-foreground font-normal">v{process.env.NEXT_PUBLIC_APP_VERSION}</span></h3>

              <details className="group p-3 bg-muted/50 rounded-lg">
                <summary className="flex cursor-pointer select-none items-center gap-2 font-medium">
                  <span className="text-[10px] opacity-60 transition-transform group-open:rotate-90">▶</span>
                  使用方法
                </summary>
                <ol className="mt-3 list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>
                    在「提供商」标签页中配置 API Key 和 Base URL
                  </li>
                  <li>粘贴到上方 API 密钥配置处</li>
                  <li>选择文生图或图生图模式并开始生成</li>
                </ol>
              </details>

              <details className="group p-3 bg-muted/50 rounded-lg">
                <summary className="flex cursor-pointer select-none items-center gap-2 font-medium">
                  <span className="text-[10px] opacity-60 transition-transform group-open:rotate-90">▶</span>
                  数据来源
                </summary>
                <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
                  <li>
                    <span className="text-foreground">提示词广场</span> - 提示词来源：
                    <ul className="mt-1 ml-5 list-disc list-inside space-y-1">
                      {PROMPT_DATA_SOURCES.map((source) => (
                        <li key={source.name}>
                          <a
                            href={source.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {getPromptSourceLabel(source.sourceUrl)} <ExternalLink className="w-3 h-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                  <li>
                    <span className="text-foreground">随机图片 · BA人物</span> -{' '}
                    <a
                      href={BA_RANDOM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      img.catcdn.cn <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>
                    <span className="text-foreground">随机图片 · Bing壁纸</span> -{' '}
                    <a
                      href={BING_WALLPAPER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      bing.img.run <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                </ul>
              </details>

              <details className="group p-3 bg-muted/50 rounded-lg">
                <summary className="flex cursor-pointer select-none items-center gap-2 font-medium">
                  <span className="text-[10px] opacity-60 transition-transform group-open:rotate-90">▶</span>
                  隐私条款
                </summary>
                <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
                  <li>本站为本地优先应用：API 密钥、任务历史、设置与生成图片均仅保存在你的浏览器本地，不会上传到第三方服务器。</li>
                  <li>API 密钥仅发送至本机后端用于创建生成任务，且只保存在后端内存中，不写入数据库。</li>
                  <li>生成图片时，提示词与参考图会发送至 Nova API 完成生成；除此之外不收集任何个人信息。</li>
                </ul>
              </details>

              <details className="group p-3 bg-muted/50 rounded-lg">
                <summary className="flex cursor-pointer select-none items-center gap-2 font-medium">
                  <span className="text-[10px] opacity-60 transition-transform group-open:rotate-90">▶</span>
                  参考项目
                </summary>
                <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
                  <li>
                    基于{' '}
                    <a
                      href="https://github.com/aaronkwhite/nanobanana-studio-web"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      aaronkwhite/nanobanana-studio-web <ExternalLink className="w-3 h-3" />
                    </a>
                    {' '}修改而来
                  </li>
                  <li>
                    参考{' '}
                    <a
                      href="https://github.com/basketikun/infinite-canvas"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      basketikun/infinite-canvas <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                </ul>
              </details>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
