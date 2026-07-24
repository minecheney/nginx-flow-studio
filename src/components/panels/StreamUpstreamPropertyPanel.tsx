import React from 'react';
import { Plus, RadioTower, Trash2 } from 'lucide-react';
import type { StreamUpstreamConfig, UpstreamServer } from '@/types/nginx';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export default function StreamUpstreamPropertyPanel({ upstream }: { upstream: StreamUpstreamConfig }) {
  const { updateStreamUpstream, deleteStreamUpstream } = useConfig();
  const { language } = useLanguage();

  const updateServer = (id: string, updates: Partial<UpstreamServer>) => {
    updateStreamUpstream(upstream.id, {
      servers: upstream.servers.map((server) => server.id === id ? { ...server, ...updates } : server),
    });
  };

  const addServer = () => {
    updateStreamUpstream(upstream.id, {
      servers: [
        ...upstream.servers,
        {
          id: crypto.randomUUID(),
          address: '127.0.0.1',
          port: 9001,
          weight: 1,
          maxFails: 3,
          failTimeout: 30,
          backup: false,
          down: false,
        },
      ],
    });
  };

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-node-stream-upstream/15 bg-node-stream-upstream/10 p-2">
            <RadioTower className="h-4 w-4 text-node-stream-upstream" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Stream Upstream</h2>
            <p className="text-xs text-muted-foreground">{upstream.servers.length} 个目标节点</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => deleteStreamUpstream(upstream.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label>{language === 'zh' ? '上游组名称' : 'Upstream name'}</Label>
        <Input value={upstream.name} onChange={(event) => updateStreamUpstream(upstream.id, { name: event.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Hash Key</Label>
        <Input
          value={upstream.hashKey}
          placeholder="$remote_addr"
          onChange={(event) => updateStreamUpstream(upstream.id, { hashKey: event.target.value })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
        <div>
          <Label>Consistent Hash</Label>
          <p className="text-[10px] text-muted-foreground">hash ... consistent</p>
        </div>
        <Switch
          checked={upstream.hashConsistent}
          disabled={!upstream.hashKey}
          onCheckedChange={(checked) => updateStreamUpstream(upstream.id, { hashConsistent: checked })}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{language === 'zh' ? '目标服务器' : 'Target servers'}</Label>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addServer}>
            <Plus className="h-3 w-3" />
            {language === 'zh' ? '添加' : 'Add'}
          </Button>
        </div>

        {upstream.servers.map((server, index) => (
          <div key={server.id} className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => updateStreamUpstream(upstream.id, {
                  servers: upstream.servers.filter((candidate) => candidate.id !== server.id),
                })}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_84px] gap-2">
              <Input
                value={server.address}
                placeholder="172.16.0.16"
                onChange={(event) => updateServer(server.id, { address: event.target.value })}
              />
              <Input
                type="number"
                value={server.port}
                placeholder="15676"
                onChange={(event) => updateServer(server.id, { port: Number(event.target.value) || 80 })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">weight</Label>
                <Input type="number" value={server.weight} onChange={(event) => updateServer(server.id, { weight: Number(event.target.value) || 1 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">max_fails</Label>
                <Input type="number" value={server.maxFails} onChange={(event) => updateServer(server.id, { maxFails: Number(event.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">fail_timeout(s)</Label>
                <Input type="number" value={server.failTimeout} onChange={(event) => updateServer(server.id, { failTimeout: Number(event.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex gap-5">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={server.backup} onCheckedChange={(checked) => updateServer(server.id, { backup: checked })} />
                backup
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={server.down} onCheckedChange={(checked) => updateServer(server.id, { down: checked })} />
                down
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>{language === 'zh' ? '其他 Upstream 指令' : 'Other upstream directives'}</Label>
        <Textarea
          value={upstream.customDirectives}
          className="min-h-[80px] font-mono text-xs"
          onChange={(event) => updateStreamUpstream(upstream.id, { customDirectives: event.target.value })}
        />
      </div>
    </div>
  );
}
