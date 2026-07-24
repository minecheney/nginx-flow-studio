import { v4 as uuidv4 } from 'uuid';

// ============== Type Definitions ==============

export interface GlobalConfig {
  user: string;
  workerProcesses: string;
  errorLog: {
    path: string;
    level: 'debug' | 'info' | 'notice' | 'warn' | 'error' | 'crit';
  };
  pid: string;
  customDirectives: string;
}

export interface EventsConfig {
  workerConnections: number;
  use: 'epoll' | 'kqueue' | 'select' | 'poll';
  multiAccept: boolean;
  customDirectives: string;
}

export interface HttpConfig {
  // Basic
  sendfile: boolean;
  tcpNopush: boolean;
  tcpNodelay: boolean;
  keepaliveTimeout: number;
  typesHashMaxSize: number;
  
  // MIME
  includeMimeTypes: boolean;
  defaultType: string;
  
  // Logging
  logFormat: {
    name: string;
    format: string;
  };
  accessLog: {
    path: string;
    format: string;
  };
  
  // Gzip
  gzip: {
    enabled: boolean;
    types: string[];
    compLevel: number;
    minLength: number;
  };
  
  // Security
  serverTokens: boolean;
  clientMaxBodySize: string;
  
  customDirectives: string;
}

export interface UpstreamServer {
  id: string;
  address: string;
  port: number;
  weight: number;
  maxFails: number;
  failTimeout: number;
  backup: boolean;
  down: boolean;
}

export interface UpstreamConfig {
  id: string;
  name: string;
  strategy: 'round_robin' | 'least_conn' | 'ip_hash';
  servers: UpstreamServer[];
  customDirectives: string;
}

export interface StreamUpstreamConfig {
  id: string;
  name: string;
  hashKey: string;
  hashConsistent: boolean;
  servers: UpstreamServer[];
  customDirectives: string;
}

export interface StreamServerConfig {
  id: string;
  name: string;
  listenPort: number;
  udp: boolean;
  proxyPass: string;
  proxyConnectTimeout: string;
  proxyTimeout: string;
  socketKeepalive: boolean;
  customDirectives: string;
}

export interface StreamConfig {
  upstreams: StreamUpstreamConfig[];
  servers: StreamServerConfig[];
  customDirectives: string;
}

export interface SSLConfig {
  enabled: boolean;
  certificate: string;
  certificateKey: string;
  protocols: string[];
  ciphers: string;
  forceRedirect: boolean;
}

export interface ServerConfig {
  id: string;
  name: string;
  listen: {
    port: number;
    defaultServer: boolean;
    http2: boolean;
  };
  serverName: string;
  ssl: SSLConfig;
  root: string;
  index: string[];
  customDirectives: string;
}

export interface ProxyHeader {
  name: string;
  value: string;
  enabled: boolean;
}

export interface CorsConfig {
  enabled: boolean;
  allowOrigin: string;
  allowMethods: string[];
  allowHeaders: string[];
  allowCredentials: boolean;
}

export interface AccessControl {
  allow: string[];
  deny: string[];
  authBasic: {
    enabled: boolean;
    realm: string;
    userFile: string;
  };
}

export interface LocationConfig {
  id: string;
  serverId: string;
  modifier: '' | '=' | '~' | '~*' | '^~';
  path: string;
  
  // Proxy
  proxyPass: string;
  upstreamId: string | null;
  headers: ProxyHeader[];
  cors: CorsConfig;
  websocket: boolean; // WebSocket support
  
  // Static
  alias: string;
  tryFiles: string;
  returnCode: number | null;
  returnUrl: string;
  rewrite: {
    pattern: string;
    replacement: string;
    flag: 'last' | 'break' | 'redirect' | 'permanent';
  } | null;
  
  // Access
  accessControl: AccessControl;
  
  customDirectives: string;
}

export interface NginxConfig {
  global: GlobalConfig;
  events: EventsConfig;
  http: HttpConfig;
  upstreams: UpstreamConfig[];
  servers: ServerConfig[];
  locations: LocationConfig[];
  stream: StreamConfig;
  // Store raw config when imported - used to preserve original content exactly
  rawConfig?: string;
}

// ============== Default Values ==============

export const defaultGlobalConfig: GlobalConfig = {
  user: 'nginx',
  workerProcesses: 'auto',
  errorLog: {
    path: '/var/log/nginx/error.log',
    level: 'warn',
  },
  pid: '/run/nginx.pid',
  customDirectives: 'include /usr/share/nginx/modules/*.conf;',
};

export const defaultEventsConfig: EventsConfig = {
  workerConnections: 1024,
  use: 'epoll',
  multiAccept: true,
  customDirectives: '',
};

export const defaultHttpConfig: HttpConfig = {
  sendfile: true,
  tcpNopush: true,
  tcpNodelay: true,
  keepaliveTimeout: 65,
  typesHashMaxSize: 2048,
  includeMimeTypes: true,
  defaultType: 'application/octet-stream',
  logFormat: {
    name: 'main',
    format: '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"',
  },
  accessLog: {
    path: '/var/log/nginx/access.log',
    format: 'main',
  },
  gzip: {
    enabled: true,
    types: ['text/plain', 'text/css', 'application/json', 'application/javascript', 'text/xml', 'application/xml'],
    compLevel: 6,
    minLength: 1024,
  },
  serverTokens: false,
  clientMaxBodySize: '10m',
  customDirectives: '',
};

export const defaultSSLConfig: SSLConfig = {
  enabled: false,
  certificate: '/etc/nginx/ssl/cert.pem',
  certificateKey: '/etc/nginx/ssl/key.pem',
  protocols: ['TLSv1.2', 'TLSv1.3'],
  ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
  forceRedirect: true,
};

export const createDefaultServer = (): ServerConfig => ({
  id: uuidv4(),
  name: 'New Server',
  listen: {
    port: 80,
    defaultServer: false,
    http2: false,
  },
  serverName: 'example.com',
  ssl: { ...defaultSSLConfig },
  root: '/var/www/html',
  index: ['index.html', 'index.htm'],
  customDirectives: '',
});

export const createDefaultLocation = (serverId: string): LocationConfig => ({
  id: uuidv4(),
  serverId,
  modifier: '',
  path: '/',
  proxyPass: '',
  upstreamId: null,
  headers: [
    { name: 'Host', value: '$host', enabled: true },
    { name: 'X-Real-IP', value: '$remote_addr', enabled: true },
    { name: 'X-Forwarded-For', value: '$proxy_add_x_forwarded_for', enabled: true },
    { name: 'X-Forwarded-Proto', value: '$scheme', enabled: true },
  ],
  cors: {
    enabled: false,
    allowOrigin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowCredentials: false,
  },
  websocket: false,
  alias: '',
  tryFiles: '',
  returnCode: null,
  returnUrl: '',
  rewrite: null,
  accessControl: {
    allow: [],
    deny: [],
    authBasic: {
      enabled: false,
      realm: 'Restricted',
      userFile: '/etc/nginx/.htpasswd',
    },
  },
  customDirectives: '',
});

export const createDefaultUpstream = (): UpstreamConfig => ({
  id: uuidv4(),
  name: 'backend',
  strategy: 'round_robin',
  servers: [
    {
      id: uuidv4(),
      address: '127.0.0.1',
      port: 3000,
      weight: 1,
      maxFails: 3,
      failTimeout: 30,
      backup: false,
      down: false,
    },
  ],
  customDirectives: '',
});

export const createDefaultStreamUpstream = (): StreamUpstreamConfig => ({
  id: uuidv4(),
  name: 'socket_proxy',
  hashKey: '',
  hashConsistent: false,
  servers: [
    {
      id: uuidv4(),
      address: '127.0.0.1',
      port: 9001,
      weight: 1,
      maxFails: 3,
      failTimeout: 30,
      backup: false,
      down: false,
    },
  ],
  customDirectives: '',
});

export const createDefaultStreamServer = (proxyPass = ''): StreamServerConfig => ({
  id: uuidv4(),
  name: 'TCP Proxy',
  listenPort: 9000,
  udp: false,
  proxyPass,
  proxyConnectTimeout: '10s',
  proxyTimeout: '5m',
  socketKeepalive: true,
  customDirectives: '',
});

export const defaultNginxConfig: NginxConfig = {
  global: defaultGlobalConfig,
  events: defaultEventsConfig,
  http: defaultHttpConfig,
  upstreams: [],
  servers: [],
  locations: [],
  stream: {
    upstreams: [],
    servers: [],
    customDirectives: '',
  },
};
