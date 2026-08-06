import { v4 as uuidv4 } from 'uuid';
import {
  NginxConfig,
  ServerConfig,
  LocationConfig,
  UpstreamConfig,
  UpstreamServer,
  StreamConfig,
  StreamServerConfig,
  StreamUpstreamConfig,
  GlobalConfig,
  EventsConfig,
  HttpConfig,
  SSLConfig,
  defaultGlobalConfig,
  defaultEventsConfig,
  defaultHttpConfig,
  defaultSSLConfig,
  createDefaultLocation,
} from '@/types/nginx';

// ============== Token Types ==============
interface Token {
  type: 'WORD' | 'SEMICOLON' | 'LBRACE' | 'RBRACE' | 'NEWLINE' | 'EOF';
  value: string;
  line: number;
  column: number;
}

// ============== AST Node Types ==============
interface ASTDirective {
  type: 'directive';
  name: string;
  args: string[];
  line: number;
}

interface ASTBlock {
  type: 'block';
  name: string;
  args: string[];
  children: (ASTDirective | ASTBlock)[];
  line: number;
}

type ASTNode = ASTDirective | ASTBlock;

// ============== Parse Error ==============
export class ParseError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`Line ${line}: ${message}`);
    this.name = 'ParseError';
  }
}

// ============== Lexer ==============
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;

  while (pos < input.length) {
    const char = input[pos];

    // Skip whitespace (except newlines)
    if (char === ' ' || char === '\t' || char === '\r') {
      pos++;
      column++;
      continue;
    }

    // Newline
    if (char === '\n') {
      line++;
      column = 1;
      pos++;
      continue;
    }

    // Comment - skip to end of line
    if (char === '#') {
      while (pos < input.length && input[pos] !== '\n') {
        pos++;
      }
      continue;
    }

    // Single-character tokens
    if (char === ';') {
      tokens.push({ type: 'SEMICOLON', value: ';', line, column });
      pos++;
      column++;
      continue;
    }

    if (char === '{') {
      tokens.push({ type: 'LBRACE', value: '{', line, column });
      pos++;
      column++;
      continue;
    }

    if (char === '}') {
      tokens.push({ type: 'RBRACE', value: '}', line, column });
      pos++;
      column++;
      continue;
    }

    // Quoted string
    if (char === '"' || char === '\'') {
      const quote = char;
      const startColumn = column;
      let value = '';
      pos++;
      column++;
      
      while (pos < input.length && input[pos] !== quote) {
        if (input[pos] === '\\' && pos + 1 < input.length) {
          pos++;
          column++;
        }
        if (input[pos] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
        value += input[pos];
        pos++;
      }
      
      if (pos >= input.length) {
        throw new ParseError(`Unterminated string`, line, startColumn);
      }
      
      pos++; // skip closing quote
      column++;
      tokens.push({ type: 'WORD', value, line, column: startColumn });
      continue;
    }

    // Word (directive name or argument)
    if (/[^\s;{}'\"#]/.test(char)) {
      const startColumn = column;
      let value = '';
      
      while (pos < input.length) {
        if (/[^\s;{}'\"#]/.test(input[pos])) {
          value += input[pos];
          pos++;
          column++;
          continue;
        }
        // Regex quantifiers in unquoted location patterns are part of the
        // argument, not Nginx block delimiters: ^/files/[0-9]{2,4}$.
        if (input[pos] === '{') {
          const quantifier = input.slice(pos).match(/^\{\d+(?:,\d*)?\}/)?.[0];
          if (quantifier) {
            value += quantifier;
            pos += quantifier.length;
            column += quantifier.length;
            continue;
          }
        }
        break;
      }
      
      tokens.push({ type: 'WORD', value, line, column: startColumn });
      continue;
    }

    throw new ParseError(`Unexpected character: ${char}`, line, column);
  }

  tokens.push({ type: 'EOF', value: '', line, column });
  return tokens;
}

// ============== Parser ==============
class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '', line: 0, column: 0 };
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: Token['type']): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParseError(`Expected ${type}, got ${token.type}`, token.line, token.column);
    }
    return this.advance();
  }

  parse(): ASTBlock[] {
    const blocks: ASTBlock[] = [];
    
    while (this.current().type !== 'EOF') {
      const node = this.parseStatement();
      if (node) {
        if (node.type === 'block') {
          blocks.push(node);
        }
        // Top-level directives are ignored for now (handled in parseBlock context)
      }
    }
    
    return blocks;
  }

  parseRoot(): { directives: ASTDirective[]; blocks: ASTBlock[] } {
    const directives: ASTDirective[] = [];
    const blocks: ASTBlock[] = [];
    
    while (this.current().type !== 'EOF') {
      const node = this.parseStatement();
      if (node) {
        if (node.type === 'block') {
          blocks.push(node);
        } else {
          directives.push(node);
        }
      }
    }
    
    return { directives, blocks };
  }

  private parseStatement(): ASTNode | null {
    const token = this.current();
    
    if (token.type === 'RBRACE' || token.type === 'EOF') {
      return null;
    }
    
    if (token.type !== 'WORD') {
      throw new ParseError(`Unexpected token: ${token.value}`, token.line, token.column);
    }

    const name = this.advance().value;
    const args: string[] = [];
    const line = token.line;

    // Collect arguments
    while (this.current().type === 'WORD') {
      args.push(this.advance().value);
    }

    // Block or directive?
    if (this.current().type === 'LBRACE') {
      this.advance(); // consume {
      const children: ASTNode[] = [];
      
      while (this.current().type !== 'RBRACE' && this.current().type !== 'EOF') {
        const child = this.parseStatement();
        if (child) children.push(child);
      }
      
      this.expect('RBRACE');
      return { type: 'block', name, args, children, line };
    } else if (this.current().type === 'SEMICOLON') {
      this.advance(); // consume ;
      return { type: 'directive', name, args, line };
    } else {
      throw new ParseError(
        `Expected ; or {, got ${this.current().type}`,
        this.current().line,
        this.current().column
      );
    }
  }
}

// ============== AST to Config Converter ==============

function parseListenDirective(args: string[]): { port: number; defaultServer: boolean; http2: boolean; ssl: boolean } {
  let port = 80;
  let defaultServer = false;
  let http2 = false;
  let ssl = false;

  for (const arg of args) {
    if (/^\d+$/.test(arg)) {
      port = parseInt(arg, 10);
    } else if (arg === 'default_server') {
      defaultServer = true;
    } else if (arg === 'http2') {
      http2 = true;
    } else if (arg === 'ssl') {
      ssl = true;
    } else if (arg.includes(':')) {
      const parts = arg.split(':');
      port = parseInt(parts[parts.length - 1], 10);
    }
  }

  return { port, defaultServer, http2, ssl };
}

function parseLocationModifier(args: string[]): { modifier: LocationConfig['modifier']; path: string } {
  if (args.length === 0) {
    return { modifier: '', path: '/' };
  }
  
  const modifiers: LocationConfig['modifier'][] = ['=', '~', '~*', '^~'];
  
  if (modifiers.includes(args[0] as LocationConfig['modifier'])) {
    return {
      modifier: args[0] as LocationConfig['modifier'],
      path: args[1] || '/',
    };
  }
  
  return { modifier: '', path: args[0] };
}

function parseUpstreamServer(args: string[]): Partial<UpstreamServer> {
  const server: Partial<UpstreamServer> = {
    id: uuidv4(),
    weight: 1,
    maxFails: 3,
    failTimeout: 30,
    backup: false,
    down: false,
  };

  if (args.length === 0) return server;

  // Parse address:port
  const addrPort = args[0];
  if (addrPort.includes(':')) {
    const [addr, port] = addrPort.split(':');
    server.address = addr;
    server.port = parseInt(port, 10) || 80;
  } else {
    server.address = addrPort;
    server.port = 80;
  }

  // Parse additional parameters
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('weight=')) {
      server.weight = parseInt(arg.split('=')[1], 10) || 1;
    } else if (arg.startsWith('max_fails=')) {
      server.maxFails = parseInt(arg.split('=')[1], 10) || 3;
    } else if (arg.startsWith('fail_timeout=')) {
      server.failTimeout = parseInt(arg.split('=')[1].replace('s', ''), 10) || 30;
    } else if (arg === 'backup') {
      server.backup = true;
    } else if (arg === 'down') {
      server.down = true;
    }
  }

  return server;
}

function convertBlockToLocation(block: ASTBlock, serverId: string): LocationConfig {
  const { modifier, path } = parseLocationModifier(block.args);
  
  const location: LocationConfig = {
    ...createDefaultLocation(serverId),
    id: uuidv4(),
    modifier,
    path,
  };

  const customDirectives: string[] = [];

  for (const child of block.children) {
    if (child.type === 'directive') {
      switch (child.name) {
        case 'proxy_pass':
          location.proxyPass = child.args[0] || '';
          break;
        case 'root':
          // Store in customDirectives as we use alias
          customDirectives.push(`root ${child.args.join(' ')};`);
          break;
        case 'alias':
          location.alias = child.args[0] || '';
          break;
        case 'try_files':
          location.tryFiles = child.args.join(' ');
          break;
        case 'return':
          location.returnCode = parseInt(child.args[0], 10) || null;
          location.returnUrl = child.args[1] || '';
          break;
        case 'proxy_set_header':
          if (child.args.length >= 2) {
            const existingHeader = location.headers.find(h => h.name === child.args[0]);
            if (existingHeader) {
              existingHeader.value = child.args.slice(1).join(' ');
              existingHeader.enabled = true;
            } else {
              location.headers.push({
                name: child.args[0],
                value: child.args.slice(1).join(' '),
                enabled: true,
              });
            }
          }
          break;
        case 'allow':
          location.accessControl.allow.push(...child.args);
          break;
        case 'deny':
          location.accessControl.deny.push(...child.args);
          break;
        case 'auth_basic':
          location.accessControl.authBasic.enabled = child.args[0] !== 'off';
          location.accessControl.authBasic.realm = child.args[0] || 'Restricted';
          break;
        case 'auth_basic_user_file':
          location.accessControl.authBasic.userFile = child.args[0] || '';
          break;
        case 'add_header':
          if (child.args[0] === 'Access-Control-Allow-Origin') {
            location.cors.enabled = true;
            location.cors.allowOrigin = child.args[1] || '*';
          } else if (child.args[0] === 'Access-Control-Allow-Methods') {
            location.cors.allowMethods = (child.args[1] || '').split(',').map(m => m.trim());
          } else if (child.args[0] === 'Access-Control-Allow-Headers') {
            location.cors.allowHeaders = (child.args[1] || '').split(',').map(h => h.trim());
          } else {
            customDirectives.push(`add_header ${child.args.join(' ')};`);
          }
          break;
        case 'proxy_http_version':
          if (child.args[0] === '1.1') {
            // Check for websocket upgrade pattern
            const hasUpgrade = block.children.some(
              c => c.type === 'directive' && 
                   c.name === 'proxy_set_header' && 
                   c.args[0] === 'Upgrade'
            );
            location.websocket = hasUpgrade;
          }
          break;
        case 'rewrite':
          if (child.args.length >= 2) {
            location.rewrite = {
              pattern: child.args[0],
              replacement: child.args[1],
              flag: (child.args[2] as any) || 'last',
            };
          }
          break;
        default:
          customDirectives.push(`${child.name} ${child.args.join(' ')};`);
      }
    } else if (child.type === 'block' && child.name === 'location') {
      // Nested locations are not directly supported, add as custom
      customDirectives.push(`# Nested location: ${child.args.join(' ')}`);
    }
  }

  location.customDirectives = customDirectives.join('\n');
  return location;
}

function convertBlockToServer(block: ASTBlock): { server: ServerConfig; locations: LocationConfig[] } {
  const server: ServerConfig = {
    id: uuidv4(),
    name: 'Imported Server',
    listen: {
      port: 80,
      defaultServer: false,
      http2: false,
    },
    serverName: 'localhost',
    ssl: { ...defaultSSLConfig, forceRedirect: false },
    root: '/var/www/html',
    index: ['index.html', 'index.htm'],
    customDirectives: '',
  };

  const locations: LocationConfig[] = [];
  const customDirectives: string[] = [];

  for (const child of block.children) {
    if (child.type === 'directive') {
      switch (child.name) {
        case 'listen': {
          const parsed = parseListenDirective(child.args);
          server.listen.port = parsed.port;
          server.listen.defaultServer = parsed.defaultServer;
          server.listen.http2 = parsed.http2;
          if (parsed.ssl) {
            server.ssl.enabled = true;
          }
          break;
        }
        case 'server_name':
          server.serverName = child.args.join(' ');
          server.name = child.args[0] || 'Server';
          break;
        case 'root':
          server.root = child.args[0] || '';
          break;
        case 'index':
          server.index = child.args;
          break;
        case 'ssl_certificate':
          server.ssl.enabled = true;
          server.ssl.certificate = child.args[0] || '';
          break;
        case 'ssl_certificate_key':
          server.ssl.certificateKey = child.args[0] || '';
          break;
        case 'ssl_protocols':
          server.ssl.protocols = child.args;
          break;
        case 'ssl_ciphers':
          server.ssl.ciphers = child.args[0] || '';
          break;
        default:
          customDirectives.push(`${child.name} ${child.args.join(' ')};`);
      }
    } else if (child.type === 'block' && child.name === 'location') {
      locations.push(convertBlockToLocation(child, server.id));
    } else if (child.type === 'block') {
      // Other blocks as custom
      customDirectives.push(`# Block: ${child.name}`);
    }
  }

  server.customDirectives = customDirectives.join('\n');
  return { server, locations };
}

function convertBlockToUpstream(block: ASTBlock): UpstreamConfig {
  const upstream: UpstreamConfig = {
    id: uuidv4(),
    name: block.args[0] || 'upstream',
    strategy: 'round_robin',
    servers: [],
    customDirectives: '',
  };

  const customDirectives: string[] = [];

  for (const child of block.children) {
    if (child.type === 'directive') {
      switch (child.name) {
        case 'server':
          const parsed = parseUpstreamServer(child.args);
          upstream.servers.push(parsed as UpstreamServer);
          break;
        case 'ip_hash':
          upstream.strategy = 'ip_hash';
          break;
        case 'least_conn':
          upstream.strategy = 'least_conn';
          break;
        default:
          customDirectives.push(`${child.name} ${child.args.join(' ')};`);
      }
    }
  }

  upstream.customDirectives = customDirectives.join('\n');
  return upstream;
}

function convertBlockToStreamUpstream(block: ASTBlock): StreamUpstreamConfig {
  const upstream: StreamUpstreamConfig = {
    id: uuidv4(),
    name: block.args[0] || 'socket_proxy',
    hashKey: '',
    hashConsistent: false,
    servers: [],
    customDirectives: '',
  };
  const customDirectives: string[] = [];

  for (const child of block.children) {
    if (child.type !== 'directive') {
      customDirectives.push(`# Block: ${child.name}`);
      continue;
    }
    switch (child.name) {
      case 'hash':
        upstream.hashConsistent = child.args.includes('consistent');
        upstream.hashKey = child.args.filter((arg) => arg !== 'consistent').join(' ');
        break;
      case 'server':
        upstream.servers.push(parseUpstreamServer(child.args) as UpstreamServer);
        break;
      default:
        customDirectives.push(`${child.name} ${child.args.join(' ')};`);
    }
  }

  upstream.customDirectives = customDirectives.join('\n');
  return upstream;
}

function convertBlockToStreamServer(block: ASTBlock, index: number): StreamServerConfig {
  const server: StreamServerConfig = {
    id: uuidv4(),
    name: `TCP Proxy ${index + 1}`,
    listenPort: 9000,
    udp: false,
    proxyPass: '',
    proxyConnectTimeout: '10s',
    proxyTimeout: '5m',
    socketKeepalive: false,
    customDirectives: '',
  };
  const customDirectives: string[] = [];

  for (const child of block.children) {
    if (child.type !== 'directive') {
      customDirectives.push(`# Block: ${child.name}`);
      continue;
    }
    switch (child.name) {
      case 'listen':
        server.listenPort = parseListenDirective(child.args).port;
        server.udp = child.args.includes('udp');
        break;
      case 'proxy_pass':
        server.proxyPass = child.args.join(' ');
        break;
      case 'proxy_connect_timeout':
        server.proxyConnectTimeout = child.args[0] || '10s';
        break;
      case 'proxy_timeout':
        server.proxyTimeout = child.args[0] || '5m';
        break;
      case 'proxy_socket_keepalive':
        server.socketKeepalive = child.args[0] === 'on';
        break;
      default:
        customDirectives.push(`${child.name} ${child.args.join(' ')};`);
    }
  }

  server.customDirectives = customDirectives.join('\n');
  return server;
}

function convertStreamBlock(block: ASTBlock): StreamConfig {
  const stream: StreamConfig = {
    upstreams: [],
    servers: [],
    customDirectives: '',
  };
  const customDirectives: string[] = [];

  for (const child of block.children) {
    if (child.type === 'block' && child.name === 'upstream') {
      stream.upstreams.push(convertBlockToStreamUpstream(child));
    } else if (child.type === 'block' && child.name === 'server') {
      stream.servers.push(convertBlockToStreamServer(child, stream.servers.length));
    } else if (child.type === 'directive') {
      customDirectives.push(`${child.name} ${child.args.join(' ')};`);
    } else if (child.type === 'block') {
      customDirectives.push(`# Block: ${child.name}`);
    }
  }

  stream.customDirectives = customDirectives.join('\n');
  return stream;
}

function convertDirectivesToGlobal(directives: ASTDirective[]): Partial<GlobalConfig> {
  const global: Partial<GlobalConfig> = {};
  const customDirectives: string[] = [];

  for (const dir of directives) {
    switch (dir.name) {
      case 'user':
        global.user = dir.args[0] || 'nginx';
        break;
      case 'worker_processes':
        global.workerProcesses = dir.args[0] || 'auto';
        break;
      case 'error_log':
        global.errorLog = {
          path: dir.args[0] || '/var/log/nginx/error.log',
          level: (dir.args[1] as any) || 'warn',
        };
        break;
      case 'pid':
        global.pid = dir.args[0] || '/run/nginx.pid';
        break;
      default:
        customDirectives.push(`${dir.name} ${dir.args.join(' ')};`);
    }
  }

  if (customDirectives.length > 0) {
    global.customDirectives = customDirectives.join('\n');
  }

  return global;
}

function convertEventsBlock(block: ASTBlock): Partial<EventsConfig> {
  const events: Partial<EventsConfig> = {};
  const customDirectives: string[] = [];

  for (const child of block.children) {
    if (child.type === 'directive') {
      switch (child.name) {
        case 'worker_connections':
          events.workerConnections = parseInt(child.args[0], 10) || 1024;
          break;
        case 'use':
          events.use = child.args[0] as any;
          break;
        case 'multi_accept':
          events.multiAccept = child.args[0] === 'on';
          break;
        default:
          customDirectives.push(`${child.name} ${child.args.join(' ')};`);
      }
    }
  }

  if (customDirectives.length > 0) {
    events.customDirectives = customDirectives.join('\n');
  }

  return events;
}

function convertHttpBlock(block: ASTBlock): { 
  http: Partial<HttpConfig>; 
  servers: ServerConfig[]; 
  locations: LocationConfig[];
  upstreams: UpstreamConfig[];
} {
  const http: Partial<HttpConfig> = {};
  const servers: ServerConfig[] = [];
  const locations: LocationConfig[] = [];
  const upstreams: UpstreamConfig[] = [];
  const customDirectives: string[] = [];

  for (const child of block.children) {
    if (child.type === 'block') {
      if (child.name === 'server') {
        const { server, locations: locs } = convertBlockToServer(child);
        servers.push(server);
        locations.push(...locs);
      } else if (child.name === 'upstream') {
        upstreams.push(convertBlockToUpstream(child));
      } else {
        customDirectives.push(`# Block: ${child.name}`);
      }
    } else if (child.type === 'directive') {
      switch (child.name) {
        case 'sendfile':
          http.sendfile = child.args[0] === 'on';
          break;
        case 'tcp_nopush':
          http.tcpNopush = child.args[0] === 'on';
          break;
        case 'tcp_nodelay':
          http.tcpNodelay = child.args[0] === 'on';
          break;
        case 'keepalive_timeout':
          http.keepaliveTimeout = parseInt(child.args[0], 10) || 65;
          break;
        case 'types_hash_max_size':
          http.typesHashMaxSize = parseInt(child.args[0], 10) || 2048;
          break;
        case 'default_type':
          http.defaultType = child.args[0] || 'application/octet-stream';
          break;
        case 'server_tokens':
          http.serverTokens = child.args[0] === 'on';
          break;
        case 'client_max_body_size':
          http.clientMaxBodySize = child.args[0] || '10m';
          break;
        case 'gzip':
          http.gzip = {
            ...(http.gzip || defaultHttpConfig.gzip),
            enabled: child.args[0] === 'on',
          };
          break;
        case 'gzip_comp_level':
          http.gzip = {
            ...(http.gzip || defaultHttpConfig.gzip),
            compLevel: parseInt(child.args[0], 10) || 6,
          };
          break;
        case 'gzip_min_length':
          http.gzip = {
            ...(http.gzip || defaultHttpConfig.gzip),
            minLength: parseInt(child.args[0], 10) || 1024,
          };
          break;
        case 'gzip_types':
          http.gzip = {
            ...(http.gzip || defaultHttpConfig.gzip),
            types: child.args,
          };
          break;
        case 'include':
          // Skip include directives
          break;
        default:
          customDirectives.push(`${child.name} ${child.args.join(' ')};`);
      }
    }
  }

  if (customDirectives.length > 0) {
    http.customDirectives = customDirectives.join('\n');
  }

  return { http, servers, locations, upstreams };
}

const HTTPS_REDIRECT_DIRECTIVE = /^return\s+(?:301|302|307|308)\s+https:\/\/\$(?:server_name|host)\$request_uri;$/m;

const foldHttpsRedirectServers = (config: NginxConfig) => {
  const redirectServerIds = new Set<string>();

  config.servers.forEach((candidate) => {
    if (
      candidate.listen.port !== 80
      || candidate.ssl.enabled
      || config.locations.some((location) => location.serverId === candidate.id)
      || !HTTPS_REDIRECT_DIRECTIVE.test(candidate.customDirectives)
    ) {
      return;
    }

    const redirectNames = new Set(candidate.serverName.split(/\s+/).filter(Boolean));
    const target = config.servers.find((server) => (
      server.id !== candidate.id
      && server.ssl.enabled
      && server.serverName.split(/\s+/).some((name) => redirectNames.has(name))
    ));
    if (!target) return;

    target.ssl.forceRedirect = true;
    redirectServerIds.add(candidate.id);
  });

  if (redirectServerIds.size) {
    config.servers = config.servers.filter((server) => !redirectServerIds.has(server.id));
  }
};

// ============== Main Parse Function ==============

export function parseNginxConfig(configString: string): NginxConfig {
  const tokens = tokenize(configString);
  const parser = new Parser(tokens);
  const { directives, blocks } = parser.parseRoot();

  const config: NginxConfig = {
    global: { ...defaultGlobalConfig, customDirectives: '' },
    events: { ...defaultEventsConfig, customDirectives: '' },
    http: { ...defaultHttpConfig, customDirectives: '' },
    upstreams: [],
    servers: [],
    locations: [],
    stream: {
      upstreams: [],
      servers: [],
      customDirectives: '',
    },
    // Store the original raw config to preserve it exactly when generating output
    rawConfig: configString,
  };

  // Process top-level directives (global context)
  const globalUpdates = convertDirectivesToGlobal(directives);
  config.global = { ...config.global, ...globalUpdates };

  // Process blocks
  for (const block of blocks) {
    if (block.name === 'events') {
      const eventsUpdates = convertEventsBlock(block);
      config.events = { ...config.events, ...eventsUpdates };
    } else if (block.name === 'http') {
      const { http, servers, locations, upstreams } = convertHttpBlock(block);
      config.http = { ...config.http, ...http };
      config.servers.push(...servers);
      config.locations.push(...locations);
      config.upstreams.push(...upstreams);
    } else if (block.name === 'stream') {
      config.stream = convertStreamBlock(block);
    } else if (block.name === 'upstream') {
      // Upstream at root level (outside http, less common but valid)
      config.upstreams.push(convertBlockToUpstream(block));
    } else if (block.name === 'server') {
      // Server at root level (outside http, less common but valid)
      const { server, locations } = convertBlockToServer(block);
      config.servers.push(server);
      config.locations.push(...locations);
    }
  }

  foldHttpsRedirectServers(config);

  // Link locations to upstreams by proxy_pass
  for (const location of config.locations) {
    if (location.proxyPass) {
      // Check if proxy_pass references an upstream
      const upstreamMatch = location.proxyPass.match(/http:\/\/([^\/]+)/);
      if (upstreamMatch) {
        const upstreamName = upstreamMatch[1];
        const upstream = config.upstreams.find(u => u.name === upstreamName);
        if (upstream) {
          location.upstreamId = upstream.id;
        }
      }
    }
  }

  return config;
}
