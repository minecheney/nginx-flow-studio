import React from 'react';
import { Network, Trash2 } from 'lucide-react';
import type { StreamServerConfig } from '@/types/nginx';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export default function StreamServerPropertyPanel({ server }: { server: StreamServerConfig }) {
  const { config, updateStreamServer, deleteStreamServer } = useConfig();
  const { language } = useLanguage();

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-node-stream/15 bg-node-stream/10 p-2">
            <Network className="h-4 w-4 text-node-stream" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">TCP / Socket</h2>
            <p className="text-xs text-muted-foreground">stream server</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => deleteStreamServer(server.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label>{language === 'zh' ? '显示名称' : 'Display name'}</Label>
        <Input value={server.name} onChange={(event) => updateStreamServer(server.id, { name: event.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{language === 'zh' ? '监听端口' : 'Listen port'}</Label>
          <Input
            type="number"
            min={1}
            max={65535}
            value={server.listenPort}
            onChange={(event) => updateStreamServer(server.id, { listenPort: Number(event.target.value) || 9000 })}
          />
        </div>
        <div className="flex items-end justify-between rounded-md border border-border px-3 py-2">
          <div>
            <Label>UDP</Label>
            <p className="text-[10px] text-muted-foreground">默认 TCP</p>
          </div>
          <Switch checked={server.udp} onCheckedChange={(checked) => updateStreamServer(server.id, { udp: checked })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>proxy_pass</Label>
        <Input
          list="stream-upstream-options"
          value={server.proxyPass}
          placeholder="socket_proxy"
          onChange={(event) => updateStreamServer(server.id, { proxyPass: event.target.value })}
        />
        <datalist id="stream-upstream-options">
          {config.stream.upstreams.map((upstream) => <option key={upstream.id} value={upstream.name} />)}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>连接超时</Label>
          <Input
            value={server.proxyConnectTimeout}
            placeholder="10s"
            onChange={(event) => updateStreamServer(server.id, { proxyConnectTimeout: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>会话超时</Label>
          <Input
            value={server.proxyTimeout}
            placeholder="5m"
            onChange={(event) => updateStreamServer(server.id, { proxyTimeout: event.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
        <div>
          <Label>Socket Keepalive</Label>
          <p className="text-[10px] text-muted-foreground">proxy_socket_keepalive</p>
        </div>
        <Switch
          checked={server.socketKeepalive}
          onCheckedChange={(checked) => updateStreamServer(server.id, { socketKeepalive: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label>{language === 'zh' ? '其他 Stream 指令' : 'Other stream directives'}</Label>
        <Textarea
          value={server.customDirectives}
          className="min-h-[90px] font-mono text-xs"
          placeholder="preread_buffer_size 16k;"
          onChange={(event) => updateStreamServer(server.id, { customDirectives: event.target.value })}
        />
      </div>
    </div>
  );
}
