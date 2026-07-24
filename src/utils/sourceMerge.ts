import type {
  LocationConfig,
  NginxConfig,
  ServerConfig,
  StreamServerConfig,
  StreamUpstreamConfig,
  UpstreamConfig,
} from '@/types/nginx';

export interface SourceLine {
  number: number;
  start: number;
  end: number;
  text: string;
  ancestors: string[];
  openingId?: string;
  closingId?: string;
  label?: string;
}

export interface SourceBlock {
  id: string;
  label: string;
  parentId?: string;
  start: number;
  end: number;
  closingStart: number;
  indent: string;
}

export interface SourceDocument {
  source: string;
  lines: SourceLine[];
  blocks: SourceBlock[];
  eol: string;
}

interface TextEdit {
  start: number;
  end: number;
  text: string;
}

const structuralBraces = (line: string) => {
  const braces: Array<{ char: '{' | '}'; index: number }> = [];
  let quote = '';
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '#') break;
    if (char === '{') {
      const quantifier = line.slice(index).match(/^\{\d+(?:,\d*)?\}/)?.[0];
      if (quantifier) {
        index += quantifier.length - 1;
        continue;
      }
    }
    if (char === '{' || char === '}') braces.push({ char, index });
  }
  return braces;
};

export const parseSourceDocument = (source: string): SourceDocument => {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1);
  }
  const rawLines = source.split(/\n/);
  const stack: string[] = [];
  const openingLines = new Map<string, SourceLine>();
  const lines: SourceLine[] = [];
  const blocks: SourceBlock[] = [];

  rawLines.forEach((rawLine, index) => {
    const text = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    const braces = structuralBraces(text);
    const first = braces[0];
    let closingId: string | undefined;
    if (first?.char === '}') closingId = stack.pop();
    const ancestors = [...stack];
    if (closingId) ancestors.push(closingId);
    const line: SourceLine = {
      number: index + 1,
      start: starts[index] ?? source.length,
      end: starts[index + 1] ?? source.length,
      text,
      ancestors,
      closingId,
    };

    const opening = braces.find((brace) => brace.char === '{');
    if (opening) {
      const id = `block-${index + 1}`;
      line.openingId = id;
      line.label = text.slice(0, opening.index).trim();
      line.ancestors = [...stack];
      stack.push(id);
      openingLines.set(id, line);
    }

    if (closingId) {
      const openingLine = openingLines.get(closingId);
      if (openingLine) {
        blocks.push({
          id: closingId,
          label: openingLine.label ?? '',
          parentId: openingLine.ancestors.at(-1),
          start: openingLine.start,
          end: line.end,
          closingStart: line.start,
          indent: openingLine.text.match(/^\s*/)?.[0] ?? '',
        });
      }
    }
    lines.push(line);
  });

  return { source, lines, blocks, eol: source.includes('\r\n') ? '\r\n' : '\n' };
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const applyEdits = (source: string, edits: TextEdit[]) => {
  const ordered = edits
    .filter((edit, index) => edits.findIndex((candidate) => (
      candidate.start === edit.start && candidate.end === edit.end && candidate.text === edit.text
    )) === index)
    .sort((left, right) => right.start - left.start || right.end - left.end);
  let result = source;
  let boundary = source.length + 1;
  ordered.forEach((edit) => {
    if (edit.end > boundary) return;
    result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
    boundary = edit.start;
  });
  return result;
};

const directLines = (document: SourceDocument, block: SourceBlock | undefined, directive: string) => (
  document.lines.filter((line) => {
    const direct = block ? line.ancestors.at(-1) === block.id : line.ancestors.length === 0;
    return direct && !line.openingId && line.text.trim().match(new RegExp(`^${directive}(?:\\s|;)`));
  })
);

const replaceDirectiveArgs = (
  document: SourceDocument,
  line: SourceLine,
  directive: string,
  args: string,
): TextEdit | undefined => {
  const raw = document.source.slice(line.start, line.end);
  const nameAt = raw.search(new RegExp(`\\b${directive}\\b`));
  const semicolonAt = raw.indexOf(';', nameAt + directive.length);
  if (nameAt < 0 || semicolonAt < 0) return undefined;
  let argsAt = nameAt + directive.length;
  while (/\s/.test(raw[argsAt] ?? '')) argsAt += 1;
  return { start: line.start + argsAt, end: line.start + semicolonAt, text: args };
};

const setDirective = (
  document: SourceDocument,
  block: SourceBlock | undefined,
  directive: string,
  args: string | null,
  edits: TextEdit[],
) => {
  const existing = directLines(document, block, directive);
  if (args === null) {
    existing.forEach((line) => edits.push({ start: line.start, end: line.end, text: '' }));
    return;
  }
  if (existing[0]) {
    const edit = replaceDirectiveArgs(document, existing[0], directive, args);
    if (edit) edits.push(edit);
    existing.slice(1).forEach((line) => edits.push({ start: line.start, end: line.end, text: '' }));
    return;
  }
  const indent = block ? `${block.indent}    ` : '';
  const offset = block
    ? block.closingStart
    : document.blocks.filter((candidate) => !candidate.parentId).sort((a, b) => a.start - b.start)[0]?.start ?? document.source.length;
  edits.push({ start: offset, end: offset, text: `${indent}${directive} ${args};${document.eol}` });
};

const setDirectiveList = (
  document: SourceDocument,
  block: SourceBlock,
  directive: string,
  args: string[],
  edits: TextEdit[],
) => {
  const existing = directLines(document, block, directive);
  existing.forEach((line) => edits.push({ start: line.start, end: line.end, text: '' }));
  if (!args.length) return;
  const offset = existing[0]?.start ?? block.closingStart;
  const text = args.map((value) => `${block.indent}    ${directive} ${value};${document.eol}`).join('');
  edits.push({ start: offset, end: offset, text });
};

const findBlock = (
  document: SourceDocument,
  parentId: string | undefined,
  predicate: (block: SourceBlock) => boolean,
) => document.blocks.find((block) => block.parentId === parentId && predicate(block));

const findHttp = (document: SourceDocument) => findBlock(document, undefined, (block) => block.label === 'http');
const findStream = (document: SourceDocument) => findBlock(document, undefined, (block) => block.label === 'stream');

const directiveArgs = (document: SourceDocument, block: SourceBlock, directive: string) => {
  const line = directLines(document, block, directive)[0];
  if (!line) return '';
  return line.text.trim().slice(directive.length).replace(/;\s*(?:#.*)?$/, '').trim();
};

const findServerBlock = (document: SourceDocument, server: ServerConfig) => {
  const http = findHttp(document);
  const parentId = http?.id;
  return document.blocks.find((block) => (
    block.parentId === parentId
    && block.label === 'server'
    && directiveArgs(document, block, 'server_name') === server.serverName
  ));
};

const locationLabel = (location: LocationConfig) => (
  `location ${location.modifier ? `${location.modifier} ` : ''}${location.path}`
);

const findLocationBlock = (
  document: SourceDocument,
  config: NginxConfig,
  location: LocationConfig,
) => {
  const server = config.servers.find((candidate) => candidate.id === location.serverId);
  if (!server) return undefined;
  const serverBlock = findServerBlock(document, server);
  if (!serverBlock) return undefined;
  return findBlock(document, serverBlock.id, (block) => block.label === locationLabel(location));
};

const findUpstreamBlock = (document: SourceDocument, upstream: UpstreamConfig) => {
  const http = findHttp(document);
  return findBlock(document, http?.id, (block) => block.label === `upstream ${upstream.name}`);
};

const findStreamUpstreamBlock = (document: SourceDocument, upstream: StreamUpstreamConfig) => {
  const stream = findStream(document);
  return findBlock(document, stream?.id, (block) => block.label === `upstream ${upstream.name}`);
};

const findStreamServerBlock = (document: SourceDocument, server: StreamServerConfig) => {
  const stream = findStream(document);
  return document.blocks.find((block) => (
    block.parentId === stream?.id
    && block.label === 'server'
    && directiveArgs(document, block, 'listen').split(/\s+/)[0] === String(server.listenPort)
    && directiveArgs(document, block, 'proxy_pass') === server.proxyPass
  ));
};

const replaceBlockLabel = (
  document: SourceDocument,
  block: SourceBlock,
  beforeLabel: string,
  afterLabel: string,
  edits: TextEdit[],
) => {
  if (beforeLabel === afterLabel) return;
  const line = document.lines.find((candidate) => candidate.openingId === block.id);
  if (!line) return;
  const raw = document.source.slice(line.start, line.end);
  const labelAt = raw.indexOf(beforeLabel);
  if (labelAt >= 0) {
    edits.push({ start: line.start + labelAt, end: line.start + labelAt + beforeLabel.length, text: afterLabel });
  }
};

const listenArgs = (server: ServerConfig) => [
  String(server.listen.port),
  server.ssl.enabled ? 'ssl' : '',
  server.listen.http2 ? 'http2' : '',
  server.listen.defaultServer ? 'default_server' : '',
].filter(Boolean).join(' ');

const proxyHeaders = (location: LocationConfig) => location.headers
  .filter((header) => header.enabled)
  .map((header) => `${header.name} ${header.value || '""'}`);

const addHeaders = (location: LocationConfig) => {
  if (!location.cors.enabled) return [];
  const values = [
    `'Access-Control-Allow-Origin' '${location.cors.allowOrigin || '*'}'`,
    `'Access-Control-Allow-Methods' '${location.cors.allowMethods.join(', ')}'`,
    `'Access-Control-Allow-Headers' '${location.cors.allowHeaders.join(', ')}'`,
  ];
  if (location.cors.allowCredentials) values.push(`'Access-Control-Allow-Credentials' 'true'`);
  return values;
};

const patchGlobals = (document: SourceDocument, before: NginxConfig, after: NginxConfig, edits: TextEdit[]) => {
  if (before.global.user !== after.global.user) setDirective(document, undefined, 'user', after.global.user, edits);
  if (before.global.workerProcesses !== after.global.workerProcesses) {
    setDirective(document, undefined, 'worker_processes', after.global.workerProcesses, edits);
  }
  if (!same(before.global.errorLog, after.global.errorLog)) {
    setDirective(document, undefined, 'error_log', `${after.global.errorLog.path} ${after.global.errorLog.level}`, edits);
  }
  if (before.global.pid !== after.global.pid) setDirective(document, undefined, 'pid', after.global.pid, edits);

  const events = findBlock(document, undefined, (block) => block.label === 'events');
  if (events) {
    if (before.events.workerConnections !== after.events.workerConnections) {
      setDirective(document, events, 'worker_connections', String(after.events.workerConnections), edits);
    }
    if (before.events.use !== after.events.use) setDirective(document, events, 'use', after.events.use, edits);
    if (before.events.multiAccept !== after.events.multiAccept) {
      setDirective(document, events, 'multi_accept', after.events.multiAccept ? 'on' : null, edits);
    }
  }

  const http = findHttp(document);
  if (!http) return;
  const simpleHttp: Array<[boolean, string, string | null]> = [
    [before.http.sendfile !== after.http.sendfile, 'sendfile', after.http.sendfile ? 'on' : 'off'],
    [before.http.tcpNopush !== after.http.tcpNopush, 'tcp_nopush', after.http.tcpNopush ? 'on' : 'off'],
    [before.http.tcpNodelay !== after.http.tcpNodelay, 'tcp_nodelay', after.http.tcpNodelay ? 'on' : 'off'],
    [before.http.keepaliveTimeout !== after.http.keepaliveTimeout, 'keepalive_timeout', String(after.http.keepaliveTimeout)],
    [before.http.typesHashMaxSize !== after.http.typesHashMaxSize, 'types_hash_max_size', String(after.http.typesHashMaxSize)],
    [before.http.defaultType !== after.http.defaultType, 'default_type', after.http.defaultType],
    [before.http.serverTokens !== after.http.serverTokens, 'server_tokens', after.http.serverTokens ? 'on' : 'off'],
    [before.http.clientMaxBodySize !== after.http.clientMaxBodySize, 'client_max_body_size', after.http.clientMaxBodySize],
    [before.http.gzip.enabled !== after.http.gzip.enabled, 'gzip', after.http.gzip.enabled ? 'on' : 'off'],
    [before.http.gzip.compLevel !== after.http.gzip.compLevel, 'gzip_comp_level', String(after.http.gzip.compLevel)],
    [before.http.gzip.minLength !== after.http.gzip.minLength, 'gzip_min_length', String(after.http.gzip.minLength)],
    [!same(before.http.gzip.types, after.http.gzip.types), 'gzip_types', after.http.gzip.types.join(' ')],
  ];
  simpleHttp.forEach(([changed, directive, args]) => {
    if (changed) setDirective(document, http, directive, args, edits);
  });
};

const patchServers = (document: SourceDocument, before: NginxConfig, after: NginxConfig, edits: TextEdit[]) => {
  before.servers.forEach((server) => {
    const next = after.servers.find((candidate) => candidate.id === server.id);
    if (!next || same(server, next)) return;
    const block = findServerBlock(document, server);
    if (!block) return;
    if (!same(server.listen, next.listen) || server.ssl.enabled !== next.ssl.enabled) {
      setDirective(document, block, 'listen', listenArgs(next), edits);
    }
    if (server.serverName !== next.serverName) setDirective(document, block, 'server_name', next.serverName, edits);
    if (server.root !== next.root) setDirective(document, block, 'root', next.root || null, edits);
    if (!same(server.index, next.index)) setDirective(document, block, 'index', next.index.length ? next.index.join(' ') : null, edits);
    if (server.ssl.certificate !== next.ssl.certificate) {
      setDirective(document, block, 'ssl_certificate', next.ssl.enabled ? next.ssl.certificate : null, edits);
    }
    if (server.ssl.certificateKey !== next.ssl.certificateKey) {
      setDirective(document, block, 'ssl_certificate_key', next.ssl.enabled ? next.ssl.certificateKey : null, edits);
    }
    if (!same(server.ssl.protocols, next.ssl.protocols)) {
      setDirective(document, block, 'ssl_protocols', next.ssl.enabled ? next.ssl.protocols.join(' ') : null, edits);
    }
  });
};

const patchLocations = (document: SourceDocument, before: NginxConfig, after: NginxConfig, edits: TextEdit[]) => {
  before.locations.forEach((location) => {
    const next = after.locations.find((candidate) => candidate.id === location.id);
    if (!next || same(location, next)) return;
    const block = findLocationBlock(document, before, location);
    if (!block) return;
    replaceBlockLabel(document, block, locationLabel(location), locationLabel(next), edits);
    if (location.proxyPass !== next.proxyPass || location.upstreamId !== next.upstreamId) {
      const upstream = next.upstreamId ? after.upstreams.find((candidate) => candidate.id === next.upstreamId) : undefined;
      setDirective(document, block, 'proxy_pass', upstream ? `http://${upstream.name}` : next.proxyPass || null, edits);
    }
    if (location.tryFiles !== next.tryFiles) setDirective(document, block, 'try_files', next.tryFiles || null, edits);
    if (location.alias !== next.alias) setDirective(document, block, 'alias', next.alias || null, edits);
    if (location.returnCode !== next.returnCode || location.returnUrl !== next.returnUrl) {
      setDirective(
        document,
        block,
        'return',
        next.returnCode ? `${next.returnCode}${next.returnUrl ? ` ${next.returnUrl}` : ''}` : null,
        edits,
      );
    }
    if (location.websocket !== next.websocket) {
      setDirective(document, block, 'proxy_http_version', next.websocket ? '1.1' : null, edits);
    }
    if (!same(location.headers, next.headers) || location.websocket !== next.websocket) {
      const headers = proxyHeaders(next);
      if (next.websocket) headers.push('Upgrade $http_upgrade', 'Connection "upgrade"');
      setDirectiveList(document, block, 'proxy_set_header', headers, edits);
    }
    if (!same(location.cors, next.cors)) setDirectiveList(document, block, 'add_header', addHeaders(next), edits);
    if (!same(location.accessControl.allow, next.accessControl.allow)) {
      setDirectiveList(document, block, 'allow', next.accessControl.allow, edits);
    }
    if (!same(location.accessControl.deny, next.accessControl.deny)) {
      setDirectiveList(document, block, 'deny', next.accessControl.deny, edits);
    }
    if (!same(location.accessControl.authBasic, next.accessControl.authBasic)) {
      setDirective(
        document,
        block,
        'auth_basic',
        next.accessControl.authBasic.enabled ? `"${next.accessControl.authBasic.realm}"` : null,
        edits,
      );
      setDirective(
        document,
        block,
        'auth_basic_user_file',
        next.accessControl.authBasic.enabled ? next.accessControl.authBasic.userFile : null,
        edits,
      );
    }
  });
};

const upstreamServerArgs = (upstream: UpstreamConfig) => upstream.servers.map((server) => [
  `${server.address}:${server.port}`,
  server.weight !== 1 ? `weight=${server.weight}` : '',
  server.maxFails !== 1 ? `max_fails=${server.maxFails}` : '',
  server.failTimeout !== 10 ? `fail_timeout=${server.failTimeout}s` : '',
  server.backup ? 'backup' : '',
  server.down ? 'down' : '',
].filter(Boolean).join(' '));

const patchUpstreams = (document: SourceDocument, before: NginxConfig, after: NginxConfig, edits: TextEdit[]) => {
  before.upstreams.forEach((upstream) => {
    const next = after.upstreams.find((candidate) => candidate.id === upstream.id);
    if (!next || same(upstream, next)) return;
    const block = findUpstreamBlock(document, upstream);
    if (!block) return;
    replaceBlockLabel(document, block, `upstream ${upstream.name}`, `upstream ${next.name}`, edits);
    if (upstream.strategy !== next.strategy) {
      setDirective(document, block, 'least_conn', next.strategy === 'least_conn' ? '' : null, edits);
      setDirective(document, block, 'ip_hash', next.strategy === 'ip_hash' ? '' : null, edits);
    }
    if (!same(upstream.servers, next.servers)) {
      setDirectiveList(document, block, 'server', upstreamServerArgs(next), edits);
    }
  });
};

const streamUpstreamServerArgs = (upstream: StreamUpstreamConfig) => upstream.servers.map((server) => [
  `${server.address}:${server.port}`,
  server.weight !== 1 ? `weight=${server.weight}` : '',
  server.maxFails !== 3 ? `max_fails=${server.maxFails}` : '',
  server.failTimeout !== 30 ? `fail_timeout=${server.failTimeout}s` : '',
  server.backup ? 'backup' : '',
  server.down ? 'down' : '',
].filter(Boolean).join(' '));

const renderStreamUpstream = (upstream: StreamUpstreamConfig, indent: string, eol: string) => {
  const lines = [`${indent}upstream ${upstream.name} {`];
  if (upstream.hashKey) {
    lines.push(`${indent}    hash ${upstream.hashKey}${upstream.hashConsistent ? ' consistent' : ''};`);
  }
  streamUpstreamServerArgs(upstream).forEach((args) => lines.push(`${indent}    server ${args};`));
  if (upstream.customDirectives.trim()) {
    upstream.customDirectives.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) lines.push(`${indent}    ${trimmed.endsWith(';') ? trimmed : `${trimmed};`}`);
    });
  }
  lines.push(`${indent}}`);
  return `${lines.join(eol)}${eol}`;
};

const renderStreamServer = (server: StreamServerConfig, indent: string, eol: string) => {
  const lines = [
    `${indent}server {`,
    `${indent}    listen ${server.listenPort}${server.udp ? ' udp' : ''};`,
  ];
  if (server.proxyConnectTimeout) lines.push(`${indent}    proxy_connect_timeout ${server.proxyConnectTimeout};`);
  if (server.proxyTimeout) lines.push(`${indent}    proxy_timeout ${server.proxyTimeout};`);
  if (server.socketKeepalive) lines.push(`${indent}    proxy_socket_keepalive on;`);
  if (server.proxyPass) lines.push(`${indent}    proxy_pass ${server.proxyPass};`);
  if (server.customDirectives.trim()) {
    server.customDirectives.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) lines.push(`${indent}    ${trimmed.endsWith(';') ? trimmed : `${trimmed};`}`);
    });
  }
  lines.push(`${indent}}`);
  return `${lines.join(eol)}${eol}`;
};

const patchStream = (document: SourceDocument, before: NginxConfig, after: NginxConfig, edits: TextEdit[]) => {
  const streamBlock = findStream(document);
  const addedBlocks: string[] = [];

  before.stream.upstreams.forEach((upstream) => {
    const next = after.stream.upstreams.find((candidate) => candidate.id === upstream.id);
    const block = findStreamUpstreamBlock(document, upstream);
    if (!block) return;
    if (!next) {
      edits.push({ start: block.start, end: block.end, text: '' });
      return;
    }
    if (same(upstream, next)) return;
    replaceBlockLabel(document, block, `upstream ${upstream.name}`, `upstream ${next.name}`, edits);
    if (upstream.hashKey !== next.hashKey || upstream.hashConsistent !== next.hashConsistent) {
      setDirective(
        document,
        block,
        'hash',
        next.hashKey ? `${next.hashKey}${next.hashConsistent ? ' consistent' : ''}` : null,
        edits,
      );
    }
    if (!same(upstream.servers, next.servers)) {
      setDirectiveList(document, block, 'server', streamUpstreamServerArgs(next), edits);
    }
  });

  before.stream.servers.forEach((server) => {
    const next = after.stream.servers.find((candidate) => candidate.id === server.id);
    const block = findStreamServerBlock(document, server);
    if (!block) return;
    if (!next) {
      edits.push({ start: block.start, end: block.end, text: '' });
      return;
    }
    if (same(server, next)) return;
    if (server.listenPort !== next.listenPort || server.udp !== next.udp) {
      setDirective(document, block, 'listen', `${next.listenPort}${next.udp ? ' udp' : ''}`, edits);
    }
    if (server.proxyPass !== next.proxyPass) {
      setDirective(document, block, 'proxy_pass', next.proxyPass || null, edits);
    }
    if (server.proxyConnectTimeout !== next.proxyConnectTimeout) {
      setDirective(document, block, 'proxy_connect_timeout', next.proxyConnectTimeout || null, edits);
    }
    if (server.proxyTimeout !== next.proxyTimeout) {
      setDirective(document, block, 'proxy_timeout', next.proxyTimeout || null, edits);
    }
    if (server.socketKeepalive !== next.socketKeepalive) {
      setDirective(document, block, 'proxy_socket_keepalive', next.socketKeepalive ? 'on' : null, edits);
    }
  });

  const childIndent = streamBlock ? `${streamBlock.indent}    ` : '    ';
  after.stream.upstreams
    .filter((upstream) => !before.stream.upstreams.some((candidate) => candidate.id === upstream.id))
    .forEach((upstream) => addedBlocks.push(renderStreamUpstream(upstream, childIndent, document.eol)));
  after.stream.servers
    .filter((server) => !before.stream.servers.some((candidate) => candidate.id === server.id))
    .forEach((server) => addedBlocks.push(renderStreamServer(server, childIndent, document.eol)));

  if (!addedBlocks.length) return;
  if (streamBlock) {
    edits.push({
      start: streamBlock.closingStart,
      end: streamBlock.closingStart,
      text: addedBlocks.join(document.eol),
    });
  } else {
    const separator = document.source.endsWith('\n') ? document.eol : `${document.eol}${document.eol}`;
    edits.push({
      start: document.source.length,
      end: document.source.length,
      text: `${separator}stream {${document.eol}${addedBlocks.join(document.eol)}}${document.eol}`,
    });
  }
};

/**
 * Reconciles form edits into the imported source instead of regenerating the
 * entire file. Comments, unknown directives, block order and whitespace that
 * were not touched stay byte-for-byte unchanged.
 */
export const mergeNginxConfigSource = (
  source: string,
  before: NginxConfig,
  after: NginxConfig,
) => {
  const document = parseSourceDocument(source);
  const edits: TextEdit[] = [];
  patchGlobals(document, before, after, edits);
  patchServers(document, before, after, edits);
  patchLocations(document, before, after, edits);
  patchUpstreams(document, before, after, edits);
  patchStream(document, before, after, edits);
  return applyEdits(source, edits);
};
