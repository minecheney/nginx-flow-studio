import React from 'react';
import { Server, Plus } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ServerConfig } from '@/types/nginx';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSslToggleUpdate } from '@/utils/serverSettings';

interface ServerPropertyPanelProps {
  server: ServerConfig;
}

const ServerPropertyPanel: React.FC<ServerPropertyPanelProps> = ({ server }) => {
  const { updateServer, addLocation, selectNode } = useConfig();
  const { t } = useLanguage();

  const handleAddLocation = () => {
    const location = addLocation(server.id);
    selectNode(location.id, 'location');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-node-server/20">
          <Server className="w-5 h-5 text-node-server" />
        </div>
        <div className="flex-1">
          <Input
            value={server.name}
            onChange={(e) => updateServer(server.id, { name: e.target.value })}
            className="h-8 font-medium bg-transparent border-none p-0 text-foreground focus-visible:ring-0"
          />
          <p className="text-xs text-muted-foreground">Server</p>
        </div>
      </div>

      {/* Add Location Button */}
      <Button
        onClick={handleAddLocation}
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 border-node-location/30 hover:border-node-location hover:bg-node-location/10"
      >
        <Plus className="w-4 h-4 text-node-location" />
        {t('sidebar.addLocation')}
      </Button>

      <Tabs defaultValue="listen" className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-muted">
          <TabsTrigger value="listen" className="text-xs">{t('server.listen')}</TabsTrigger>
          <TabsTrigger value="ssl" className="text-xs">{t('server.ssl')}</TabsTrigger>
          <TabsTrigger value="files" className="text-xs">{t('server.files')}</TabsTrigger>
        </TabsList>

        <TabsContent value="listen" className="space-y-3 mt-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('server.serverName')}</Label>
            <Input
              value={server.serverName}
              onChange={(e) => updateServer(server.id, { serverName: e.target.value })}
              className="h-8 text-sm bg-input border-border"
              placeholder={t('server.serverNamePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('server.port')}</Label>
            <Input
              type="number"
              value={server.listen.port}
              onChange={(e) => updateServer(server.id, { listen: { ...server.listen, port: parseInt(e.target.value) || 80 } })}
              className="h-8 text-sm bg-input border-border"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{t('server.defaultServer')}</Label>
            <Switch
              checked={server.listen.defaultServer}
              onCheckedChange={(checked) => updateServer(server.id, { listen: { ...server.listen, defaultServer: checked } })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{t('server.http2')}</Label>
            <Switch
              checked={server.listen.http2}
              onCheckedChange={(checked) => updateServer(server.id, { listen: { ...server.listen, http2: checked } })}
            />
          </div>
        </TabsContent>

        <TabsContent value="ssl" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{t('server.sslEnabled')}</Label>
            <Switch
              checked={server.ssl.enabled}
              onCheckedChange={(checked) => updateServer(server.id, getSslToggleUpdate(server, checked))}
            />
          </div>
          
          {server.ssl.enabled && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('server.sslCertificate')}</Label>
                <Input
                  value={server.ssl.certificate}
                  onChange={(e) => updateServer(server.id, { ssl: { ...server.ssl, certificate: e.target.value } })}
                  className="h-8 text-sm bg-input border-border font-mono"
                  placeholder="/etc/nginx/ssl/cert.pem"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('server.sslCertificateKey')}</Label>
                <Input
                  value={server.ssl.certificateKey}
                  onChange={(e) => updateServer(server.id, { ssl: { ...server.ssl, certificateKey: e.target.value } })}
                  className="h-8 text-sm bg-input border-border font-mono"
                  placeholder="/etc/nginx/ssl/key.pem"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('server.sslProtocols')}</Label>
                <div className="flex flex-wrap gap-2">
                  {['TLSv1.2', 'TLSv1.3'].map(protocol => (
                    <Button
                      key={protocol}
                      variant={server.ssl.protocols.includes(protocol) ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const protocols = server.ssl.protocols.includes(protocol)
                          ? server.ssl.protocols.filter(p => p !== protocol)
                          : [...server.ssl.protocols, protocol];
                        updateServer(server.id, { ssl: { ...server.ssl, protocols } });
                      }}
                    >
                      {protocol}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('server.forceHttps')}</Label>
                <Switch
                  checked={server.ssl.forceRedirect}
                  onCheckedChange={(checked) => updateServer(server.id, { ssl: { ...server.ssl, forceRedirect: checked } })}
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="files" className="space-y-3 mt-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('server.root')}</Label>
            <Input
              value={server.root}
              onChange={(e) => updateServer(server.id, { root: e.target.value })}
              className="h-8 text-sm bg-input border-border font-mono"
              placeholder="/var/www/html"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('server.index')}</Label>
            <Input
              value={server.index.join(' ')}
              onChange={(e) => updateServer(server.id, { index: e.target.value.split(' ').filter(Boolean) })}
              className="h-8 text-sm bg-input border-border font-mono"
              placeholder="index.html index.htm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('server.customDirectives')}</Label>
            <Textarea
              value={server.customDirectives}
              onChange={(e) => updateServer(server.id, { customDirectives: e.target.value })}
              className="min-h-[100px] text-xs font-mono bg-input border-border"
              placeholder={t('server.customPlaceholder')}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServerPropertyPanel;
