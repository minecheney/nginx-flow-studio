import { v4 as uuidv4 } from 'uuid';
import {
  NginxConfig,
  ServerConfig,
  LocationConfig,
  UpstreamConfig,
  defaultGlobalConfig,
  defaultEventsConfig,
  defaultHttpConfig,
  defaultSSLConfig,
} from '@/types/nginx';

export type TemplateCategory = 'frontend' | 'backend' | 'cms' | 'ha' | 'security';

export interface TemplateDefinition {
  id: string;
  category: TemplateCategory;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string; // Lucide icon name
  tags: string[];
  config: NginxConfig;
}

// Helper to create IDs
const genId = () => uuidv4();

// ============================================================
// Template 1: React/Vue SPA 单页应用
// ============================================================
const createSpaTemplate = (): TemplateDefinition => {
  const serverId = genId();
  const locationRootId = genId();
  const locationStaticId = genId();

  const server: ServerConfig = {
    id: serverId,
    name: 'SPA Server',
    listen: { port: 80, defaultServer: true, http2: false },
    serverName: 'app.example.com',
    ssl: { ...defaultSSLConfig, enabled: false },
    root: '/var/www/html/dist',
    index: ['index.html'],
    customDirectives: '',
  };

  const locationRoot: LocationConfig = {
    id: locationRootId,
    serverId,
    modifier: '',
    path: '/',
    proxyPass: '',
    upstreamId: null,
    headers: [],
    cors: { enabled: false, allowOrigin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type'], allowCredentials: false },
    websocket: false,
    alias: '',
    // 关键配置：解决 SPA 路由刷新 404 问题
    tryFiles: '$uri $uri/ /index.html',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: 'Restricted', userFile: '' } },
    customDirectives: '# SPA 关键配置：所有路由回退到 index.html\n# 解决 Vue Router / React Router 刷新 404 问题',
  };

  const locationStatic: LocationConfig = {
    id: locationStaticId,
    serverId,
    modifier: '~*',
    path: '\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$',
    proxyPass: '',
    upstreamId: null,
    headers: [],
    cors: { enabled: false, allowOrigin: '*', allowMethods: ['GET'], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '$uri =404',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: 'expires 30d;\nadd_header Cache-Control "public, no-transform";\naccess_log off;\n# 静态资源长期缓存，减少服务器请求',
  };

  return {
    id: 'spa-react-vue',
    category: 'frontend',
    name: 'React/Vue SPA',
    nameZh: 'React/Vue 单页应用',
    description: 'Single Page Application with HTML5 History mode routing, Gzip compression, and static asset caching.',
    descriptionZh: '单页应用配置，支持 HTML5 History 路由模式，解决刷新 404 问题，开启 Gzip 压缩和静态资源缓存。',
    icon: 'Code2',
    tags: ['React', 'Vue', 'SPA', 'Frontend', 'Vite'],
    config: {
      global: { ...defaultGlobalConfig },
      events: { ...defaultEventsConfig, workerConnections: 2048 },
      http: {
        ...defaultHttpConfig,
        gzip: {
          enabled: true,
          types: ['text/plain', 'text/css', 'application/json', 'application/javascript', 'text/xml', 'application/xml', 'image/svg+xml'],
          compLevel: 6,
          minLength: 1024,
        },
      },
      upstreams: [],
      servers: [server],
      locations: [locationRoot, locationStatic],
      stream: { upstreams: [], servers: [], customDirectives: '' },
    },
  };
};

// ============================================================
// Template 2: 静态资源服务器 (CDN Origin)
// ============================================================
const createStaticCdnTemplate = (): TemplateDefinition => {
  const serverId = genId();
  const locationAssetsId = genId();
  const locationRootId = genId();

  const server: ServerConfig = {
    id: serverId,
    name: 'Static CDN Origin',
    listen: { port: 80, defaultServer: false, http2: false },
    serverName: 'cdn.example.com',
    ssl: { ...defaultSSLConfig, enabled: false },
    root: '/var/www/static',
    index: ['index.html'],
    customDirectives: '',
  };

  const locationAssets: LocationConfig = {
    id: locationAssetsId,
    serverId,
    modifier: '~*',
    path: '\\.(jpg|jpeg|png|gif|ico|css|js|woff2?|eot|ttf|svg|mp4|webp)$',
    proxyPass: '',
    upstreamId: null,
    headers: [],
    cors: { enabled: true, allowOrigin: '*', allowMethods: ['GET', 'HEAD', 'OPTIONS'], allowHeaders: ['Range'], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '$uri =404',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: `expires 30d;
add_header Cache-Control "public, no-transform";
add_header X-Content-Type-Options "nosniff";
access_log off;

# 防盗链配置 - 只允许指定域名访问
valid_referers none blocked server_names *.example.com example.com;
if ($invalid_referer) {
    return 403;
}`,
  };

  const locationRoot: LocationConfig = {
    id: locationRootId,
    serverId,
    modifier: '',
    path: '/',
    proxyPass: '',
    upstreamId: null,
    headers: [],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '$uri $uri/ =404',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: '',
  };

  return {
    id: 'static-cdn-origin',
    category: 'frontend',
    name: 'Static CDN Origin',
    nameZh: '静态资源服务器',
    description: 'Optimized for serving static assets with long cache headers and hotlink protection.',
    descriptionZh: '针对静态资源优化，设置 30 天长期缓存，配置防盗链保护，适合作为 CDN 源站。',
    icon: 'Image',
    tags: ['CDN', 'Static', 'Cache', 'Assets'],
    config: {
      global: { ...defaultGlobalConfig },
      events: { ...defaultEventsConfig, workerConnections: 4096 },
      http: { ...defaultHttpConfig, gzip: { ...defaultHttpConfig.gzip, enabled: true, compLevel: 5 } },
      upstreams: [],
      servers: [server],
      locations: [locationAssets, locationRoot],
      stream: { upstreams: [], servers: [], customDirectives: '' },
    },
  };
};

// ============================================================
// Template 3: Node.js / Express / NestJS 反向代理
// ============================================================
const createNodejsProxyTemplate = (): TemplateDefinition => {
  const serverId = genId();
  const upstreamId = genId();
  const locationApiId = genId();
  const locationStaticId = genId();

  const upstream: UpstreamConfig = {
    id: upstreamId,
    name: 'nodejs_backend',
    strategy: 'round_robin',
    servers: [
      { id: genId(), address: '127.0.0.1', port: 3000, weight: 1, maxFails: 3, failTimeout: 30, backup: false, down: false },
    ],
    customDirectives: 'keepalive 32;  # 保持与后端的长连接，提高性能',
  };

  const server: ServerConfig = {
    id: serverId,
    name: 'Node.js Proxy',
    listen: { port: 80, defaultServer: false, http2: false },
    serverName: 'api.example.com',
    ssl: { ...defaultSSLConfig, enabled: false },
    root: '/var/www/html',
    index: ['index.html'],
    customDirectives: '',
  };

  const locationApi: LocationConfig = {
    id: locationApiId,
    serverId,
    modifier: '',
    path: '/',
    proxyPass: 'http://nodejs_backend',
    upstreamId,
    headers: [
      { name: 'Host', value: '$host', enabled: true },
      { name: 'X-Real-IP', value: '$remote_addr', enabled: true },
      { name: 'X-Forwarded-For', value: '$proxy_add_x_forwarded_for', enabled: true },
      { name: 'X-Forwarded-Proto', value: '$scheme', enabled: true },
    ],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: `proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_connect_timeout 60s;
proxy_read_timeout 60s;
proxy_send_timeout 60s;

# 透传真实客户端 IP，后端可通过 req.ip 获取`,
  };

  return {
    id: 'nodejs-express-proxy',
    category: 'backend',
    name: 'Node.js / Express',
    nameZh: 'Node.js 反向代理',
    description: 'Reverse proxy for Node.js apps (Express, NestJS, Fastify) with proper header forwarding.',
    descriptionZh: '适用于 Express、NestJS、Fastify 等 Node.js 应用的反向代理，正确透传 Host 和真实 IP 头。',
    icon: 'Server',
    tags: ['Node.js', 'Express', 'NestJS', 'API', 'Proxy'],
    config: {
      global: { ...defaultGlobalConfig },
      events: { ...defaultEventsConfig },
      http: { ...defaultHttpConfig, clientMaxBodySize: '50m' },
      upstreams: [upstream],
      servers: [server],
      locations: [locationApi],
      stream: { upstreams: [], servers: [], customDirectives: '' },
    },
  };
};

// ============================================================
// Template 4: Python (Django/Flask/FastAPI)
// ============================================================
const createPythonProxyTemplate = (): TemplateDefinition => {
  const serverId = genId();
  const upstreamId = genId();
  const locationId = genId();
  const locationStaticId = genId();

  const upstream: UpstreamConfig = {
    id: upstreamId,
    name: 'python_backend',
    strategy: 'round_robin',
    servers: [
      { id: genId(), address: '127.0.0.1', port: 8000, weight: 1, maxFails: 3, failTimeout: 30, backup: false, down: false },
    ],
    customDirectives: '# Gunicorn/Uvicorn 默认运行在 8000 端口',
  };

  const server: ServerConfig = {
    id: serverId,
    name: 'Python App Proxy',
    listen: { port: 80, defaultServer: false, http2: false },
    serverName: 'python.example.com',
    ssl: { ...defaultSSLConfig, enabled: false },
    root: '/var/www/python-app',
    index: ['index.html'],
    customDirectives: '',
  };

  const location: LocationConfig = {
    id: locationId,
    serverId,
    modifier: '',
    path: '/',
    proxyPass: 'http://python_backend',
    upstreamId,
    headers: [
      { name: 'Host', value: '$host', enabled: true },
      { name: 'X-Real-IP', value: '$remote_addr', enabled: true },
      { name: 'X-Forwarded-For', value: '$proxy_add_x_forwarded_for', enabled: true },
      { name: 'X-Forwarded-Proto', value: '$scheme', enabled: true },
    ],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: `proxy_http_version 1.1;
proxy_redirect off;
proxy_buffering on;
proxy_buffer_size 128k;
proxy_buffers 4 256k;

# Django/Flask 文件上传支持`,
  };

  const locationStatic: LocationConfig = {
    id: locationStaticId,
    serverId,
    modifier: '',
    path: '/static/',
    proxyPass: '',
    upstreamId: null,
    headers: [],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '/var/www/python-app/static/',
    tryFiles: '$uri =404',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: 'expires 30d;\naccess_log off;\n# Django collectstatic 生成的静态文件目录',
  };

  return {
    id: 'python-django-flask',
    category: 'backend',
    name: 'Python (Django/Flask)',
    nameZh: 'Python 应用代理',
    description: 'Optimized for Python apps with Gunicorn/Uvicorn, larger body size for file uploads, and static file serving.',
    descriptionZh: '针对 Django、Flask、FastAPI 优化，支持大文件上传(100MB)，配置静态文件目录，适配 Gunicorn/Uvicorn。',
    icon: 'FileCode',
    tags: ['Python', 'Django', 'Flask', 'FastAPI', 'Gunicorn'],
    config: {
      global: { ...defaultGlobalConfig },
      events: { ...defaultEventsConfig },
      http: { ...defaultHttpConfig, clientMaxBodySize: '100m' },
      upstreams: [upstream],
      servers: [server],
      locations: [location, locationStatic],
      stream: { upstreams: [], servers: [], customDirectives: '' },
    },
  };
};

// ============================================================
// Template 5: WebSocket 实时通信
// ============================================================
const createWebSocketTemplate = (): TemplateDefinition => {
  const serverId = genId();
  const upstreamId = genId();
  const locationWsId = genId();
  const locationApiId = genId();

  const upstream: UpstreamConfig = {
    id: upstreamId,
    name: 'websocket_backend',
    strategy: 'ip_hash', // WebSocket 需要会话保持
    servers: [
      { id: genId(), address: '127.0.0.1', port: 3001, weight: 1, maxFails: 3, failTimeout: 30, backup: false, down: false },
    ],
    customDirectives: '# WebSocket 需要 ip_hash 保持连接一致性',
  };

  const server: ServerConfig = {
    id: serverId,
    name: 'WebSocket Server',
    listen: { port: 80, defaultServer: false, http2: false },
    serverName: 'ws.example.com',
    ssl: { ...defaultSSLConfig, enabled: false },
    root: '/var/www/html',
    index: ['index.html'],
    customDirectives: '',
  };

  const locationWs: LocationConfig = {
    id: locationWsId,
    serverId,
    modifier: '',
    path: '/ws',
    proxyPass: 'http://websocket_backend',
    upstreamId,
    headers: [
      { name: 'Host', value: '$host', enabled: true },
      { name: 'X-Real-IP', value: '$remote_addr', enabled: true },
      { name: 'X-Forwarded-For', value: '$proxy_add_x_forwarded_for', enabled: true },
      { name: 'X-Forwarded-Proto', value: '$scheme', enabled: true },
    ],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: true, // 关键配置
    alias: '',
    tryFiles: '',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: `# WebSocket 核心配置 - 必须设置
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";

# 长连接超时设置（心跳间隔应小于此值）
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;`,
  };

  const locationApi: LocationConfig = {
    id: locationApiId,
    serverId,
    modifier: '',
    path: '/api',
    proxyPass: 'http://websocket_backend',
    upstreamId,
    headers: [
      { name: 'Host', value: '$host', enabled: true },
      { name: 'X-Real-IP', value: '$remote_addr', enabled: true },
    ],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: '# 普通 HTTP API 请求',
  };

  return {
    id: 'websocket-realtime',
    category: 'backend',
    name: 'WebSocket Realtime',
    nameZh: 'WebSocket 实时通信',
    description: 'WebSocket proxy with proper Upgrade headers and long timeout for persistent connections.',
    descriptionZh: '支持 Socket.io、WS 等 WebSocket 协议，正确配置 Upgrade 头和长超时时间，保持持久连接。',
    icon: 'Radio',
    tags: ['WebSocket', 'Socket.io', 'Realtime', 'Chat'],
    config: {
      global: { ...defaultGlobalConfig },
      events: { ...defaultEventsConfig, workerConnections: 4096 },
      http: { ...defaultHttpConfig },
      upstreams: [upstream],
      servers: [server],
      locations: [locationWs, locationApi],
      stream: { upstreams: [], servers: [], customDirectives: '' },
    },
  };
};

// ============================================================
// Template 6: WordPress (PHP-FPM)
// ============================================================
const createWordPressTemplate = (): TemplateDefinition => {
  const serverId = genId();
  const locationRootId = genId();
  const locationPhpId = genId();
  const locationStaticId = genId();

  const server: ServerConfig = {
    id: serverId,
    name: 'WordPress Server',
    listen: { port: 80, defaultServer: false, http2: false },
    serverName: 'blog.example.com',
    ssl: { ...defaultSSLConfig, enabled: false },
    root: '/var/www/wordpress',
    index: ['index.php', 'index.html'],
    customDirectives: '',
  };

  const locationRoot: LocationConfig = {
    id: locationRootId,
    serverId,
    modifier: '',
    path: '/',
    proxyPass: '',
    upstreamId: null,
    headers: [],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    // WordPress 官方推荐的伪静态规则
    tryFiles: '$uri $uri/ /index.php?$args',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: '# WordPress 伪静态核心规则',
  };

  const locationPhp: LocationConfig = {
    id: locationPhpId,
    serverId,
    modifier: '~',
    path: '\\.php$',
    proxyPass: '',
    upstreamId: null,
    headers: [],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '$uri =404',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: `# PHP-FPM 配置
fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
fastcgi_index index.php;
fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
include fastcgi_params;

# PHP 性能优化
fastcgi_buffer_size 128k;
fastcgi_buffers 4 256k;
fastcgi_busy_buffers_size 256k;`,
  };

  const locationStatic: LocationConfig = {
    id: locationStaticId,
    serverId,
    modifier: '~*',
    path: '\\.(jpg|jpeg|png|gif|ico|css|js|woff2?)$',
    proxyPass: '',
    upstreamId: null,
    headers: [],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '$uri =404',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: 'expires 30d;\naccess_log off;\nadd_header Cache-Control "public";',
  };

  return {
    id: 'wordpress-php-fpm',
    category: 'cms',
    name: 'WordPress',
    nameZh: 'WordPress 博客',
    description: 'Complete WordPress setup with PHP-FPM, pretty permalinks, and media caching.',
    descriptionZh: '完整的 WordPress 配置，包含 PHP-FPM 集成、伪静态规则、媒体文件缓存，开箱即用。',
    icon: 'FileText',
    tags: ['WordPress', 'PHP', 'CMS', 'Blog'],
    config: {
      global: { ...defaultGlobalConfig },
      events: { ...defaultEventsConfig },
      http: { ...defaultHttpConfig, clientMaxBodySize: '64m' },
      upstreams: [],
      servers: [server],
      locations: [locationRoot, locationPhp, locationStatic],
      stream: { upstreams: [], servers: [], customDirectives: '' },
    },
  };
};

// ============================================================
// Template 7: 标准负载均衡 (Round Robin)
// ============================================================
const createLoadBalancerTemplate = (): TemplateDefinition => {
  const serverId = genId();
  const upstreamId = genId();
  const locationId = genId();

  const upstream: UpstreamConfig = {
    id: upstreamId,
    name: 'backend_cluster',
    strategy: 'round_robin',
    servers: [
      { id: genId(), address: '192.168.1.101', port: 8080, weight: 3, maxFails: 3, failTimeout: 30, backup: false, down: false },
      { id: genId(), address: '192.168.1.102', port: 8080, weight: 2, maxFails: 3, failTimeout: 30, backup: false, down: false },
      { id: genId(), address: '192.168.1.103', port: 8080, weight: 1, maxFails: 3, failTimeout: 30, backup: true, down: false },
    ],
    customDirectives: `# Round Robin 加权轮询策略
# weight 越大，分配请求越多
# backup 标记为备用服务器，主服务器全部宕机时启用`,
  };

  const server: ServerConfig = {
    id: serverId,
    name: 'Load Balancer',
    listen: { port: 80, defaultServer: true, http2: false },
    serverName: 'lb.example.com',
    ssl: { ...defaultSSLConfig, enabled: false },
    root: '/var/www/html',
    index: ['index.html'],
    customDirectives: '',
  };

  const location: LocationConfig = {
    id: locationId,
    serverId,
    modifier: '',
    path: '/',
    proxyPass: 'http://backend_cluster',
    upstreamId,
    headers: [
      { name: 'Host', value: '$host', enabled: true },
      { name: 'X-Real-IP', value: '$remote_addr', enabled: true },
      { name: 'X-Forwarded-For', value: '$proxy_add_x_forwarded_for', enabled: true },
      { name: 'X-Forwarded-Proto', value: '$scheme', enabled: true },
    ],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: `proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_next_upstream error timeout http_500 http_502 http_503;
proxy_next_upstream_tries 3;

# 自动故障转移：后端返回 5xx 错误时切换到下一台服务器`,
  };

  return {
    id: 'load-balancer-round-robin',
    category: 'ha',
    name: 'Load Balancer',
    nameZh: '标准负载均衡',
    description: 'Round-robin load balancer with weighted distribution, health checks, and automatic failover.',
    descriptionZh: '加权轮询负载均衡，支持健康检查、自动故障转移、备用服务器，适用于无状态应用。',
    icon: 'Network',
    tags: ['Load Balancer', 'HA', 'Upstream', 'Cluster'],
    config: {
      global: { ...defaultGlobalConfig, workerProcesses: 'auto' },
      events: { ...defaultEventsConfig, workerConnections: 4096 },
      http: { ...defaultHttpConfig },
      upstreams: [upstream],
      servers: [server],
      locations: [location],
      stream: { upstreams: [], servers: [], customDirectives: '' },
    },
  };
};

// ============================================================
// Template 8: IP Hash 会话保持
// ============================================================
const createIpHashTemplate = (): TemplateDefinition => {
  const serverId = genId();
  const upstreamId = genId();
  const locationId = genId();

  const upstream: UpstreamConfig = {
    id: upstreamId,
    name: 'stateful_backend',
    strategy: 'ip_hash',
    servers: [
      { id: genId(), address: '192.168.1.101', port: 8080, weight: 1, maxFails: 3, failTimeout: 30, backup: false, down: false },
      { id: genId(), address: '192.168.1.102', port: 8080, weight: 1, maxFails: 3, failTimeout: 30, backup: false, down: false },
      { id: genId(), address: '192.168.1.103', port: 8080, weight: 1, maxFails: 3, failTimeout: 30, backup: false, down: false },
    ],
    customDirectives: `# IP Hash 策略确保同一 IP 的请求总是发送到同一后端
# 适用于：Session 存储在服务器内存的有状态应用
# 注意：如果后端服务器变化，部分用户的 Session 会丢失`,
  };

  const server: ServerConfig = {
    id: serverId,
    name: 'Sticky Session LB',
    listen: { port: 80, defaultServer: false, http2: false },
    serverName: 'app.example.com',
    ssl: { ...defaultSSLConfig, enabled: false },
    root: '/var/www/html',
    index: ['index.html'],
    customDirectives: '',
  };

  const location: LocationConfig = {
    id: locationId,
    serverId,
    modifier: '',
    path: '/',
    proxyPass: 'http://stateful_backend',
    upstreamId,
    headers: [
      { name: 'Host', value: '$host', enabled: true },
      { name: 'X-Real-IP', value: '$remote_addr', enabled: true },
      { name: 'X-Forwarded-For', value: '$proxy_add_x_forwarded_for', enabled: true },
    ],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: `proxy_http_version 1.1;
proxy_set_header Connection "";

# 会话保持场景：用户登录状态、购物车等`,
  };

  return {
    id: 'load-balancer-ip-hash',
    category: 'ha',
    name: 'IP Hash Session',
    nameZh: 'IP Hash 会话保持',
    description: 'IP-based sticky session load balancing for stateful applications with server-side sessions.',
    descriptionZh: '基于客户端 IP 的会话保持，确保同一用户始终访问同一后端，适用于有状态应用（Session/购物车）。',
    icon: 'Fingerprint',
    tags: ['IP Hash', 'Session', 'Sticky', 'Stateful'],
    config: {
      global: { ...defaultGlobalConfig },
      events: { ...defaultEventsConfig, workerConnections: 4096 },
      http: { ...defaultHttpConfig },
      upstreams: [upstream],
      servers: [server],
      locations: [location],
      stream: { upstreams: [], servers: [], customDirectives: '' },
    },
  };
};

// ============================================================
// Template 9: HTTPS 强制跳转 (Force SSL)
// ============================================================
const createForceHttpsTemplate = (): TemplateDefinition => {
  const serverHttpId = genId();
  const serverHttpsId = genId();
  const locationHttpsId = genId();

  const serverHttp: ServerConfig = {
    id: serverHttpId,
    name: 'HTTP Redirect',
    listen: { port: 80, defaultServer: false, http2: false },
    serverName: 'secure.example.com',
    ssl: { ...defaultSSLConfig, enabled: false },
    root: '/var/www/html',
    index: ['index.html'],
    customDirectives: '# 所有 HTTP 请求 301 重定向到 HTTPS\nreturn 301 https://$host$request_uri;',
  };

  const serverHttps: ServerConfig = {
    id: serverHttpsId,
    name: 'HTTPS Server',
    listen: { port: 443, defaultServer: false, http2: true },
    serverName: 'secure.example.com',
    ssl: {
      enabled: true,
      certificate: '/etc/nginx/ssl/example.com.crt',
      certificateKey: '/etc/nginx/ssl/example.com.key',
      protocols: ['TLSv1.2', 'TLSv1.3'],
      ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
      forceRedirect: true,
    },
    root: '/var/www/html',
    index: ['index.html'],
    customDirectives: `# HSTS - 强制浏览器使用 HTTPS（慎用，需确保 HTTPS 稳定）
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# 安全响应头
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;`,
  };

  const locationHttps: LocationConfig = {
    id: locationHttpsId,
    serverId: serverHttpsId,
    modifier: '',
    path: '/',
    proxyPass: '',
    upstreamId: null,
    headers: [],
    cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
    websocket: false,
    alias: '',
    tryFiles: '$uri $uri/ /index.html',
    returnCode: null,
    returnUrl: '',
    rewrite: null,
    accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
    customDirectives: '',
  };

  return {
    id: 'https-force-ssl',
    category: 'security',
    name: 'Force HTTPS',
    nameZh: 'HTTPS 强制跳转',
    description: 'HTTP to HTTPS redirect with modern TLS configuration, HSTS, and security headers.',
    descriptionZh: '强制 HTTP 跳转 HTTPS，配置 TLS 1.2/1.3、HSTS、安全响应头，符合最佳安全实践。',
    icon: 'Shield',
    tags: ['HTTPS', 'SSL', 'TLS', 'Security', 'HSTS'],
    config: {
      global: { ...defaultGlobalConfig },
      events: { ...defaultEventsConfig },
      http: { ...defaultHttpConfig, serverTokens: false },
      upstreams: [],
      servers: [serverHttp, serverHttps],
      locations: [locationHttps],
      stream: { upstreams: [], servers: [], customDirectives: '' },
    },
  };
};

// ============================================================
// Export All Templates
// ============================================================
export const templates: TemplateDefinition[] = [
  createSpaTemplate(),
  createStaticCdnTemplate(),
  createNodejsProxyTemplate(),
  createPythonProxyTemplate(),
  createWebSocketTemplate(),
  createWordPressTemplate(),
  createLoadBalancerTemplate(),
  createIpHashTemplate(),
  createForceHttpsTemplate(),
];

export const templateCategories: { id: TemplateCategory; name: string; nameZh: string; icon: string }[] = [
  { id: 'frontend', name: 'Frontend & Static', nameZh: '前端 & 静态', icon: 'Layout' },
  { id: 'backend', name: 'Backend & API', nameZh: '后端 & API', icon: 'Server' },
  { id: 'cms', name: 'CMS', nameZh: '内容管理', icon: 'FileText' },
  { id: 'ha', name: 'High Availability', nameZh: '高可用', icon: 'Network' },
  { id: 'security', name: 'Security', nameZh: '安全', icon: 'Shield' },
];

export const getTemplatesByCategory = (category: TemplateCategory): TemplateDefinition[] => {
  return templates.filter(t => t.category === category);
};

export const searchTemplates = (query: string): TemplateDefinition[] => {
  const lowerQuery = query.toLowerCase();
  return templates.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.nameZh.includes(query) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.descriptionZh.includes(query) ||
    t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
};
