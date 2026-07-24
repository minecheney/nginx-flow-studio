import { describe, expect, it } from 'vitest';
import {
  createDefaultLocation,
  createDefaultServer,
  createDefaultStreamServer,
  createDefaultStreamUpstream,
  defaultNginxConfig,
} from '@/types/nginx';
import { configToFlowElements } from '@/utils/autoLayout';

describe('nginx cluster layout', () => {
  it('places every sibling location on the same horizontal row', () => {
    const server = createDefaultServer();
    const locations = Array.from({ length: 8 }, (_, index) => ({
      ...createDefaultLocation(server.id),
      path: `/route-${index + 1}`,
    }));
    const config = {
      ...structuredClone(defaultNginxConfig),
      servers: [server],
      locations,
    };

    const { nodes } = configToFlowElements(config);
    const locationNodes = nodes.filter((node) => node.type === 'location');
    const distinctColumns = new Set(locationNodes.map((node) => node.position.x));
    const distinctRows = new Set(locationNodes.map((node) => node.position.y));
    const uniquePositions = new Set(locationNodes.map((node) => `${node.position.x}:${node.position.y}`));

    expect(distinctColumns.size).toBe(8);
    expect(distinctRows.size).toBe(1);
    expect(uniquePositions.size).toBe(8);
  });

  it('adds connected Stream listener and upstream nodes on separate ranks', () => {
    const config = structuredClone(defaultNginxConfig);
    const upstream = createDefaultStreamUpstream();
    const server = createDefaultStreamServer(upstream.name);
    config.stream = { upstreams: [upstream], servers: [server], customDirectives: '' };

    const { nodes, edges } = configToFlowElements(config);
    const listenerNode = nodes.find((node) => node.type === 'stream-server');
    const upstreamNode = nodes.find((node) => node.type === 'stream-upstream');

    expect(listenerNode).toBeDefined();
    expect(upstreamNode).toBeDefined();
    expect(listenerNode!.position.y).toBeLessThan(upstreamNode!.position.y);
    expect(edges.some((edge) => edge.source === server.id && edge.target === upstream.id)).toBe(true);
  });
});
