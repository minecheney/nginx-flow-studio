# Nginx Flow Studio / Nginx 可视化配置工作台

[English](#english) | [中文](#中文)

> 本项目基于 [Anarkh-Lee/nginx-flow](https://github.com/Anarkh-Lee/nginx-flow) 修改并持续扩展，感谢原作者提供的可视化配置基础。当前版本新增了多配置文件管理、无损源码导入与编辑、`stream` / TCP / Socket 配置、源码定位以及可直接使用的 `.conf` 导出等能力。
>
> This project is based on [Anarkh-Lee/nginx-flow](https://github.com/Anarkh-Lee/nginx-flow) and extends it with multi-file workspaces, lossless source editing, `stream` / TCP / Socket support, source navigation, and deployable `.conf` exports.

- 当前仓库 / Repository: [minecheney/nginx-flow-studio](https://github.com/minecheney/nginx-flow-studio)
- 在线体验 / Live Demo: [nginx-flow-studio.vercel.app](https://nginx-flow-studio.vercel.app)

---

<a name="中文"></a>
## 中文文档

### 📖 项目简介

**Nginx Flow Studio** 是一款基于 `nginx-flow` 扩展的 Nginx 配置文件可视化工作台。它在保留节点化画布体验的同时，支持多配置文件、源码与可视化双向编辑、原始注释与未知指令保留，以及 HTTP 和 Stream 配置管理。

### ✨ 核心特性

- 🎨 **可视化画布编辑** - 拖拽节点构建配置，所见即所得
- 📦 **丰富的模板库** - 一键套用常见场景配置模板
- 🔍 **智能配置体检** - 自动检测安全隐患和性能问题
- 🔧 **一键修复** - 自动修复检测到的配置问题
- 📝 **实时预览** - 实时生成标准 nginx.conf 配置文件
- 📥 **导入/导出** - 支持导入现有配置，导出为配置文件或 Dockerfile
- 🌐 **中英双语** - 完整的中英文界面支持
- 🚀 **流量模拟** - 可视化模拟请求路径匹配

---

### 🏗️ 功能详解

#### 1. 可视化画布编辑器

画布是本工具的核心交互区域，采用 React Flow 实现节点化配置管理。

**支持的节点类型：**

| 节点类型 | 说明 | 对应 Nginx 块 |
|---------|------|--------------|
| **Server 节点** | 虚拟主机配置 | `server { }` |
| **Location 节点** | 路径匹配规则 | `location { }` |
| **Upstream 节点** | 负载均衡后端 | `upstream { }` |

**画布操作：**
- **拖拽添加** - 从左侧边栏拖拽节点到画布
- **连线关联** - 连接 Location 到 Upstream 配置代理
- **框选多选** - 批量选中和移动节点
- **自动布局** - 一键整理节点位置
- **缩放平移** - 滚轮缩放，拖拽平移

#### 2. 属性面板

选中任意节点后，右侧属性面板可编辑该节点的详细配置。

**Server 节点属性：**
- 监听端口 (`listen`)
- 服务器名称 (`server_name`)
- SSL/HTTPS 配置
- 根目录 (`root`) 和索引文件 (`index`)
- HTTP 强制跳转 HTTPS
- 自定义指令

**Location 节点属性：**
- 路径匹配模式 (`=`, `~`, `~*`, `^~`, 无修饰符)
- 代理转发 (`proxy_pass`)
- 代理头设置 (`proxy_set_header`)
- CORS 跨域配置
- WebSocket 支持
- `try_files` 配置
- 重写规则 (`rewrite`)
- 访问控制 (`allow` / `deny`)
- Basic 认证

**Upstream 节点属性：**
- 负载均衡策略 (轮询 / 权重 / IP Hash / 最少连接)
- 后端服务器列表
- 健康检查参数 (`max_fails`, `fail_timeout`)
- 备份服务器 (`backup`)
- 长连接配置 (`keepalive`)

#### 3. 模板库

内置多种生产级配置模板，覆盖常见应用场景：

| 分类 | 模板名称 | 适用场景 |
|-----|---------|---------|
| **前端** | React/Vue SPA | 单页应用，解决 History 模式刷新 404 |
| **前端** | 静态资源服务器 | CDN 源站，长期缓存 + 防盗链 |
| **后端** | Node.js 反向代理 | Express / NestJS / Fastify |
| **后端** | Python 应用代理 | Django / Flask / FastAPI |
| **后端** | WebSocket 实时通信 | Socket.io / WS 长连接 |
| **CMS** | WordPress (PHP-FPM) | 博客站点，PHP 处理 |
| **CMS** | Laravel | PHP 框架，伪静态规则 |
| **高可用** | 多后端负载均衡 | 流量分发，故障转移 |
| **高可用** | 蓝绿部署 | 零宕机发布 |
| **安全** | HTTPS 最佳实践 | TLS 1.2+，HSTS，强制跳转 |
| **安全** | 限流配置 | 防 DDoS，API 限流 |
| **安全** | 隐藏敏感文件 | 禁止访问 .git / .env 等 |

#### 4. 配置体检 (Audit)

智能分析配置，检测潜在问题并给出修复建议。

**检测规则分类：**

| 类别 | 规则示例 | 严重程度 |
|-----|---------|---------|
| **安全** | 暴露 Nginx 版本号 (`server_tokens on`) | 🔴 严重 |
| **安全** | 使用 root 用户运行 | 🔴 严重 |
| **安全** | 开启目录索引 (`autoindex on`) | 🔴 严重 |
| **安全** | 使用不安全的 SSL 协议 (TLSv1/TLSv1.1) | 🔴 严重 |
| **安全** | HTTPS 未强制跳转 | 🟡 警告 |
| **安全** | 缺少安全响应头 (X-Frame-Options 等) | 🟡 警告 |
| **安全** | 未禁止隐藏文件访问 | 🟡 警告 |
| **性能** | 未开启 Gzip 压缩 | 🟡 警告 |
| **性能** | 未开启 Sendfile | 🟡 警告 |
| **配置** | 存在未使用的 Upstream | ℹ️ 提示 |

**评分机制：**
- 满分 100 分
- 严重问题扣 15 分，警告扣 8 分，提示扣 3 分
- 评级：A (90+) / B (75+) / C (60+) / D (40+) / F (<40)

#### 5. 一键修复

针对检测到的问题，支持自动修复：

- **单项修复** - 点击问题旁的修复按钮
- **一键全部修复** - 批量修复所有可自动修复的问题

**修复能力：**
- 自动添加 `server_tokens off`
- 自动修正 `user` 为 `nginx`
- 自动移除 `autoindex on`
- 自动升级 SSL 协议到 TLSv1.2+
- 自动配置 HTTP 到 HTTPS 强制跳转（智能处理端口冲突）
- 自动添加安全响应头
- 自动开启 Gzip 和 Sendfile
- 自动添加隐藏文件访问禁止规则

#### 6. 实时配置预览

底部预览面板实时生成完整的 `nginx.conf` 配置文件。

**功能：**
- 语法高亮显示
- 一键复制到剪贴板
- 导出为 `.conf` 文件
- 导出为 `Dockerfile`（包含完整部署配置）

#### 7. 配置导入

支持导入现有的 Nginx 配置文件进行可视化编辑。

**导入方式：**
- 粘贴配置文本
- 上传 `.conf` 文件

**解析能力：**
- 自动识别 `server`、`location`、`upstream` 块
- 解析 SSL 配置
- 解析负载均衡配置
- 保留自定义指令

#### 8. 流量模拟器

可视化模拟请求路径匹配，帮助理解 Location 匹配优先级。

**使用方法：**
1. 输入请求路径（如 `/api/users`）
2. 查看匹配到的 Location 节点高亮
3. 理解精确匹配 > 前缀匹配 > 正则匹配的优先级

#### 9. 多语言支持

完整的中英文界面切换，包括：
- 界面文案
- 配置说明
- 审计报告
- 模板描述

---

### � 访问统计

本项目已集成 **Google Analytics 4 (GA4)**，用于统计生产环境的访问量和功能使用情况。

✅ **完全免费** - 无需部署额外服务器  
✅ **隐私优先** - IP 匿名化，符合 GDPR  
✅ **用户可控** - Cookie 同意横幅，可选择接受或拒绝  

**快速配置：**

1. 创建 GA4 账号并获取 Measurement ID
2. 配置环境变量：
   ```bash
   cp .env.example .env.local
   # 编辑 .env.local，替换 VITE_GA_MEASUREMENT_ID
   ```
3. 详细文档：[GA4 集成指南](./docs/GA4_INTEGRATION.md)

---

### 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式方案**: Tailwind CSS
- **UI 组件**: shadcn/ui
- **画布引擎**: @xyflow/react (React Flow)
- **布局算法**: Dagre
- **状态管理**: React Context
- **访问统计**: Google Analytics 4 (react-ga4)

---

### 🚀 快速开始

```bash
# 克隆仓库
git clone https://github.com/minecheney/nginx-flow-studio.git

# 进入项目目录
cd nginx-flow-studio

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

---

### 📸 界面预览

| 功能 | 说明 |
|-----|------|
| 可视化画布 | 拖拽节点构建配置 |
| 属性编辑 | 详细的配置项表单 |
| 配置体检 | 问题检测与一键修复 |
| 模板库 | 丰富的预置模板 |
| 实时预览 | 生成的 nginx.conf |

---

### 📄 许可证

MIT License

---

<a name="english"></a>
## English Documentation

### 📖 Introduction

**Nginx Config Visual Editor** is a powerful visual configuration tool for Nginx. Through an intuitive drag-and-drop canvas interface, it helps DevOps engineers and developers quickly build, debug, and optimize Nginx configurations, eliminating the hassle of manual configuration and syntax errors.

### ✨ Key Features

- 🎨 **Visual Canvas Editor** - Build configurations by dragging nodes, WYSIWYG
- 📦 **Rich Template Library** - One-click application of common scenario templates
- 🔍 **Smart Configuration Audit** - Auto-detect security risks and performance issues
- 🔧 **One-Click Fix** - Automatically fix detected configuration issues
- 📝 **Real-time Preview** - Generate standard nginx.conf in real-time
- 📥 **Import/Export** - Import existing configs, export as config files or Dockerfile
- 🌐 **Bilingual** - Full Chinese and English interface support
- 🚀 **Traffic Simulator** - Visualize request path matching

---

### 🏗️ Feature Details

#### 1. Visual Canvas Editor

The canvas is the core interaction area, using React Flow for node-based configuration management.

**Supported Node Types:**

| Node Type | Description | Nginx Block |
|-----------|-------------|-------------|
| **Server Node** | Virtual host configuration | `server { }` |
| **Location Node** | Path matching rules | `location { }` |
| **Upstream Node** | Load balancing backend | `upstream { }` |

**Canvas Operations:**
- **Drag to Add** - Drag nodes from the sidebar to canvas
- **Connect Lines** - Connect Location to Upstream for proxy config
- **Box Select** - Batch select and move nodes
- **Auto Layout** - One-click node arrangement
- **Zoom & Pan** - Scroll to zoom, drag to pan

#### 2. Property Panel

When selecting any node, the right property panel allows editing detailed configurations.

**Server Node Properties:**
- Listen port (`listen`)
- Server name (`server_name`)
- SSL/HTTPS configuration
- Root directory (`root`) and index files (`index`)
- Force HTTP to HTTPS redirect
- Custom directives

**Location Node Properties:**
- Path matching modifiers (`=`, `~`, `~*`, `^~`, none)
- Proxy pass (`proxy_pass`)
- Proxy headers (`proxy_set_header`)
- CORS configuration
- WebSocket support
- `try_files` configuration
- Rewrite rules (`rewrite`)
- Access control (`allow` / `deny`)
- Basic authentication

**Upstream Node Properties:**
- Load balancing strategy (Round Robin / Weighted / IP Hash / Least Connections)
- Backend server list
- Health check parameters (`max_fails`, `fail_timeout`)
- Backup servers (`backup`)
- Keep-alive configuration (`keepalive`)

#### 3. Template Library

Built-in production-grade configuration templates covering common scenarios:

| Category | Template Name | Use Case |
|----------|---------------|----------|
| **Frontend** | React/Vue SPA | Single Page Apps, solve History mode 404 |
| **Frontend** | Static CDN Origin | CDN origin, long cache + hotlink protection |
| **Backend** | Node.js Reverse Proxy | Express / NestJS / Fastify |
| **Backend** | Python App Proxy | Django / Flask / FastAPI |
| **Backend** | WebSocket Realtime | Socket.io / WS long connections |
| **CMS** | WordPress (PHP-FPM) | Blog sites, PHP handling |
| **CMS** | Laravel | PHP framework, pretty URLs |
| **HA** | Multi-Backend Load Balancing | Traffic distribution, failover |
| **HA** | Blue-Green Deployment | Zero-downtime releases |
| **Security** | HTTPS Best Practices | TLS 1.2+, HSTS, force redirect |
| **Security** | Rate Limiting | Anti-DDoS, API throttling |
| **Security** | Hide Sensitive Files | Block .git / .env access |

#### 4. Configuration Audit

Smart analysis of configurations, detecting potential issues with fix suggestions.

**Rule Categories:**

| Category | Example Rules | Severity |
|----------|--------------|----------|
| **Security** | Exposing Nginx version (`server_tokens on`) | 🔴 Critical |
| **Security** | Running as root user | 🔴 Critical |
| **Security** | Directory listing enabled (`autoindex on`) | 🔴 Critical |
| **Security** | Insecure SSL protocols (TLSv1/TLSv1.1) | 🔴 Critical |
| **Security** | HTTPS not enforced | 🟡 Warning |
| **Security** | Missing security headers (X-Frame-Options etc.) | 🟡 Warning |
| **Security** | Hidden files accessible | 🟡 Warning |
| **Performance** | Gzip not enabled | 🟡 Warning |
| **Performance** | Sendfile not enabled | 🟡 Warning |
| **Config** | Unused upstream exists | ℹ️ Info |

**Scoring System:**
- Maximum 100 points
- Critical issues: -15 points, Warnings: -8 points, Info: -3 points
- Grades: A (90+) / B (75+) / C (60+) / D (40+) / F (<40)

#### 5. One-Click Fix

Auto-fix detected issues:

- **Single Fix** - Click the fix button next to each issue
- **Fix All** - Batch fix all auto-fixable issues

**Fix Capabilities:**
- Auto-add `server_tokens off`
- Auto-correct `user` to `nginx`
- Auto-remove `autoindex on`
- Auto-upgrade SSL protocols to TLSv1.2+
- Auto-configure HTTP to HTTPS redirect (smart port conflict handling)
- Auto-add security response headers
- Auto-enable Gzip and Sendfile
- Auto-add hidden file access blocking rules

#### 6. Real-time Configuration Preview

The bottom preview panel generates complete `nginx.conf` configuration in real-time.

**Features:**
- Syntax highlighting
- One-click copy to clipboard
- Export as `.conf` file
- Export as `Dockerfile` (with complete deployment config)

#### 7. Configuration Import

Import existing Nginx configuration files for visual editing.

**Import Methods:**
- Paste configuration text
- Upload `.conf` file

**Parsing Capabilities:**
- Auto-detect `server`, `location`, `upstream` blocks
- Parse SSL configuration
- Parse load balancing configuration
- Preserve custom directives

#### 8. Traffic Simulator

Visualize request path matching to understand Location matching priority.

**Usage:**
1. Enter request path (e.g., `/api/users`)
2. See matched Location node highlighted
3. Understand priority: exact match > prefix match > regex match

#### 9. Multi-language Support

Complete Chinese and English interface switching, including:
- UI text
- Configuration descriptions
- Audit reports
- Template descriptions

---

### 🛠️ Tech Stack

- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Canvas Engine**: @xyflow/react (React Flow)
- **Layout Algorithm**: Dagre
- **State Management**: React Context

---

### 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/minecheney/nginx-flow-studio.git

# Navigate to project directory
cd nginx-flow-studio

# Install dependencies
npm install

# Start development server
npm run dev
```

---

### 📸 Interface Preview

| Feature | Description |
|---------|-------------|
| Visual Canvas | Drag nodes to build config |
| Property Editor | Detailed configuration forms |
| Config Audit | Issue detection & one-click fix |
| Template Library | Rich preset templates |
| Live Preview | Generated nginx.conf |

---

### 📄 License

MIT License
