import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ServerNode from '@/components/nodes/ServerNode';
import LocationNode from '@/components/nodes/LocationNode';
import UpstreamNode from '@/components/nodes/UpstreamNode';
import StreamServerNode from '@/components/nodes/StreamServerNode';
import StreamUpstreamNode from '@/components/nodes/StreamUpstreamNode';
import TrafficSimulator from '@/components/toolbar/TrafficSimulator';
import { matchLocation } from '@/utils/locationMatcher';
import { configToFlowElements, getNginxClusterLayout } from '@/utils/autoLayout';
import { Button } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react';

const nodeTypes = {
  server: ServerNode,
  location: LocationNode,
  upstream: UpstreamNode,
  'stream-server': StreamServerNode,
  'stream-upstream': StreamUpstreamNode,
};

interface SimulationState {
  isActive: boolean;
  matchedLocationId: string | null;
  matchedServerId: string | null;
  priorityLabel: string;
  matchReason: string;
}

const ConfigCanvasInner: React.FC = () => {
  const {
    config,
    activeFileId,
    selectNode,
    updateLocation,
    updateStreamServer,
    getLocationsByServerId,
  } = useConfig();
  const { language, t } = useLanguage();
  const { fitView } = useReactFlow();
  const prevConfigRef = useRef(config);
  const prevFileIdRef = useRef(activeFileId);
  
  const [simulation, setSimulation] = useState<SimulationState>({
    isActive: false,
    matchedLocationId: null,
    matchedServerId: null,
    priorityLabel: '',
    matchReason: '',
  });

  const initialNodes = useMemo(() => {
    return configToFlowElements(config).nodes;
  }, [config]);

  const initialEdges = useMemo(() => {
    return configToFlowElements(config).edges;
  }, [config]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Auto-layout and fit view when config structure changes significantly (import)
  useEffect(() => {
    const prevServers = prevConfigRef.current.servers;
    const prevLocations = prevConfigRef.current.locations;
    const prevStream = prevConfigRef.current.stream;
    
    // Detect if this is an import (multiple items changed at once)
    const serversChanged = config.servers.length !== prevServers.length || 
      config.servers.some(s => !prevServers.find(ps => ps.id === s.id));
    const locationsChanged = config.locations.length !== prevLocations.length ||
      config.locations.some(l => !prevLocations.find(pl => pl.id === l.id));
    const streamChanged = config.stream.servers.length !== prevStream.servers.length
      || config.stream.upstreams.length !== prevStream.upstreams.length
      || config.stream.servers.some((server) => !prevStream.servers.find((candidate) => candidate.id === server.id))
      || config.stream.upstreams.some((upstream) => !prevStream.upstreams.find((candidate) => candidate.id === upstream.id));
    const fileChanged = prevFileIdRef.current !== activeFileId;
    
    const hasNodes = Boolean(
      config.servers.length
      || config.locations.length
      || config.upstreams.length
      || config.stream.servers.length
      || config.stream.upstreams.length,
    );

    if ((fileChanged || (serversChanged && locationsChanged) || streamChanged) && hasNodes) {
      const flow = configToFlowElements(config);
      const { nodes: layoutedNodes } = getNginxClusterLayout(config, flow.nodes, flow.edges);
      setNodes(layoutedNodes);
      
      setTimeout(() => fitView({ padding: 0.16, minZoom: 0.65, maxZoom: 1 }), 100);
    }
    
    prevConfigRef.current = config;
    prevFileIdRef.current = activeFileId;
  }, [activeFileId, config, setNodes, fitView]);

  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes } = getNginxClusterLayout(config, nodes, edges);
    setNodes(layoutedNodes);
    setTimeout(() => fitView({ padding: 0.16, minZoom: 0.65, maxZoom: 1 }), 60);
  }, [config, edges, fitView, nodes, setNodes]);

  // Sync nodes when config changes
  useEffect(() => {
    setNodes(prevNodes => {
      const newNodes: Node[] = [];
      
      config.servers.forEach((server, idx) => {
        const existing = prevNodes.find(n => n.id === server.id);
        const isSimulationSource = simulation.isActive && simulation.matchedServerId === server.id;
        
        newNodes.push({
          id: server.id,
          type: 'server',
          position: existing?.position || { x: 100 + idx * 300, y: 50 },
          data: {
            label: server.name,
            serverName: server.serverName,
            port: server.listen.port,
            sslEnabled: server.ssl.enabled,
            isSimulationSource,
          },
        });
      });

      config.locations.forEach((location, idx) => {
        const existing = prevNodes.find(n => n.id === location.id);
        const serverIdx = config.servers.findIndex(s => s.id === location.serverId);
        const isMatched = simulation.isActive && simulation.matchedLocationId === location.id;
        
        newNodes.push({
          id: location.id,
          type: 'location',
          position: existing?.position || { x: 100 + serverIdx * 300, y: 200 + (idx % 3) * 100 },
          data: {
            label: location.path,
            path: location.path,
            modifier: location.modifier,
            hasProxy: !!location.proxyPass || !!location.upstreamId,
            isMatched,
            priorityLabel: isMatched ? simulation.priorityLabel : '',
            matchReason: isMatched ? simulation.matchReason : '',
          },
        });
      });

      config.upstreams.forEach((upstream, idx) => {
        const existing = prevNodes.find(n => n.id === upstream.id);
        newNodes.push({
          id: upstream.id,
          type: 'upstream',
          position: existing?.position || { x: 500 + idx * 250, y: 400 },
          data: {
            label: upstream.name,
            serverCount: upstream.servers.length,
            strategy: upstream.strategy,
          },
        });
      });

      config.stream.servers.forEach((server, idx) => {
        const existing = prevNodes.find((node) => node.id === server.id);
        newNodes.push({
          id: server.id,
          type: 'stream-server',
          position: existing?.position || { x: 100 + idx * 280, y: 560 },
          data: {
            label: server.name,
            listenPort: server.listenPort,
            udp: server.udp,
            proxyPass: server.proxyPass,
          },
        });
      });

      config.stream.upstreams.forEach((upstream, idx) => {
        const existing = prevNodes.find((node) => node.id === upstream.id);
        newNodes.push({
          id: upstream.id,
          type: 'stream-upstream',
          position: existing?.position || { x: 100 + idx * 280, y: 710 },
          data: {
            label: upstream.name,
            serverCount: upstream.servers.length,
            hashKey: upstream.hashKey,
          },
        });
      });

      return newNodes;
    });
  }, [config.servers, config.locations, config.upstreams, config.stream, setNodes, simulation]);

  // Sync edges when config or simulation changes
  useEffect(() => {
    const newEdges: Edge[] = [];

    config.locations.forEach(location => {
      const isMatchedEdge = simulation.isActive && 
        simulation.matchedLocationId === location.id &&
        simulation.matchedServerId === location.serverId;

      newEdges.push({
        id: `${location.serverId}-${location.id}`,
        source: location.serverId,
        target: location.id,
        style: { 
          stroke: isMatchedEdge ? 'hsl(var(--status-success))' : 'hsl(var(--node-location))',
          strokeWidth: isMatchedEdge ? 4 : 2,
        },
        animated: true,
        className: isMatchedEdge ? 'simulation-edge' : '',
      });

      if (location.upstreamId) {
        newEdges.push({
          id: `${location.id}-${location.upstreamId}`,
          source: location.id,
          target: location.upstreamId,
          style: { stroke: 'hsl(var(--node-upstream))', strokeWidth: 2 },
          animated: true,
        });
      }
    });

    config.stream.servers.forEach((server) => {
      const upstream = config.stream.upstreams.find((candidate) => candidate.name === server.proxyPass);
      if (!upstream) return;
      newEdges.push({
        id: `stream-${server.id}-${upstream.id}`,
        source: server.id,
        target: upstream.id,
        style: { stroke: 'hsl(var(--node-stream-upstream))', strokeWidth: 2 },
        animated: true,
      });
    });

    setEdges(newEdges);
  }, [config.locations, config.stream.servers, config.stream.upstreams, setEdges, simulation]);

  const handleSimulate = useCallback((method: string, path: string) => {
    // For simplicity, we test against the first server's locations
    // In a real scenario, you might want to select a server first
    if (config.servers.length === 0) {
      setSimulation({
        isActive: true,
        matchedLocationId: null,
        matchedServerId: null,
        priorityLabel: t('simulator.noMatch'),
        matchReason: language === 'zh' ? '❌ 无 Server 配置' : '❌ No Server configured',
      });
      return;
    }

    const serverId = config.servers[0].id;
    const serverLocations = getLocationsByServerId(serverId);
    
    const result = matchLocation(path, serverLocations, language);
    
    setSimulation({
      isActive: true,
      matchedLocationId: result.matchedLocation?.id || null,
      matchedServerId: result.matchedLocation ? serverId : null,
      priorityLabel: result.priorityLabel,
      matchReason: result.matchReason,
    });

    // Auto-clear simulation after 5 seconds
    setTimeout(() => {
      setSimulation({
        isActive: false,
        matchedLocationId: null,
        matchedServerId: null,
        priorityLabel: '',
        matchReason: '',
      });
    }, 5000);
  }, [config.servers, getLocationsByServerId, language, t]);

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);

      // Server -> Location connection
      if (sourceNode?.type === 'server' && targetNode?.type === 'location') {
        updateLocation(params.target!, { serverId: params.source });
        // Don't manually add edge - it will be created from config sync
        return;
      }

      // Location -> Upstream connection
      if (sourceNode?.type === 'location' && targetNode?.type === 'upstream') {
        updateLocation(params.source!, { upstreamId: params.target });
        return;
      }

      if (sourceNode?.type === 'stream-server' && targetNode?.type === 'stream-upstream') {
        const upstream = config.stream.upstreams.find((candidate) => candidate.id === params.target);
        if (upstream) updateStreamServer(params.source!, { proxyPass: upstream.name });
        return;
      }

      // Generic edge add for other cases
      setEdges(eds => addEdge({
        ...params,
        style: { stroke: 'hsl(var(--node-upstream))', strokeWidth: 2 },
        animated: true,
      }, eds));
    },
    [config.stream.upstreams, nodes, setEdges, updateLocation, updateStreamServer]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null, null);
  }, [selectNode]);

  return (
    <div className="w-full h-full flex flex-col">
      <TrafficSimulator 
        onSimulate={handleSimulate}
        isSimulating={simulation.isActive}
      />
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16, minZoom: 0.65, maxZoom: 1 }}
          minZoom={0.45}
          className="bg-canvas-background"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="hsl(var(--canvas-grid))"
          />
          <Controls />
          <Panel position="top-right">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoLayout}
              className="h-8 gap-1.5 bg-card/90 text-xs shadow-sm backdrop-blur"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {language === 'zh' ? '整理布局' : 'Auto layout'}
            </Button>
          </Panel>
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'server':
                  return 'hsl(var(--node-server))';
                case 'location':
                  return 'hsl(var(--node-location))';
                case 'upstream':
                  return 'hsl(var(--node-upstream))';
                case 'stream-server':
                  return 'hsl(var(--node-stream))';
                case 'stream-upstream':
                  return 'hsl(var(--node-stream-upstream))';
                default:
                  return 'hsl(var(--muted-foreground))';
              }
            }}
            maskColor="hsl(var(--canvas-background) / 0.82)"
          />
        </ReactFlow>
      </div>
      
      {/* Custom CSS for simulation edge animation */}
      <style>{`
        .simulation-edge .react-flow__edge-path {
          stroke-dasharray: 10;
          animation: flowAnimation 0.5s linear infinite;
        }
        
        @keyframes flowAnimation {
          0% {
            stroke-dashoffset: 20;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
};

const ConfigCanvas: React.FC = () => (
  <ReactFlowProvider>
    <ConfigCanvasInner />
  </ReactFlowProvider>
);

export default ConfigCanvas;
