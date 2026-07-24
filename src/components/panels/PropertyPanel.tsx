import React from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ServerPropertyPanel from './ServerPropertyPanel';
import LocationPropertyPanel from './LocationPropertyPanel';
import UpstreamPropertyPanel from './UpstreamPropertyPanel';
import StreamServerPropertyPanel from './StreamServerPropertyPanel';
import StreamUpstreamPropertyPanel from './StreamUpstreamPropertyPanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Server, MapPin, Layers, MousePointer, Network } from 'lucide-react';

const PropertyPanel: React.FC = () => {
  const {
    selectedNodeId,
    selectedNodeType,
    getServerById,
    getLocationById,
    getUpstreamById,
    getStreamServerById,
    getStreamUpstreamById,
  } = useConfig();
  const { t, language } = useLanguage();

  if (!selectedNodeId || !selectedNodeType) {
    return (
      <div className="w-80 bg-card border-l border-border flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="p-4 rounded-full bg-muted inline-flex">
              <MousePointer className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">
                {language === 'zh' ? '未选择节点' : 'No Node Selected'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'zh' ? '在画布上选择一个节点来编辑其属性' : 'Select a node on the canvas to edit its properties'}
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground pt-4">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-node-server" />
                <span>{language === 'zh' ? 'Server 块定义虚拟主机' : 'Server blocks define virtual hosts'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-node-location" />
                <span>{language === 'zh' ? 'Location 定义 URL 路由规则' : 'Location defines URL routing rules'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-node-upstream" />
                <span>{language === 'zh' ? 'Upstream 定义后端服务器池' : 'Upstream defines backend server pools'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-node-stream" />
                <span>{language === 'zh' ? 'TCP / Socket 定义四层监听' : 'TCP / Socket defines layer 4 listeners'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderPanel = () => {
    switch (selectedNodeType) {
      case 'server': {
        const server = getServerById(selectedNodeId);
        if (!server) return null;
        return <ServerPropertyPanel server={server} />;
      }
      case 'location': {
        const location = getLocationById(selectedNodeId);
        if (!location) return null;
        return <LocationPropertyPanel location={location} />;
      }
      case 'upstream': {
        const upstream = getUpstreamById(selectedNodeId);
        if (!upstream) return null;
        return <UpstreamPropertyPanel upstream={upstream} />;
      }
      case 'stream-server': {
        const server = getStreamServerById(selectedNodeId);
        if (!server) return null;
        return <StreamServerPropertyPanel server={server} />;
      }
      case 'stream-upstream': {
        const upstream = getStreamUpstreamById(selectedNodeId);
        if (!upstream) return null;
        return <StreamUpstreamPropertyPanel upstream={upstream} />;
      }
      default:
        return null;
    }
  };

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col h-full">
      <ScrollArea className="flex-1">
        {renderPanel()}
      </ScrollArea>
    </div>
  );
};

export default PropertyPanel;
