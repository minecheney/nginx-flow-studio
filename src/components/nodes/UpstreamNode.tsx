import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Layers, MoreVertical, Trash2 } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface UpstreamNodeData {
  label: string;
  serverCount: number;
  strategy: string;
}

const UpstreamNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { selectNode, deleteUpstream } = useConfig();
  const { language } = useLanguage();
  const nodeData = data as unknown as UpstreamNodeData;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(id, 'upstream');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteUpstream(id);
  };

  const strategyLabels: Record<string, Record<string, string>> = {
    zh: {
      round_robin: '轮询',
      least_conn: '最少连接',
      ip_hash: 'IP Hash',
    },
    en: {
      round_robin: 'Round Robin',
      least_conn: 'Least Conn',
      ip_hash: 'IP Hash',
    },
  };

  const strategyLabel = strategyLabels[language][nodeData.strategy] || nodeData.strategy;
  const serverLabel = language === 'zh' 
    ? `${nodeData.serverCount} 台服务器` 
    : `${nodeData.serverCount} server${nodeData.serverCount !== 1 ? 's' : ''}`;

  return (
    <div
      onClick={handleClick}
      className={cn(
        'node-surface px-4 py-3 rounded-xl border min-w-[180px] cursor-pointer transition-all duration-200 hover:bg-muted/90',
        selected
          ? 'border-node-upstream shadow-upstream ring-1 ring-node-upstream/20'
          : 'border-node-upstream/25 hover:border-node-upstream/55'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="node-handle !bg-node-upstream"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md border border-node-upstream/15 bg-node-upstream/10">
            <Layers className="w-4 h-4 text-node-upstream" />
          </div>
          <div>
            <div className="font-medium text-sm text-foreground">{nodeData.label}</div>
            <div className="text-xs text-muted-foreground">
              {serverLabel} • {strategyLabel}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {language === 'zh' ? '删除 Upstream' : 'Delete Upstream'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default memo(UpstreamNode);
