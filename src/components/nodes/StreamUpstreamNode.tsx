import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreVertical, RadioTower, Trash2 } from 'lucide-react';
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

interface StreamUpstreamNodeData {
  label: string;
  serverCount: number;
  hashKey: string;
}

const StreamUpstreamNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { selectNode, deleteStreamUpstream } = useConfig();
  const { language } = useLanguage();
  const nodeData = data as unknown as StreamUpstreamNodeData;

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        selectNode(id, 'stream-upstream');
      }}
      className={cn(
        'node-surface min-w-[210px] cursor-pointer rounded-xl border px-4 py-3 transition-all duration-200 hover:bg-muted/90',
        selected
          ? 'border-node-stream-upstream shadow-stream-upstream ring-1 ring-node-stream-upstream/20'
          : 'border-node-stream-upstream/25 hover:border-node-stream-upstream/55',
      )}
    >
      <Handle type="target" position={Position.Top} className="node-handle !bg-node-stream-upstream" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-md border border-node-stream-upstream/15 bg-node-stream-upstream/10 p-1.5">
            <RadioTower className="h-4 w-4 text-node-stream-upstream" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{nodeData.label}</div>
            <div className="text-xs text-muted-foreground">
              {nodeData.serverCount} {language === 'zh' ? '个节点' : 'nodes'}
              {nodeData.hashKey ? ` · hash ${nodeData.hashKey}` : ''}
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
                deleteStreamUpstream(id);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {language === 'zh' ? '删除 Stream Upstream' : 'Delete stream upstream'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default memo(StreamUpstreamNode);
