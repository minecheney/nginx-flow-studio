import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { generateNginxConfig } from '@/utils/configGenerator';
import { generateDockerfile } from '@/utils/dockerfileGenerator';
import { formatNginxConfig } from '@/utils/sourceTools';
import { SourceEditor } from '@/components/editor/SourceEditor';
import { Button } from '@/components/ui/button';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Container,
  Copy,
  Download,
  GripHorizontal,
  Pencil,
  Save,
  WandSparkles,
  X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { analytics } from '@/utils/analytics';
import {
  findNodeSourceRange,
  type SourceNodeRange,
} from '@/utils/sourceLocator';

const PREVIEW_HEIGHT = 256;
const EDITOR_MIN_HEIGHT = 300;
const PREVIEW_MIN_HEIGHT = 180;

const clampPanelHeight = (height: number, editing: boolean) => {
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
  const minimum = editing ? EDITOR_MIN_HEIGHT : PREVIEW_MIN_HEIGHT;
  const maximum = Math.max(minimum, Math.round(viewportHeight * 0.76));
  return Math.min(maximum, Math.max(minimum, Math.round(height)));
};

const ConfigPreview: React.FC = () => {
  const {
    config,
    activeFile,
    applySource,
    selectedNodeId,
    selectedNodeType,
    sourceFocusVersion,
  } = useConfig();
  const { language, t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [panelHeight, setPanelHeight] = useState(PREVIEW_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const restoreHeightRef = useRef(PREVIEW_HEIGHT);
  const resizeStateRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
    moved: boolean;
  } | null>(null);

  const configText = useMemo(() => generateNginxConfig(config), [config]);
  const [draft, setDraft] = useState(configText);
  const [focusTarget, setFocusTarget] = useState<
    (SourceNodeRange & { requestId: number }) | null
  >(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const sourceTextRef = useRef(configText);
  const configRef = useRef(config);
  sourceTextRef.current = isEditing ? draft : configText;
  configRef.current = config;

  useEffect(() => {
    setDraft(configText);
    setIsEditing(false);
    setFocusTarget(null);
  }, [activeFile.id, configText]);

  useEffect(() => {
    const handleWindowResize = () => {
      setPanelHeight((current) => clampPanelHeight(current, isEditing));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isEditing]);

  const togglePanelSize = useCallback(() => {
    if (!isExpanded) {
      setIsExpanded(true);
      setPanelHeight(clampPanelHeight(restoreHeightRef.current, isEditing));
      return;
    }

    const maximum = clampPanelHeight(Number.MAX_SAFE_INTEGER, isEditing);
    setPanelHeight((current) => {
      if (current >= maximum - 16) {
        return clampPanelHeight(restoreHeightRef.current, isEditing);
      }
      restoreHeightRef.current = current;
      return maximum;
    });
  }, [isEditing, isExpanded]);

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: panelHeight,
      moved: false,
    };
    setIsExpanded(true);
    setIsResizing(true);
  };

  const handleResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    const delta = resizeState.startY - event.clientY;
    if (Math.abs(delta) > 3) resizeState.moved = true;
    const nextHeight = clampPanelHeight(resizeState.startHeight + delta, isEditing);
    restoreHeightRef.current = nextHeight;
    setPanelHeight(nextHeight);
  };

  const handleResizePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    resizeStateRef.current = null;
    setIsResizing(false);
    if (!resizeState.moved) togglePanelSize();
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      togglePanelSize();
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    setIsExpanded(true);
    setPanelHeight((current) => {
      const nextHeight = clampPanelHeight(current + (event.key === 'ArrowUp' ? 32 : -32), isEditing);
      restoreHeightRef.current = nextHeight;
      return nextHeight;
    });
  };

  useEffect(() => {
    if (!selectedNodeId || !selectedNodeType) {
      setFocusTarget(null);
      return;
    }
    const range = findNodeSourceRange(
      sourceTextRef.current,
      configRef.current,
      selectedNodeId,
      selectedNodeType,
    );
    if (!range) {
      setFocusTarget(null);
      return;
    }
    setIsExpanded(true);
    setFocusTarget({ ...range, requestId: sourceFocusVersion });
  }, [selectedNodeId, selectedNodeType, sourceFocusVersion]);

  useEffect(() => {
    if (!isExpanded || isEditing || !focusTarget) return undefined;
    const frame = requestAnimationFrame(() => {
      const line = previewScrollRef.current?.querySelector<HTMLElement>(
        `[data-source-line="${focusTarget.startLine}"]`,
      );
      line?.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget, isEditing, isExpanded]);

  const dirty = draft !== configText;
  const displayedText = isEditing ? draft : configText;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(isEditing ? draft : configText);
    setCopied(true);
    analytics.trackConfigCopy();
    toast({
      title: language === 'zh' ? '已复制到剪贴板' : 'Copied to clipboard',
      description: `${activeFile.name} ${language === 'zh' ? '已复制' : 'copied'}`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([isEditing ? draft : configText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = activeFile.name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    analytics.trackConfigExport('nginx');
    toast({
      title: language === 'zh' ? '下载成功' : 'Download complete',
      description: `${activeFile.name} ${language === 'zh' ? '已按当前源码导出' : 'exported from current source'}`,
    });
  };

  const handleDownloadDockerfile = () => {
    const dockerfileContent = generateDockerfile(config);
    const blob = new Blob([dockerfileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Dockerfile';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    analytics.trackConfigExport('dockerfile');
    toast({
      title: t('preview.dockerfileDownloaded'),
      description: language === 'zh'
        ? `Dockerfile 已下载，请与 ${activeFile.name} 放在同一目录`
        : `Dockerfile downloaded. Place it with ${activeFile.name}`,
    });
  };

  const handleSave = () => {
    try {
      applySource(draft);
      setIsEditing(false);
      toast({
        title: language === 'zh' ? '源码已保存' : 'Source saved',
        description: language === 'zh'
          ? '源码已重新解析并同步到当前可视化画布，未添加任何默认指令。'
          : 'Source was parsed back into the canvas without adding default directives.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: language === 'zh' ? '源码无法保存' : 'Unable to save source',
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const highlightedConfig = useMemo(() => {
    const escapeHtml = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const keywords = [
      'server', 'location', 'upstream', 'stream', 'http', 'events', 'user', 'worker_processes',
      'error_log', 'pid', 'include', 'listen', 'server_name', 'root', 'index', 'proxy_pass',
      'proxy_set_header', 'proxy_connect_timeout', 'proxy_timeout', 'proxy_socket_keepalive',
      'ssl_certificate', 'ssl_certificate_key', 'ssl_protocols', 'ssl_ciphers', 'gzip',
      'sendfile', 'tcp_nopush', 'tcp_nodelay', 'keepalive_timeout', 'return', 'rewrite',
      'allow', 'deny', 'auth_basic', 'add_header', 'try_files', 'hash',
    ];

    return configText.split('\n').map((line, index) => {
      if (line.trim().startsWith('#')) {
        return <span key={index} className="text-code-comment">{line}</span>;
      }
      let highlighted = escapeHtml(line);
      keywords.forEach((keyword) => {
        highlighted = highlighted.replace(
          new RegExp(`\\b(${keyword})\\b`, 'g'),
          `<span class="text-code-keyword">${keyword}</span>`,
        );
      });
      highlighted = highlighted.replace(/'([^']+)'/g, '<span class="text-code-string">\'$1\'</span>');
      highlighted = highlighted.replace(/(\$\w+)/g, '<span class="text-code-variable">$1</span>');
      return <span key={index} dangerouslySetInnerHTML={{ __html: highlighted }} />;
    });
  }, [configText]);

  return (
    <div
      className={`relative shrink-0 bg-code-background border-t border-border ${isResizing ? '' : 'transition-[height] duration-200'}`}
      style={{ height: isExpanded ? panelHeight : 40 }}
    >
      <div
        role="separator"
        aria-label={language === 'zh' ? '调整源码编辑区高度' : 'Resize source editor'}
        aria-orientation="horizontal"
        aria-valuenow={panelHeight}
        tabIndex={0}
        title={language === 'zh' ? '拖动调整高度，点击放大或还原' : 'Drag to resize; click to maximize or restore'}
        className="group absolute inset-x-0 -top-1.5 z-30 flex h-3 cursor-row-resize touch-none items-center justify-center outline-none"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        onKeyDown={handleResizeKeyDown}
      >
        <span className="flex h-2.5 w-14 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground shadow-sm transition-colors group-hover:border-primary/60 group-hover:bg-primary/15 group-hover:text-primary group-focus-visible:ring-2 group-focus-visible:ring-primary/60">
          <GripHorizontal className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-card">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronUp className="h-4 w-4 shrink-0" />}
          <span className="max-w-[220px] truncate font-mono text-foreground">{activeFile.name}</span>
          <span className="text-xs">
            ({displayedText.split('\n').length} {language === 'zh' ? '行' : 'lines'})
          </span>
          {dirty && <span className="rounded border border-status-warning/20 bg-status-warning/10 px-1.5 py-0.5 text-[10px] text-status-warning">未保存</span>}
          {focusTarget && (
            <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {language === 'zh' ? `已定位到第 ${focusTarget.startLine} 行` : `Located at line ${focusTarget.startLine}`}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setDraft(formatNginxConfig(draft))}
              >
                <WandSparkles className="h-3 w-3" />
                {language === 'zh' ? '格式化' : 'Format'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => {
                  setDraft(configText);
                  setIsEditing(false);
                }}
              >
                <X className="h-3 w-3" />
                {language === 'zh' ? '取消' : 'Cancel'}
              </Button>
              <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={handleSave}>
                <Save className="h-3 w-3" />
                {language === 'zh' ? '保存源码' : 'Save source'}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => {
                setDraft(configText);
                setIsExpanded(true);
                setIsEditing(true);
                setPanelHeight((current) => clampPanelHeight(
                  Math.max(current, window.innerHeight * 0.42),
                  true,
                ));
              }}
            >
              <Pencil className="h-3 w-3" />
              {language === 'zh' ? '编辑源码' : 'Edit source'}
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 px-2 text-xs">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? (language === 'zh' ? '已复制' : 'Copied') : (language === 'zh' ? '复制' : 'Copy')}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload} className="h-7 gap-1 px-2 text-xs">
            <Download className="h-3 w-3" />
            {language === 'zh' ? '导出 .conf' : 'Export .conf'}
          </Button>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadDockerfile}
              className="h-7 gap-1 px-2 text-xs border-accent/30 text-accent hover:border-accent hover:bg-accent/10"
            >
              <Container className="h-3 w-3" />
              {t('preview.downloadDockerfile')}
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="h-[calc(100%-2.5rem)] overflow-hidden">
          {isEditing ? (
            <SourceEditor
              value={draft}
              onChange={setDraft}
              onSave={handleSave}
              focusTarget={focusTarget}
            />
          ) : (
            <div ref={previewScrollRef} className="h-full overflow-auto">
              <pre className="p-4 text-xs font-mono leading-relaxed">
                <code className="block">
                  {highlightedConfig.map((line, index) => (
                    <div
                      key={index}
                      data-source-line={index + 1}
                      className={[
                        'flex border-l-2 border-transparent transition-colors duration-200',
                        focusTarget
                          && index + 1 >= focusTarget.startLine
                          && index + 1 <= focusTarget.endLine
                          ? 'bg-primary/[0.035]'
                          : '',
                        focusTarget?.startLine === index + 1
                          ? 'border-l-primary bg-primary/15'
                          : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <span className="w-10 shrink-0 select-none pr-4 text-right text-muted-foreground/50">{index + 1}</span>
                      {line}
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConfigPreview;
