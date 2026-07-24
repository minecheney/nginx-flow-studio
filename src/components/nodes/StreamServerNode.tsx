import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreVertical, Network, Trash2 } from 'lucide-react';
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

interface StreamServerNodeData {
  label: string;
  listenPort: number;
  udp: boolean;
  proxyPass: string;
}

const StreamServerNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { selectNode, deleteStreamServer } = useConfig();
  const { language } = useLanguage();
  const nodeData = data as unknown as StreamServerNodeData;

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        selectNode(id, 'stream-server');
      }}
      className={cn(
        'node-surface min-w-[210px] cursor-pointer rounded-xl border px-4 py-3 transition-all duration-200 hover:bg-muted/90',
        selected
          ? 'border-node-stream shadow-stream ring-1 ring-node-stream/20'
          : 'border-node-stream/25 hover:border-node-stream/55',
      )}
    >
      <Handle type="source" position={Position.Bottom} className="node-handle !bg-node-stream" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-md border border-node-stream/15 bg-node-stream/10 p-1.5">
            <Network className="h-4 w-4 text-node-stream" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{nodeData.label}</div>
            <div className="text-xs text-muted-foreground">
              :{nodeData.listenPort} · {nodeData.udp ? 'UDP' : 'TCP'} → {nodeData.proxyPass || '未连接'}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(event) => event.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border bg-popover">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                deleteStreamServer(id);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {language === 'zh' ? '删除 TCP 监听' : 'Delete listener'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default memo(StreamServerNode);
