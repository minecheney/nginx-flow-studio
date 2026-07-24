import React, { useState } from 'react';
import { Play, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import AuditPanel from '@/components/AuditPanel';

interface TrafficSimulatorProps {
  onSimulate: (method: string, path: string) => void;
  isSimulating: boolean;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

const TrafficSimulator: React.FC<TrafficSimulatorProps> = ({
  onSimulate,
  isSimulating,
}) => {
  const { t, language } = useLanguage();
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('');

  const handleSimulate = () => {
    if (path.trim()) {
      onSimulate(method, path.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSimulate();
    }
  };

  return (
    <div className="flex items-center gap-2 border-b border-border bg-card/85 px-4 py-2 shadow-[0_10px_30px_-26px_hsl(var(--primary)/0.55)] backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Zap className="w-4 h-4 text-primary" />
        <span className="font-medium">{t('simulator.title')}</span>
      </div>
      
      <div className="flex items-center gap-2 flex-1 max-w-2xl">
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-24 h-8 text-xs bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-8 text-sm font-mono bg-input border-border"
          placeholder={
            language === 'zh'
              ? '输入测试路径，如 /api/users'
              : 'Enter test path, e.g., /api/users'
          }
        />

        <Button
          size="sm"
          onClick={handleSimulate}
          disabled={!path.trim() || isSimulating}
          className="gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          {t('simulator.simulate')}
        </Button>

        <div className="h-6 w-px bg-border mx-2" />
        
        <AuditPanel />
      </div>
    </div>
  );
};

export default TrafficSimulator;
