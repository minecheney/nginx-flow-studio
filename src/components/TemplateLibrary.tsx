import React, { useState, useMemo } from 'react';
import {
  Code2,
  Image,
  Server,
  FileCode,
  Radio,
  FileText,
  Network,
  Fingerprint,
  Shield,
  Layout,
  Search,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  templates,
  templateCategories,
  searchTemplates,
  TemplateCategory,
  TemplateDefinition,
} from '@/data/templates';
import { analytics } from '@/utils/analytics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Code2,
  Image,
  Server,
  FileCode,
  Radio,
  FileText,
  Network,
  Fingerprint,
  Shield,
  Layout,
};

interface TemplateCardProps {
  template: TemplateDefinition;
  onSelect: (template: TemplateDefinition) => void;
  language: string;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onSelect, language }) => {
  const Icon = iconMap[template.icon] || Server;
  
  const getCategoryColor = (category: TemplateCategory) => {
    const colors: Record<TemplateCategory, string> = {
      frontend: 'bg-node-server/10 text-node-server border-node-server/20',
      backend: 'bg-node-location/10 text-node-location border-node-location/20',
      cms: 'bg-node-stream/10 text-node-stream border-node-stream/20',
      ha: 'bg-node-upstream/10 text-node-upstream border-node-upstream/20',
      security: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return colors[category];
  };

  const getCategoryLabel = (category: TemplateCategory) => {
    const cat = templateCategories.find(c => c.id === category);
    return language === 'zh' ? cat?.nameZh : cat?.name;
  };

  return (
    <div
      className="group relative p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
      onClick={() => onSelect(template)}
    >
      {/* Icon & Category */}
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <Badge variant="outline" className={cn('text-xs', getCategoryColor(template.category))}>
          {getCategoryLabel(template.category)}
        </Badge>
      </div>

      {/* Title & Description */}
      <h3 className="font-semibold text-foreground mb-1.5">
        {language === 'zh' ? template.nameZh : template.name}
      </h3>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
        {language === 'zh' ? template.descriptionZh : template.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {template.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        {template.tags.length > 3 && (
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
            +{template.tags.length - 3}
          </span>
        )}
      </div>

      {/* Hover Indicator */}
      <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
};

const TemplateLibrary: React.FC = () => {
  const { importConfig } = useConfig();
  const { language, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [pendingTemplate, setPendingTemplate] = useState<TemplateDefinition | null>(null);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = templates;
    
    if (searchQuery) {
      result = searchTemplates(searchQuery);
    }
    
    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }
    
    return result;
  }, [searchQuery, selectedCategory]);

  // Group by category for display
  const groupedTemplates = useMemo(() => {
    if (selectedCategory !== 'all' || searchQuery) {
      return null; // Don't group when filtering
    }
    
    const groups: Record<TemplateCategory, TemplateDefinition[]> = {
      frontend: [],
      backend: [],
      cms: [],
      ha: [],
      security: [],
    };
    
    templates.forEach(t => {
      groups[t.category].push(t);
    });
    
    return groups;
  }, [selectedCategory, searchQuery]);

  const handleSelectTemplate = (template: TemplateDefinition) => {
    setPendingTemplate(template);
  };

  const handleApplyTemplate = () => {
    if (!pendingTemplate) return;
    
    // Deep clone the config to avoid reference issues
    const configCopy = JSON.parse(JSON.stringify(pendingTemplate.config));
    importConfig(configCopy);
    
    // 追踪模板使用
    analytics.trackTemplateUse(
      language === 'zh' ? pendingTemplate.nameZh : pendingTemplate.name,
      pendingTemplate.category
    );
    
    toast({
      title: language === 'zh' ? '✓ 模板已应用' : '✓ Template Applied',
      description: language === 'zh' 
        ? `已加载"${pendingTemplate.nameZh}"模板配置`
        : `Loaded "${pendingTemplate.name}" template configuration`,
    });
    
    setPendingTemplate(null);
  };

  const getCategoryIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || Server;
    return Icon;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" onWheelCapture={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground mb-3">
          {language === 'zh' ? '📦 模板库' : '📦 Template Library'}
        </h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'zh' ? '搜索模板 (如: React, SSL, API)' : 'Search templates (e.g., React, SSL, API)'}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
        <Button
          variant={selectedCategory === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
          className="text-xs whitespace-nowrap"
        >
          {language === 'zh' ? '全部' : 'All'}
        </Button>
        {templateCategories.map((cat) => {
          const Icon = getCategoryIcon(cat.icon);
          return (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="text-xs whitespace-nowrap gap-1.5"
            >
              <Icon className="w-3 h-3" />
              {language === 'zh' ? cat.nameZh : cat.name}
            </Button>
          );
        })}
      </div>

      {/* Template Grid */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 pb-6">
          {groupedTemplates ? (
            // Grouped display
            Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
              if (categoryTemplates.length === 0) return null;
              const cat = templateCategories.find(c => c.id === category);
              
              return (
                <div key={category} className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    {React.createElement(getCategoryIcon(cat?.icon || 'Server'), { className: 'w-4 h-4' })}
                    {language === 'zh' ? cat?.nameZh : cat?.name}
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {categoryTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={handleSelectTemplate}
                        language={language}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // Flat display (filtered)
            <div className="grid grid-cols-1 gap-3">
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={handleSelectTemplate}
                    language={language}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">
                    {language === 'zh' ? '未找到匹配的模板' : 'No matching templates found'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingTemplate} onOpenChange={() => setPendingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'zh' ? '应用模板' : 'Apply Template'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'zh' 
                ? `确定要应用"${pendingTemplate?.nameZh}"模板吗？这将覆盖当前画布上的所有配置。`
                : `Apply "${pendingTemplate?.name}" template? This will overwrite all current canvas configurations.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'zh' ? '取消' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyTemplate}>
              <Check className="w-4 h-4 mr-2" />
              {language === 'zh' ? '确认应用' : 'Apply'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TemplateLibrary;
