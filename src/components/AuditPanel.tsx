import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Stethoscope,
  Shield,
  Zap,
  Settings,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Wrench,
  WrenchIcon,
  Sparkles,
  X,
  ChevronRight,
} from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  runAudit,
  applyFix,
  applyAllFixes,
  AuditResult,
  AuditIssue,
  AuditSeverity,
  AuditCategory,
} from '@/services/auditService';
import { analytics } from '@/utils/analytics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AuditPanelProps {
  onHighlightNode?: (nodeId: string | null) => void;
}

const AuditPanel: React.FC<AuditPanelProps> = ({ onHighlightNode }) => {
  const { config, importConfig, selectNode } = useConfig();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [fixingIssueId, setFixingIssueId] = useState<string | null>(null);
  const [fixedIssues, setFixedIssues] = useState<Set<string>>(new Set());
  const [isFixingAll, setIsFixingAll] = useState(false);

  // Run audit
  const auditResult = useMemo(() => {
    const result = runAudit(config);
    // 追踪配置体检运行
    if (result.issues.length > 0 || result.score < 100) {
      analytics.trackAuditRun(result.score, result.issues.length, result.grade);
    }
    return result;
  }, [config]);

  // Reset fixed issues when config changes significantly
  useEffect(() => {
    setFixedIssues(new Set());
  }, [config.servers.length, config.locations.length, config.upstreams.length]);

  const getSeverityIcon = (severity: AuditSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-status-warning" />;
      case 'info':
        return <Info className="w-4 h-4 text-status-info" />;
    }
  };

  const getSeverityBadgeClass = (severity: AuditSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'warning':
        return 'bg-status-warning/10 text-status-warning border-status-warning/20';
      case 'info':
        return 'bg-status-info/10 text-status-info border-status-info/20';
    }
  };

  const getCategoryIcon = (category: AuditCategory) => {
    switch (category) {
      case 'security':
        return <Shield className="w-3.5 h-3.5" />;
      case 'performance':
        return <Zap className="w-3.5 h-3.5" />;
      case 'config':
        return <Settings className="w-3.5 h-3.5" />;
    }
  };

  const getGradeColor = (grade: AuditResult['grade']) => {
    switch (grade) {
      case 'A':
        return 'text-status-success';
      case 'B':
        return 'text-node-location';
      case 'C':
        return 'text-status-warning';
      case 'D':
        return 'text-node-upstream';
      case 'F':
        return 'text-destructive';
    }
  };

  const handleFix = useCallback(async (issue: AuditIssue) => {
    setFixingIssueId(issue.id);
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const fix = applyFix(config, issue.ruleId, issue.affectedNodeId);
    if (fix) {
      importConfig({ ...config, ...fix, rawConfig: undefined });
      setFixedIssues(prev => new Set([...prev, issue.ruleId + (issue.affectedNodeId || '')]));
      
      toast({
        title: language === 'zh' ? '✓ 已修复' : '✓ Fixed',
        description: language === 'zh' ? issue.titleZh : issue.title,
      });
    }
    
    setFixingIssueId(null);
  }, [config, importConfig, language]);

  const handleFixAll = useCallback(async () => {
    setIsFixingAll(true);
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const fixedConfig = applyAllFixes(config);
    importConfig({ ...fixedConfig, rawConfig: undefined });
    
    const fixableIssues = auditResult.issues.filter(i => i.canAutoFix);
    const fixedCount = fixableIssues.length;
    const fixTypes = [...new Set(fixableIssues.map(i => i.ruleId))];
    
    // 追踪自动修复
    analytics.trackAutoFix(fixedCount, fixTypes);
    
    toast({
      title: language === 'zh' ? '✓ 批量修复完成' : '✓ All Issues Fixed',
      description: language === 'zh' 
        ? `已自动修复 ${fixedCount} 个问题`
        : `Auto-fixed ${fixedCount} issues`,
    });
    
    setIsFixingAll(false);
  }, [config, importConfig, auditResult.issues, language]);

  const handleNodeHover = useCallback((nodeId: string | null, nodeType: string | null) => {
    onHighlightNode?.(nodeId);
    if (nodeId && nodeType) {
      selectNode(nodeId, nodeType as 'server' | 'location' | 'upstream');
    }
  }, [onHighlightNode, selectNode]);

  const criticalCount = auditResult.issues.filter(i => i.severity === 'critical').length;
  const warningCount = auditResult.issues.filter(i => i.severity === 'warning').length;
  const infoCount = auditResult.issues.filter(i => i.severity === 'info').length;
  const fixableCount = auditResult.issues.filter(i => i.canAutoFix).length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 relative",
            criticalCount > 0 && "border-destructive/50 hover:border-destructive"
          )}
        >
          <Stethoscope className="w-4 h-4" />
          <span>{language === 'zh' ? '体检' : 'Audit'}</span>
          {auditResult.issues.length > 0 && (
            <Badge 
              variant="outline" 
              className={cn(
                "ml-1 h-5 px-1.5 text-xs",
                criticalCount > 0 
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : "bg-status-warning/10 text-status-warning border-status-warning/30"
              )}
            >
              {auditResult.issues.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        className="w-[420px] sm:w-[480px] p-0 flex flex-col"
        onWheelCapture={(e) => e.stopPropagation()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Stethoscope className="w-5 h-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">
                  {language === 'zh' ? 'Nginx 健康检查' : 'Nginx Health Check'}
                </SheetTitle>
                <SheetDescription>
                  {language === 'zh' ? '安全、性能与配置审计' : 'Security, Performance & Config Audit'}
                </SheetDescription>
              </div>
            </div>
          </div>
          
          {/* Score Card */}
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={cn("text-4xl font-bold", getGradeColor(auditResult.grade))}>
                  {auditResult.grade}
                </span>
                <div>
                  <div className="text-2xl font-semibold">{auditResult.score}</div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'zh' ? '健康分数' : 'Health Score'}
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>{auditResult.passedRules}/{auditResult.totalRules}</div>
                <div>{language === 'zh' ? '规则通过' : 'Rules Passed'}</div>
              </div>
            </div>
            <Progress value={auditResult.score} className="h-2" />
            
            {/* Issue Summary */}
            <div className="flex gap-4 mt-3 text-sm">
              {criticalCount > 0 && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{criticalCount} {language === 'zh' ? '严重' : 'Critical'}</span>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-1.5 text-status-warning">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{warningCount} {language === 'zh' ? '警告' : 'Warning'}</span>
                </div>
              )}
              {infoCount > 0 && (
                <div className="flex items-center gap-1.5 text-status-info">
                  <Info className="w-3.5 h-3.5" />
                  <span>{infoCount} {language === 'zh' ? '建议' : 'Info'}</span>
                </div>
              )}
              {auditResult.issues.length === 0 && (
                <div className="flex items-center gap-1.5 text-status-success">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'zh' ? '配置完美！' : 'Perfect Config!'}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Fix All Button */}
          {fixableCount > 0 && (
            <Button
              onClick={handleFixAll}
              disabled={isFixingAll}
              className="mt-3 w-full gap-2"
              variant="default"
            >
              {isFixingAll ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {language === 'zh' ? '修复中...' : 'Fixing...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {language === 'zh' ? `一键修复全部 (${fixableCount})` : `Fix All Issues (${fixableCount})`}
                </>
              )}
            </Button>
          )}
        </SheetHeader>
        
        {/* Issues List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {auditResult.issues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-status-success" />
                <p className="text-lg font-medium text-foreground">
                  {language === 'zh' ? '全部通过！' : 'All Clear!'}
                </p>
                <p className="text-sm">
                  {language === 'zh' 
                    ? '您的 Nginx 配置符合所有最佳实践' 
                    : 'Your Nginx config follows all best practices'}
                </p>
              </div>
            ) : (
              auditResult.issues.map((issue) => {
                const isFixed = fixedIssues.has(issue.id);
                const isFixing = fixingIssueId === issue.id;
                
                return (
                  <div
                    key={issue.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      isFixed 
                        ? "bg-status-success/5 border-status-success/20"
                        : "bg-card border-border hover:border-primary/30",
                    )}
                    onMouseEnter={() => handleNodeHover(issue.affectedNodeId, issue.affectedNodeType)}
                    onMouseLeave={() => handleNodeHover(null, null)}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isFixed ? (
                          <CheckCircle2 className="w-4 h-4 text-status-success" />
                        ) : (
                          getSeverityIcon(issue.severity)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "font-medium",
                            isFixed && "text-status-success line-through"
                          )}>
                            {language === 'zh' ? issue.titleZh : issue.title}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] px-1.5 py-0 h-4",
                              getSeverityBadgeClass(issue.severity)
                            )}
                          >
                            {issue.severity}
                          </Badge>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            {getCategoryIcon(issue.category)}
                            <span className="capitalize">{issue.category}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {language === 'zh' ? issue.descriptionZh : issue.description}
                        </p>
                        
                        {/* Affected Node */}
                        {issue.affectedNodeId && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                            <ChevronRight className="w-3 h-3" />
                            <span>
                              {language === 'zh' ? '关联节点: ' : 'Affected: '}
                              {issue.affectedNodeType}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Fix Button */}
                      {issue.canAutoFix && !isFixed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFix(issue)}
                          disabled={isFixing}
                          className="shrink-0 gap-1.5 text-xs h-8"
                        >
                          {isFixing ? (
                            <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          ) : (
                            <Wrench className="w-3 h-3" />
                          )}
                          {language === 'zh' 
                            ? (issue.fixLabelZh || '修复') 
                            : (issue.fixLabel || 'Fix')
                          }
                        </Button>
                      )}
                      
                      {isFixed && (
                        <Badge className="bg-status-success/10 text-status-success border-status-success/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {language === 'zh' ? '已修复' : 'Fixed'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default AuditPanel;
