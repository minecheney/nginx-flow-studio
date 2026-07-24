import type { ConfigNodeType } from '@/contexts/ConfigContext';
import type {
  NginxConfig,
  ServerConfig,
  StreamServerConfig,
} from '@/types/nginx';
import {
  parseSourceDocument,
  type SourceBlock,
  type SourceDocument,
} from '@/utils/sourceMerge';

export interface SourceNodeRange {
  from: number;
  to: number;
  focusFrom: number;
  focusTo: number;
  startLine: number;
  endLine: number;
  label: string;
}

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');

const rootBlock = (document: SourceDocument, label: string) => (
  document.blocks.find((block) => !block.parentId && normalize(block.label) === label)
);

const childBlocks = (
  document: SourceDocument,
  parentId: string | undefined,
  predicate: (block: SourceBlock) => boolean,
) => document.blocks
  .filter((block) => block.parentId === parentId && predicate(block))
  .sort((left, right) => left.start - right.start);

const directiveArgs = (
  document: SourceDocument,
  block: SourceBlock,
  directive: string,
) => {
  const line = document.lines.find((candidate) => (
    candidate.ancestors.at(-1) === block.id
    && !candidate.openingId
    && new RegExp(`^\\s*${directive}(?:\\s|;)`).test(candidate.text)
  ));
  if (!line) return '';
  return line.text
    .trim()
    .slice(directive.length)
    .replace(/;\s*(?:#.*)?$/, '')
    .trim();
};

const httpParentId = (document: SourceDocument) => rootBlock(document, 'http')?.id;

const httpServers = (document: SourceDocument) => {
  const parentId = httpParentId(document);
  const nested = childBlocks(document, parentId, (block) => normalize(block.label) === 'server');
  if (nested.length || parentId) return nested;
  return childBlocks(document, undefined, (block) => normalize(block.label) === 'server');
};

const scoreServer = (
  document: SourceDocument,
  block: SourceBlock,
  server: ServerConfig,
) => {
  let score = 0;
  const serverNames = directiveArgs(document, block, 'server_name').split(/\s+/);
  if (serverNames.includes(server.serverName)) score += 4;
  const listen = directiveArgs(document, block, 'listen');
  const listenTarget = listen.split(/\s+/)[0] ?? '';
  if (
    listenTarget === String(server.listen.port)
    || listenTarget.endsWith(`:${server.listen.port}`)
  ) score += 3;
  if (server.ssl.enabled === /\bssl\b/.test(listen)) score += 1;
  return score;
};

const findHttpServer = (
  document: SourceDocument,
  config: NginxConfig,
  server: ServerConfig,
) => {
  const candidates = httpServers(document);
  const scored = candidates
    .map((block) => ({ block, score: scoreServer(document, block, server) }))
    .sort((left, right) => right.score - left.score || left.block.start - right.block.start);
  if (scored[0]?.score) return scored[0].block;
  const index = config.servers.findIndex((candidate) => candidate.id === server.id);
  return candidates[index];
};

const findLocation = (
  document: SourceDocument,
  config: NginxConfig,
  nodeId: string,
) => {
  const location = config.locations.find((candidate) => candidate.id === nodeId);
  if (!location) return undefined;
  const server = config.servers.find((candidate) => candidate.id === location.serverId);
  if (!server) return undefined;
  const serverBlock = findHttpServer(document, config, server);
  if (!serverBlock) return undefined;
  const candidates = childBlocks(
    document,
    serverBlock.id,
    (block) => normalize(block.label).startsWith('location '),
  );
  const label = normalize(`location ${location.modifier ? `${location.modifier} ` : ''}${location.path}`);
  const exact = candidates.find((block) => normalize(block.label) === label);
  if (exact) return exact;
  const siblings = config.locations.filter((candidate) => candidate.serverId === server.id);
  return candidates[siblings.findIndex((candidate) => candidate.id === nodeId)];
};

const findNamedUpstream = (
  document: SourceDocument,
  parentId: string | undefined,
  name: string,
) => childBlocks(
  document,
  parentId,
  (block) => normalize(block.label) === normalize(`upstream ${name}`),
)[0];

const scoreStreamServer = (
  document: SourceDocument,
  block: SourceBlock,
  server: StreamServerConfig,
) => {
  let score = 0;
  const listen = directiveArgs(document, block, 'listen');
  const listenTarget = listen.split(/\s+/)[0] ?? '';
  if (
    listenTarget === String(server.listenPort)
    || listenTarget.endsWith(`:${server.listenPort}`)
  ) score += 4;
  if (server.udp === /\budp\b/.test(listen)) score += 1;
  if (directiveArgs(document, block, 'proxy_pass') === server.proxyPass) score += 3;
  return score;
};

const findStreamServer = (
  document: SourceDocument,
  config: NginxConfig,
  server: StreamServerConfig,
) => {
  const stream = rootBlock(document, 'stream');
  if (!stream) return undefined;
  const candidates = childBlocks(
    document,
    stream.id,
    (block) => normalize(block.label) === 'server',
  );
  const scored = candidates
    .map((block) => ({ block, score: scoreStreamServer(document, block, server) }))
    .sort((left, right) => right.score - left.score || left.block.start - right.block.start);
  if (scored[0]?.score) return scored[0].block;
  const index = config.stream.servers.findIndex((candidate) => candidate.id === server.id);
  return candidates[index];
};

const toRange = (
  document: SourceDocument,
  block: SourceBlock | undefined,
): SourceNodeRange | null => {
  if (!block) return null;
  const openingLine = document.lines.find((line) => line.openingId === block.id);
  const closingLine = document.lines.find((line) => line.closingId === block.id);
  if (!openingLine) return null;
  const focusTo = Math.max(
    openingLine.start,
    Math.min(openingLine.end, openingLine.start + openingLine.text.length),
  );
  return {
    from: block.start,
    to: block.end,
    focusFrom: openingLine.start,
    focusTo,
    startLine: openingLine.number,
    endLine: closingLine?.number ?? openingLine.number,
    label: normalize(block.label),
  };
};

export const findNodeSourceRange = (
  source: string,
  config: NginxConfig,
  nodeId: string | null,
  nodeType: ConfigNodeType | null,
): SourceNodeRange | null => {
  if (!nodeId || !nodeType) return null;
  const document = parseSourceDocument(source);
  let block: SourceBlock | undefined;

  if (nodeType === 'server') {
    const server = config.servers.find((candidate) => candidate.id === nodeId);
    if (server) block = findHttpServer(document, config, server);
  } else if (nodeType === 'location') {
    block = findLocation(document, config, nodeId);
  } else if (nodeType === 'upstream') {
    const upstream = config.upstreams.find((candidate) => candidate.id === nodeId);
    if (upstream) block = findNamedUpstream(document, httpParentId(document), upstream.name)
      ?? findNamedUpstream(document, undefined, upstream.name);
  } else if (nodeType === 'stream-upstream') {
    const upstream = config.stream.upstreams.find((candidate) => candidate.id === nodeId);
    const stream = rootBlock(document, 'stream');
    if (upstream && stream) block = findNamedUpstream(document, stream.id, upstream.name);
  } else if (nodeType === 'stream-server') {
    const server = config.stream.servers.find((candidate) => candidate.id === nodeId);
    if (server) block = findStreamServer(document, config, server);
  }

  return toRange(document, block);
};
