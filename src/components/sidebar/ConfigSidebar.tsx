import React, { useState } from 'react';
import { Settings, Zap, Globe, Plus, MapPin, Upload, LayoutTemplate, Network, RadioTower } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import ImportConfigModal from '@/components/ImportConfigModal';
import TemplateLibrary from '@/components/TemplateLibrary';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfigFiles } from '@/components/sidebar/ConfigFiles';

const ConfigSidebar: React.FC = () => {
  const {
    config,
    updateGlobal,
    updateEvents,
    updateHttp,
    addServer,
    addUpstream,
    addLocation,
    addStreamServer,
    addStreamUpstream,
    selectNode,
  } = useConfig();
  const { t, language } = useLanguage();
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [streamPopoverOpen, setStreamPopoverOpen] = useState(false);

  const handleAddServer = () => {
    const server = addServer();
    const location = addLocation(server.id);
    selectNode(server.id, 'server');
  };

  const handleAddLocation = (serverId: string) => {
    const location = addLocation(serverId);
    selectNode(location.id, 'location');
    setLocationPopoverOpen(false);
  };

  const handleAddUpstream = () => {
    const upstream = addUpstream();
    selectNode(upstream.id, 'upstream');
  };

  const handleAddStreamUpstream = () => {
    const upstream = addStreamUpstream();
    selectNode(upstream.id, 'stream-upstream');
    setStreamPopoverOpen(false);
  };

  const handleAddStreamServer = () => {
    const server = addStreamServer();
    selectNode(server.id, 'stream-server');
    setStreamPopoverOpen(false);
  };

  return (
    <div
      className="w-80 bg-sidebar border-r border-sidebar-border flex flex-col h-full min-h-0 overflow-hidden"
      onWheelCapture={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-2 shadow-[0_0_24px_-10px_hsl(var(--primary)/0.8)]">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-foreground">{t('sidebar.title')}</h1>
              <p className="text-xs text-muted-foreground">Config Master</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ImportConfigModal>
              <Button variant="ghost" size="icon" className="h-8 w-8" title={language === 'zh' ? '导入配置' : 'Import Config'}>
                <Upload className="w-4 h-4" />
              </Button>
            </ImportConfigModal>
            <LanguageSwitch />
          </div>
        </div>
      </div>

      <ConfigFiles />

      {/* Tabs: Config / Templates */}
      <Tabs defaultValue="config" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList className="mx-3 mt-2 grid grid-cols-2">
          <TabsTrigger value="config" className="text-xs gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            {language === 'zh' ? '配置' : 'Config'}
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs gap-1.5">
            <LayoutTemplate className="w-3.5 h-3.5" />
            {language === 'zh' ? '模板' : 'Templates'}
          </TabsTrigger>
        </TabsList>

        {/* Config Tab */}
        <TabsContent value="config" className="flex-1 flex flex-col mt-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">

      {/* Quick Actions */}
      <div className="p-3 border-b border-sidebar-border space-y-2">
        <Button
          onClick={handleAddServer}
          variant="outline"
          className="w-full justify-start gap-2 text-sm border-node-server/30 hover:border-node-server hover:bg-node-server/10"
        >
          <Plus className="w-4 h-4 text-node-server" />
          {t('sidebar.addServer')}
        </Button>
        <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-sm border-node-location/30 hover:border-node-location hover:bg-node-location/10"
            >
              <Plus className="w-4 h-4 text-node-location" />
              {t('sidebar.addLocation')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">
                {language === 'zh' ? '选择目标 Server' : 'Select target Server'}
              </p>
              {config.servers.length === 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => {
                    const server = addServer();
                    handleAddLocation(server.id);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {language === 'zh' ? '新建 Server 并添加' : 'Create Server & Add'}
                </Button>
              ) : (
                config.servers.map((server) => (
                  <Button
                    key={server.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm gap-2"
                    onClick={() => handleAddLocation(server.id)}
                  >
                    <MapPin className="w-4 h-4 text-node-location" />
                    <span className="truncate">{server.serverName || server.name}</span>
                    <span className="text-muted-foreground ml-auto">:{server.listen.port}</span>
                  </Button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          onClick={handleAddUpstream}
          variant="outline"
          className="w-full justify-start gap-2 text-sm border-node-upstream/30 hover:border-node-upstream hover:bg-node-upstream/10"
        >
          <Plus className="w-4 h-4 text-node-upstream" />
          {t('sidebar.addUpstream')}
        </Button>
        <Popover open={streamPopoverOpen} onOpenChange={setStreamPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-node-stream/25 text-sm hover:border-node-stream/55 hover:bg-node-stream/10"
            >
              <Plus className="h-4 w-4 text-node-stream" />
              TCP / Socket
              <span className="ml-auto text-[10px] text-muted-foreground">
                {config.stream.servers.length} / {config.stream.upstreams.length}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-1 p-2" align="start">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleAddStreamUpstream}
            >
              <RadioTower className="h-4 w-4 text-node-stream-upstream" />
              {language === 'zh' ? '添加 Stream Upstream' : 'Add stream upstream'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleAddStreamServer}
            >
              <Network className="h-4 w-4 text-node-stream" />
              {language === 'zh' ? '添加 TCP / UDP 监听' : 'Add TCP / UDP listener'}
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Configuration Sections */}
      <ScrollArea className="flex-1 min-h-0">
        <Accordion type="multiple" defaultValue={['global', 'events']} className="px-3 py-2">
          {/* Global Settings */}
          <AccordionItem value="global" className="border-sidebar-border">
            <AccordionTrigger className="text-sm text-sidebar-foreground hover:no-underline py-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                {t('sidebar.global')}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('global.user')}</Label>
                <Input
                  value={config.global.user}
                  onChange={(e) => updateGlobal({ user: e.target.value })}
                  className="h-8 text-sm bg-input border-border"
                  placeholder="nginx"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('global.workerProcesses')}</Label>
                <Input
                  value={config.global.workerProcesses}
                  onChange={(e) => updateGlobal({ workerProcesses: e.target.value })}
                  className="h-8 text-sm bg-input border-border"
                  placeholder="auto"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('global.errorLog')}</Label>
                <Input
                  value={config.global.errorLog.path}
                  onChange={(e) => updateGlobal({ errorLog: { ...config.global.errorLog, path: e.target.value } })}
                  className="h-8 text-sm bg-input border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('global.errorLogLevel')}</Label>
                <Select
                  value={config.global.errorLog.level}
                  onValueChange={(value) => updateGlobal({ errorLog: { ...config.global.errorLog, level: value as any } })}
                >
                  <SelectTrigger className="h-8 text-sm bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="debug">debug</SelectItem>
                    <SelectItem value="info">info</SelectItem>
                    <SelectItem value="notice">notice</SelectItem>
                    <SelectItem value="warn">warn</SelectItem>
                    <SelectItem value="error">error</SelectItem>
                    <SelectItem value="crit">crit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('global.pid')}</Label>
                <Input
                  value={config.global.pid}
                  onChange={(e) => updateGlobal({ pid: e.target.value })}
                  className="h-8 text-sm bg-input border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('global.custom')}</Label>
                <Textarea
                  value={config.global.customDirectives}
                  onChange={(e) => updateGlobal({ customDirectives: e.target.value })}
                  className="min-h-[60px] text-xs font-mono bg-input border-border"
                  placeholder={t('global.customPlaceholder')}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Events Settings */}
          <AccordionItem value="events" className="border-sidebar-border">
            <AccordionTrigger className="text-sm text-sidebar-foreground hover:no-underline py-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                {t('sidebar.events')}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('events.workerConnections')}</Label>
                <Input
                  type="number"
                  value={config.events.workerConnections}
                  onChange={(e) => updateEvents({ workerConnections: parseInt(e.target.value) || 1024 })}
                  className="h-8 text-sm bg-input border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('events.use')}</Label>
                <Select
                  value={config.events.use}
                  onValueChange={(value) => updateEvents({ use: value as any })}
                >
                  <SelectTrigger className="h-8 text-sm bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="epoll">epoll (Linux)</SelectItem>
                    <SelectItem value="kqueue">kqueue (BSD/macOS)</SelectItem>
                    <SelectItem value="select">select</SelectItem>
                    <SelectItem value="poll">poll</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('events.multiAccept')}</Label>
                <Switch
                  checked={config.events.multiAccept}
                  onCheckedChange={(checked) => updateEvents({ multiAccept: checked })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('events.custom')}</Label>
                <Textarea
                  value={config.events.customDirectives}
                  onChange={(e) => updateEvents({ customDirectives: e.target.value })}
                  className="min-h-[60px] text-xs font-mono bg-input border-border"
                  placeholder={t('events.customPlaceholder')}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* HTTP Settings */}
          <AccordionItem value="http" className="border-sidebar-border">
            <AccordionTrigger className="text-sm text-sidebar-foreground hover:no-underline py-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-node-server" />
                {t('sidebar.http')}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between col-span-2">
                  <Label className="text-xs text-muted-foreground">{t('http.sendfile')}</Label>
                  <Switch
                    checked={config.http.sendfile}
                    onCheckedChange={(checked) => updateHttp({ sendfile: checked })}
                  />
                </div>
                <div className="flex items-center justify-between col-span-2">
                  <Label className="text-xs text-muted-foreground">{t('http.tcpNopush')}</Label>
                  <Switch
                    checked={config.http.tcpNopush}
                    onCheckedChange={(checked) => updateHttp({ tcpNopush: checked })}
                  />
                </div>
                <div className="flex items-center justify-between col-span-2">
                  <Label className="text-xs text-muted-foreground">{t('http.tcpNodelay')}</Label>
                  <Switch
                    checked={config.http.tcpNodelay}
                    onCheckedChange={(checked) => updateHttp({ tcpNodelay: checked })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('http.keepaliveTimeout')}</Label>
                <Input
                  type="number"
                  value={config.http.keepaliveTimeout}
                  onChange={(e) => updateHttp({ keepaliveTimeout: parseInt(e.target.value) || 65 })}
                  className="h-8 text-sm bg-input border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('http.clientMaxBodySize')}</Label>
                <Input
                  value={config.http.clientMaxBodySize}
                  onChange={(e) => updateHttp({ clientMaxBodySize: e.target.value })}
                  className="h-8 text-sm bg-input border-border"
                  placeholder="10m"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('http.serverTokens')}</Label>
                <Switch
                  checked={!config.http.serverTokens}
                  onCheckedChange={(checked) => updateHttp({ serverTokens: !checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('http.gzipEnabled')}</Label>
                <Switch
                  checked={config.http.gzip.enabled}
                  onCheckedChange={(checked) => updateHttp({ gzip: { ...config.http.gzip, enabled: checked } })}
                />
              </div>
              {config.http.gzip.enabled && (
                <div className="space-y-1.5 pl-2 border-l-2 border-accent/30">
                  <Label className="text-xs text-muted-foreground">{t('http.gzipCompLevel')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={9}
                    value={config.http.gzip.compLevel}
                    onChange={(e) => updateHttp({ gzip: { ...config.http.gzip, compLevel: parseInt(e.target.value) || 6 } })}
                    className="h-8 text-sm bg-input border-border"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('http.customDirectives')}</Label>
                <Textarea
                  value={config.http.customDirectives}
                  onChange={(e) => updateHttp({ customDirectives: e.target.value })}
                  className="min-h-[60px] text-xs font-mono bg-input border-border"
                  placeholder={t('http.customPlaceholder')}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="flex-1 flex flex-col mt-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <TemplateLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigSidebar;
