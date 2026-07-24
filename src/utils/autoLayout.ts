import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = 'TB',
    nodeWidth = 200,
    nodeHeight = 80,
    rankSep = 100,
    nodeSep = 50,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: node.type === 'server' ? 220 : node.type === 'upstream' ? 200 : nodeWidth, 
      height: node.type === 'server' ? 90 : nodeHeight,
    });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run layout algorithm
  dagre.layout(dagreGraph);

  // Apply positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.type === 'server' ? 220 : node.type === 'upstream' ? 200 : nodeWidth;
    const height = node.type === 'server' ? 90 : nodeHeight;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Nginx topology is a set of Server-centred groups, not a generic deep graph.
 * Dagre may assign sibling Location nodes to different ranks when some of them
 * connect to an Upstream, which creates a long vertical pile. Nginx Flow's
 * expected topology keeps every Server's Locations on one horizontal rank and
 * puts Upstreams on a separate bottom row.
 */
export function getNginxClusterLayout(
  config: NginxConfig,
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const positions = new Map<string, { x: number; y: number }>();
  const serverWidth = 240;
  const locationWidth = 230;
  const upstreamWidth = 220;
  const horizontalGap = 48;
  const clusterGap = 110;
  const locationTop = 190;
  const locationRowStep = 145;
  let cursorX = 60;
  let maxLocationRows = 0;

  config.servers.forEach((server) => {
    const locations = config.locations.filter((location) => location.serverId === server.id);
    const columns = Math.max(1, locations.length);
    const clusterWidth = Math.max(
      serverWidth,
      columns * locationWidth + Math.max(0, columns - 1) * horizontalGap,
    );

    positions.set(server.id, {
      x: cursorX + (clusterWidth - serverWidth) / 2,
      y: 35,
    });

    locations.forEach((location, index) => {
      positions.set(location.id, {
        x: cursorX + index * (locationWidth + horizontalGap),
        y: locationTop,
      });
    });

    maxLocationRows = Math.max(maxLocationRows, locations.length ? 1 : 0);
    cursorX += clusterWidth + clusterGap;
  });

  const unassignedLocations = config.locations.filter(
    (location) => !config.servers.some((server) => server.id === location.serverId),
  );
  unassignedLocations.forEach((location, index) => {
    positions.set(location.id, {
      x: cursorX + index * (locationWidth + horizontalGap),
      y: locationTop,
    });
  });

  const contentWidth = Math.max(cursorX - clusterGap, 760);
  const upstreamTop = locationTop + Math.max(1, maxLocationRows) * locationRowStep + 55;
  const upstreamGap = 70;
  const upstreamsWidth = config.upstreams.length
    ? config.upstreams.length * upstreamWidth + (config.upstreams.length - 1) * upstreamGap
    : 0;
  const upstreamStart = Math.max(60, (contentWidth - upstreamsWidth) / 2);

  config.upstreams.forEach((upstream, index) => {
    positions.set(upstream.id, {
      x: upstreamStart + index * (upstreamWidth + upstreamGap),
      y: upstreamTop,
    });
  });

  const streamNodeGap = 70;
  const streamServerWidth = 230;
  const streamUpstreamWidth = 230;
  const streamServerTop = upstreamTop + (config.upstreams.length ? 155 : 70);
  const streamUpstreamTop = streamServerTop + 150;
  const streamServersWidth = config.stream.servers.length
    ? config.stream.servers.length * streamServerWidth + (config.stream.servers.length - 1) * streamNodeGap
    : 0;
  const streamUpstreamsWidth = config.stream.upstreams.length
    ? config.stream.upstreams.length * streamUpstreamWidth + (config.stream.upstreams.length - 1) * streamNodeGap
    : 0;
  const streamServerStart = Math.max(60, (contentWidth - streamServersWidth) / 2);
  const streamUpstreamStart = Math.max(60, (contentWidth - streamUpstreamsWidth) / 2);

  config.stream.servers.forEach((server, index) => {
    positions.set(server.id, {
      x: streamServerStart + index * (streamServerWidth + streamNodeGap),
      y: streamServerTop,
    });
  });

  config.stream.upstreams.forEach((upstream, index) => {
    positions.set(upstream.id, {
      x: streamUpstreamStart + index * (streamUpstreamWidth + streamNodeGap),
      y: streamUpstreamTop,
    });
  });

  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? node.position,
    })),
    edges,
  };
}

// Generate nodes and edges from NginxConfig for React Flow
import { NginxConfig } from '@/types/nginx';

export function configToFlowElements(config: NginxConfig): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create Server nodes
  config.servers.forEach((server, index) => {
    nodes.push({
      id: server.id,
      type: 'server',
      position: { x: 0, y: 0 }, // Will be calculated by layout
      data: {
        label: server.name,
        serverName: server.serverName,
        port: server.listen.port,
        sslEnabled: server.ssl.enabled,
      },
    });
  });

  // Create Location nodes and edges
  config.locations.forEach((location) => {
    nodes.push({
      id: location.id,
      type: 'location',
      position: { x: 0, y: 0 },
      data: {
        label: `${location.modifier || ''} ${location.path}`.trim(),
        path: location.path,
        modifier: location.modifier,
        hasProxy: !!location.proxyPass || !!location.upstreamId,
      },
    });

    // Edge from server to location
    edges.push({
      id: `e-${location.serverId}-${location.id}`,
      source: location.serverId,
      target: location.id,
      type: 'smoothstep',
      animated: false,
    });

    // Edge from location to upstream if connected
    if (location.upstreamId) {
      edges.push({
        id: `e-${location.id}-${location.upstreamId}`,
        source: location.id,
        target: location.upstreamId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--node-upstream))' },
      });
    }
  });

  // Create Upstream nodes
  config.upstreams.forEach((upstream) => {
    nodes.push({
      id: upstream.id,
      type: 'upstream',
      position: { x: 0, y: 0 },
      data: {
        label: upstream.name,
        serverCount: upstream.servers.length,
        strategy: upstream.strategy,
      },
    });
  });

  config.stream.servers.forEach((server) => {
    nodes.push({
      id: server.id,
      type: 'stream-server',
      position: { x: 0, y: 0 },
      data: {
        label: server.name,
        listenPort: server.listenPort,
        udp: server.udp,
        proxyPass: server.proxyPass,
      },
    });
    const upstream = config.stream.upstreams.find((candidate) => candidate.name === server.proxyPass);
    if (upstream) {
      edges.push({
        id: `e-stream-${server.id}-${upstream.id}`,
        source: server.id,
        target: upstream.id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--node-stream-upstream))' },
      });
    }
  });

  config.stream.upstreams.forEach((upstream) => {
    nodes.push({
      id: upstream.id,
      type: 'stream-upstream',
      position: { x: 0, y: 0 },
      data: {
        label: upstream.name,
        serverCount: upstream.servers.length,
        hashKey: upstream.hashKey,
      },
    });
  });

  return getNginxClusterLayout(config, nodes, edges);
}
