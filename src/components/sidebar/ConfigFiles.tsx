import { Copy, FileCode2, Plus, Trash2 } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ConfigFiles() {
  const {
    files,
    activeFileId,
    setActiveFileId,
    createConfigFile,
    duplicateConfigFile,
    renameConfigFile,
    deleteConfigFile,
  } = useConfig();
  const { language } = useLanguage();
  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];

  return (
    <section className="border-b border-sidebar-border bg-sidebar-accent/20 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-sidebar-foreground">
            {language === 'zh' ? '配置文件' : 'Config files'}
          </span>
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">{files.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => duplicateConfigFile(activeFileId)}
            title={language === 'zh' ? '复制当前文件' : 'Duplicate current file'}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary"
            onClick={createConfigFile}
            title={language === 'zh' ? '新建配置文件' : 'New config file'}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className={files.length > 2 ? 'h-[76px]' : ''}>
        <div className="space-y-1 pr-1">
          {files.map((file) => (
            <div
              key={file.id}
              className={`group flex items-center gap-1 rounded-md border px-1.5 py-1 transition-colors ${
                file.id === activeFileId
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-transparent hover:border-sidebar-border hover:bg-sidebar-accent/40'
              }`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => setActiveFileId(file.id)}
              >
                <FileCode2 className={`h-3.5 w-3.5 shrink-0 ${file.id === activeFileId ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="truncate text-xs text-sidebar-foreground">{file.name}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={() => deleteConfigFile(file.id)}
                title={language === 'zh' ? '删除文件' : 'Delete file'}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[10px] text-muted-foreground">{language === 'zh' ? '文件名' : 'Name'}</span>
        <Input
          value={activeFile.name}
          onChange={(event) => renameConfigFile(activeFile.id, event.target.value)}
          onBlur={(event) => {
            const value = event.target.value.trim() || 'nginx.conf';
            renameConfigFile(activeFile.id, /\.conf$/i.test(value) ? value : `${value}.conf`);
          }}
          className="h-7 bg-input px-2 text-xs font-mono"
          aria-label={language === 'zh' ? '当前配置文件名' : 'Current config filename'}
        />
      </div>
    </section>
  );
}
