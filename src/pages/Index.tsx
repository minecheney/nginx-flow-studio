import { ConfigProvider } from '@/contexts/ConfigContext';
import ConfigSidebar from '@/components/sidebar/ConfigSidebar';
import ConfigCanvas from '@/components/canvas/ConfigCanvas';
import PropertyPanel from '@/components/panels/PropertyPanel';
import ConfigPreview from '@/components/preview/ConfigPreview';
import VisitorStats from '@/components/VisitorStats';
import { Github } from 'lucide-react';

const Index = () => {
  return (
    <ConfigProvider>
      <div className="h-screen flex flex-col overflow-hidden relative">
        {/* GitHub Link */}
        <a
          href="https://github.com/minecheney/nginx-flow-studio"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 z-50 rounded-lg border border-border bg-card/80 p-2 shadow-panel backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-primary/10"
          title="View on GitHub"
        >
          <Github className="h-5 w-5 text-foreground" />
        </a>
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <ConfigSidebar />
          
          {/* Center Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 relative">
              <ConfigCanvas />
            </div>
          </div>
          
          {/* Right Property Panel */}
          <PropertyPanel />
        </div>
        
        {/* Bottom Preview */}
        <ConfigPreview />
        
        {/* Visitor Stats */}
        <VisitorStats />
      </div>
    </ConfigProvider>
  );
};

export default Index;
