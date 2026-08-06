import type { NginxConfig } from '@/types/nginx';

const findReusableIndex = <T,>(
  previous: T[],
  used: Set<number>,
  currentIndex: number,
  matches: (candidate: T) => boolean,
) => {
  const exactIndex = previous.findIndex((candidate, index) => !used.has(index) && matches(candidate));
  if (exactIndex >= 0) return exactIndex;
  return previous[currentIndex] && !used.has(currentIndex) ? currentIndex : -1;
};

/**
 * The parser creates fresh UUIDs on every run. Reuse IDs for nodes that still
 * occupy the same semantic/source position so source edits update the existing
 * React Flow nodes instead of replacing the whole canvas.
 */
export const preserveVisualNodeIds = (previous: NginxConfig, parsed: NginxConfig) => {
  const serverIdMap = new Map<string, string>();
  const usedServers = new Set<number>();

  parsed.servers.forEach((server, index) => {
    const parsedId = server.id;
    const reusableIndex = findReusableIndex(
      previous.servers,
      usedServers,
      index,
      (candidate) => candidate.serverName === server.serverName
        && candidate.listen.port === server.listen.port,
    );
    if (reusableIndex < 0) return;
    usedServers.add(reusableIndex);
    server.id = previous.servers[reusableIndex].id;
    serverIdMap.set(parsedId, server.id);
  });

  const upstreamIdMap = new Map<string, string>();
  const usedUpstreams = new Set<number>();
  parsed.upstreams.forEach((upstream, index) => {
    const parsedId = upstream.id;
    const reusableIndex = findReusableIndex(
      previous.upstreams,
      usedUpstreams,
      index,
      (candidate) => candidate.name === upstream.name,
    );
    if (reusableIndex < 0) return;
    usedUpstreams.add(reusableIndex);
    upstream.id = previous.upstreams[reusableIndex].id;
    upstreamIdMap.set(parsedId, upstream.id);
  });

  const usedLocations = new Set<number>();
  const locationOffsets = new Map<string, number>();
  parsed.locations.forEach((location) => {
    const parsedServerId = location.serverId;
    const stableServerId = serverIdMap.get(parsedServerId) ?? parsedServerId;
    const siblingOffset = locationOffsets.get(stableServerId) ?? 0;
    const reusableIndex = findReusableIndex(
      previous.locations,
      usedLocations,
      previous.locations.findIndex((candidate, index) => (
        !usedLocations.has(index)
        && candidate.serverId === stableServerId
        && previous.locations
          .slice(0, index)
          .filter((item) => item.serverId === stableServerId).length === siblingOffset
      )),
      (candidate) => candidate.serverId === stableServerId
        && candidate.modifier === location.modifier
        && candidate.path === location.path,
    );
    locationOffsets.set(stableServerId, siblingOffset + 1);
    location.serverId = stableServerId;
    if (reusableIndex >= 0) {
      usedLocations.add(reusableIndex);
      location.id = previous.locations[reusableIndex].id;
    }
    if (location.upstreamId) {
      location.upstreamId = upstreamIdMap.get(location.upstreamId) ?? location.upstreamId;
    }
  });

  const usedStreamUpstreams = new Set<number>();
  parsed.stream.upstreams.forEach((upstream, index) => {
    const reusableIndex = findReusableIndex(
      previous.stream.upstreams,
      usedStreamUpstreams,
      index,
      (candidate) => candidate.name === upstream.name,
    );
    if (reusableIndex < 0) return;
    usedStreamUpstreams.add(reusableIndex);
    upstream.id = previous.stream.upstreams[reusableIndex].id;
  });

  const usedStreamServers = new Set<number>();
  parsed.stream.servers.forEach((server, index) => {
    const reusableIndex = findReusableIndex(
      previous.stream.servers,
      usedStreamServers,
      index,
      (candidate) => candidate.listenPort === server.listenPort
        && candidate.proxyPass === server.proxyPass,
    );
    if (reusableIndex < 0) return;
    usedStreamServers.add(reusableIndex);
    server.id = previous.stream.servers[reusableIndex].id;
  });

  return parsed;
};
