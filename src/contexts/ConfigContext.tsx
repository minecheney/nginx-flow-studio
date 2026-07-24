import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  NginxConfig,
  ServerConfig,
  LocationConfig,
  UpstreamConfig,
  StreamServerConfig,
  StreamUpstreamConfig,
  GlobalConfig,
  EventsConfig,
  HttpConfig,
  defaultNginxConfig,
  createDefaultServer,
  createDefaultLocation,
  createDefaultUpstream,
  createDefaultStreamServer,
  createDefaultStreamUpstream,
} from '@/types/nginx';
import { parseNginxConfig } from '@/utils/nginxParser';
import { mergeNginxConfigSource } from '@/utils/sourceMerge';

export interface ConfigFile {
  id: string;
  name: string;
  config: NginxConfig;
  updatedAt: string;
}

export type ConfigNodeType = 'server' | 'location' | 'upstream' | 'stream-server' | 'stream-upstream';

interface ConfigContextType {
  config: NginxConfig;
  files: ConfigFile[];
  activeFile: ConfigFile;
  activeFileId: string;
  selectedNodeId: string | null;
  selectedNodeType: ConfigNodeType | null;
  sourceFocusVersion: number;

  selectNode: (id: string | null, type: ConfigNodeType | null) => void;

  importConfig: (newConfig: NginxConfig) => void;
  addConfigFile: (name: string, newConfig: NginxConfig) => string;
  createConfigFile: () => string;
  duplicateConfigFile: (id: string) => string;
  renameConfigFile: (id: string, name: string) => void;
  deleteConfigFile: (id: string) => void;
  setActiveFileId: (id: string) => void;
  applySource: (source: string) => void;

  updateGlobal: (updates: Partial<GlobalConfig>) => void;
  updateEvents: (updates: Partial<EventsConfig>) => void;
  updateHttp: (updates: Partial<HttpConfig>) => void;

  addServer: () => ServerConfig;
  updateServer: (id: string, updates: Partial<ServerConfig>) => void;
  deleteServer: (id: string) => void;

  addLocation: (serverId: string) => LocationConfig;
  updateLocation: (id: string, updates: Partial<LocationConfig>) => void;
  deleteLocation: (id: string) => void;

  addUpstream: () => UpstreamConfig;
  updateUpstream: (id: string, updates: Partial<UpstreamConfig>) => void;
  deleteUpstream: (id: string) => void;

  addStreamUpstream: () => StreamUpstreamConfig;
  updateStreamUpstream: (id: string, updates: Partial<StreamUpstreamConfig>) => void;
  deleteStreamUpstream: (id: string) => void;
  addStreamServer: () => StreamServerConfig;
  updateStreamServer: (id: string, updates: Partial<StreamServerConfig>) => void;
  deleteStreamServer: (id: string) => void;

  getServerById: (id: string) => ServerConfig | undefined;
  getLocationById: (id: string) => LocationConfig | undefined;
  getUpstreamById: (id: string) => UpstreamConfig | undefined;
  getStreamUpstreamById: (id: string) => StreamUpstreamConfig | undefined;
  getStreamServerById: (id: string) => StreamServerConfig | undefined;
  getLocationsByServerId: (serverId: string) => LocationConfig[];
}

const ConfigContext = createContext<ConfigContextType | null>(null);
const STORAGE_KEY = 'nginx-flow-workspace-v1';
const DEFAULT_MODULE_INCLUDE = 'include /usr/share/nginx/modules/*.conf;';

const cloneDefaultConfig = () => structuredClone(defaultNginxConfig);
const migrateGeneratedConfigDefaults = (config: NginxConfig): NginxConfig => {
  let migrated = config;
  if (!migrated.stream) {
    if (migrated.rawConfig) {
      try {
        migrated = parseNginxConfig(migrated.rawConfig);
      } catch {
        migrated = {
          ...migrated,
          stream: { upstreams: [], servers: [], customDirectives: '' },
        };
      }
    } else {
      migrated = {
        ...migrated,
        stream: { upstreams: [], servers: [], customDirectives: '' },
      };
    }
  }
  if (migrated.rawConfig || migrated.global.customDirectives.trim()) return migrated;
  return {
    ...migrated,
    global: {
      ...migrated.global,
      customDirectives: DEFAULT_MODULE_INCLUDE,
    },
  };
};
const normalizeFilename = (name: string) => {
  const trimmed = name.trim() || 'nginx.conf';
  return /\.conf$/i.test(trimmed) ? trimmed : `${trimmed}.conf`;
};

const createFile = (name = 'nginx.conf', config = cloneDefaultConfig()): ConfigFile => ({
  id: crypto.randomUUID(),
  name: normalizeFilename(name),
  config,
  updatedAt: new Date().toISOString(),
});

const loadWorkspace = (): { files: ConfigFile[]; activeFileId: string } => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { files?: ConfigFile[]; activeFileId?: string };
      if (parsed.files?.length) {
        const files = parsed.files.map((file) => ({
          ...file,
          config: migrateGeneratedConfigDefaults(file.config),
        }));
        const activeFileId = parsed.files.some((file) => file.id === parsed.activeFileId)
          ? parsed.activeFileId!
          : files[0].id;
        return { files, activeFileId };
      }
    }
  } catch {
    // Ignore invalid browser storage and start with a clean workspace.
  }
  const file = createFile();
  return { files: [file], activeFileId: file.id };
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
};

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [initialWorkspace] = useState(loadWorkspace);
  const [files, setFiles] = useState<ConfigFile[]>(initialWorkspace.files);
  const [activeFileId, setActiveFileIdState] = useState(initialWorkspace.activeFileId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<ConfigNodeType | null>(null);
  const [sourceFocusVersion, setSourceFocusVersion] = useState(0);

  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const config = activeFile.config;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, activeFileId }));
  }, [files, activeFileId]);

  const selectNode = useCallback((id: string | null, type: ConfigNodeType | null) => {
    setSelectedNodeId(id);
    setSelectedNodeType(type);
    if (id && type) setSourceFocusVersion((version) => version + 1);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(null);
  }, []);

  const setActiveFileId = useCallback((id: string) => {
    setActiveFileIdState(id);
    resetSelection();
  }, [resetSelection]);

  const updateActiveConfig = useCallback((updater: (previous: NginxConfig) => NginxConfig) => {
    setFiles((currentFiles) => currentFiles.map((file) => {
      if (file.id !== activeFileId) return file;
      const before = file.config;
      const next = updater(before);
      if (before.rawConfig) {
        next.rawConfig = mergeNginxConfigSource(before.rawConfig, before, next);
      }
      return { ...file, config: next, updatedAt: new Date().toISOString() };
    }));
  }, [activeFileId]);

  const importConfig = useCallback((newConfig: NginxConfig) => {
    setFiles((currentFiles) => currentFiles.map((file) => (
      file.id === activeFileId
        ? { ...file, config: newConfig, updatedAt: new Date().toISOString() }
        : file
    )));
    resetSelection();
  }, [activeFileId, resetSelection]);

  const uniqueFilename = useCallback((requested: string, currentFiles: ConfigFile[]) => {
    const normalized = normalizeFilename(requested);
    const dotAt = normalized.toLowerCase().lastIndexOf('.conf');
    const base = normalized.slice(0, dotAt);
    let candidate = normalized;
    let suffix = 2;
    while (currentFiles.some((file) => file.name.toLowerCase() === candidate.toLowerCase())) {
      candidate = `${base}-${suffix}.conf`;
      suffix += 1;
    }
    return candidate;
  }, []);

  const addConfigFile = useCallback((name: string, newConfig: NginxConfig) => {
    const id = crypto.randomUUID();
    setFiles((currentFiles) => [
      ...currentFiles,
      {
        id,
        name: uniqueFilename(name, currentFiles),
        config: newConfig,
        updatedAt: new Date().toISOString(),
      },
    ]);
    setActiveFileIdState(id);
    resetSelection();
    return id;
  }, [resetSelection, uniqueFilename]);

  const createConfigFile = useCallback(() => {
    const id = crypto.randomUUID();
    setFiles((currentFiles) => [
      ...currentFiles,
      {
        id,
        name: uniqueFilename('nginx.conf', currentFiles),
        config: cloneDefaultConfig(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    setActiveFileIdState(id);
    resetSelection();
    return id;
  }, [resetSelection, uniqueFilename]);

  const duplicateConfigFile = useCallback((id: string) => {
    const newId = crypto.randomUUID();
    setFiles((currentFiles) => {
      const source = currentFiles.find((file) => file.id === id) ?? currentFiles[0];
      const basename = source.name.replace(/\.conf$/i, '');
      return [
        ...currentFiles,
        {
          ...structuredClone(source),
          id: newId,
          name: uniqueFilename(`${basename}-copy.conf`, currentFiles),
          updatedAt: new Date().toISOString(),
        },
      ];
    });
    setActiveFileIdState(newId);
    resetSelection();
    return newId;
  }, [resetSelection, uniqueFilename]);

  const renameConfigFile = useCallback((id: string, name: string) => {
    setFiles((currentFiles) => currentFiles.map((file) => (
      file.id === id ? { ...file, name, updatedAt: new Date().toISOString() } : file
    )));
  }, []);

  const deleteConfigFile = useCallback((id: string) => {
    setFiles((currentFiles) => {
      if (currentFiles.length === 1) {
        const replacement = createFile();
        setActiveFileIdState(replacement.id);
        return [replacement];
      }
      const index = currentFiles.findIndex((file) => file.id === id);
      const nextFiles = currentFiles.filter((file) => file.id !== id);
      if (id === activeFileId) {
        setActiveFileIdState(nextFiles[Math.max(0, index - 1)]?.id ?? nextFiles[0].id);
      }
      return nextFiles;
    });
    resetSelection();
  }, [activeFileId, resetSelection]);

  const applySource = useCallback((source: string) => {
    const parsed = parseNginxConfig(source);
    parsed.rawConfig = source;
    importConfig(parsed);
  }, [importConfig]);

  const updateGlobal = useCallback((updates: Partial<GlobalConfig>) => {
    updateActiveConfig((previous) => ({ ...previous, global: { ...previous.global, ...updates } }));
  }, [updateActiveConfig]);

  const updateEvents = useCallback((updates: Partial<EventsConfig>) => {
    updateActiveConfig((previous) => ({ ...previous, events: { ...previous.events, ...updates } }));
  }, [updateActiveConfig]);

  const updateHttp = useCallback((updates: Partial<HttpConfig>) => {
    updateActiveConfig((previous) => ({ ...previous, http: { ...previous.http, ...updates } }));
  }, [updateActiveConfig]);

  const addServer = useCallback(() => {
    const newServer = createDefaultServer();
    updateActiveConfig((previous) => ({ ...previous, servers: [...previous.servers, newServer] }));
    return newServer;
  }, [updateActiveConfig]);

  const updateServer = useCallback((id: string, updates: Partial<ServerConfig>) => {
    updateActiveConfig((previous) => ({
      ...previous,
      servers: previous.servers.map((server) => server.id === id ? { ...server, ...updates } : server),
    }));
  }, [updateActiveConfig]);

  const deleteServer = useCallback((id: string) => {
    updateActiveConfig((previous) => ({
      ...previous,
      servers: previous.servers.filter((server) => server.id !== id),
      locations: previous.locations.filter((location) => location.serverId !== id),
    }));
    if (selectedNodeId === id) resetSelection();
  }, [resetSelection, selectedNodeId, updateActiveConfig]);

  const addLocation = useCallback((serverId: string) => {
    const newLocation = createDefaultLocation(serverId);
    updateActiveConfig((previous) => ({ ...previous, locations: [...previous.locations, newLocation] }));
    return newLocation;
  }, [updateActiveConfig]);

  const updateLocation = useCallback((id: string, updates: Partial<LocationConfig>) => {
    updateActiveConfig((previous) => ({
      ...previous,
      locations: previous.locations.map((location) => location.id === id ? { ...location, ...updates } : location),
    }));
  }, [updateActiveConfig]);

  const deleteLocation = useCallback((id: string) => {
    updateActiveConfig((previous) => ({
      ...previous,
      locations: previous.locations.filter((location) => location.id !== id),
    }));
    if (selectedNodeId === id) resetSelection();
  }, [resetSelection, selectedNodeId, updateActiveConfig]);

  const addUpstream = useCallback(() => {
    const newUpstream = createDefaultUpstream();
    updateActiveConfig((previous) => ({ ...previous, upstreams: [...previous.upstreams, newUpstream] }));
    return newUpstream;
  }, [updateActiveConfig]);

  const updateUpstream = useCallback((id: string, updates: Partial<UpstreamConfig>) => {
    updateActiveConfig((previous) => ({
      ...previous,
      upstreams: previous.upstreams.map((upstream) => upstream.id === id ? { ...upstream, ...updates } : upstream),
    }));
  }, [updateActiveConfig]);

  const deleteUpstream = useCallback((id: string) => {
    updateActiveConfig((previous) => ({
      ...previous,
      upstreams: previous.upstreams.filter((upstream) => upstream.id !== id),
      locations: previous.locations.map((location) => (
        location.upstreamId === id ? { ...location, upstreamId: null, proxyPass: '' } : location
      )),
    }));
    if (selectedNodeId === id) resetSelection();
  }, [resetSelection, selectedNodeId, updateActiveConfig]);

  const addStreamUpstream = useCallback(() => {
    const newUpstream = createDefaultStreamUpstream();
    updateActiveConfig((previous) => ({
      ...previous,
      stream: {
        ...previous.stream,
        upstreams: [...previous.stream.upstreams, newUpstream],
      },
    }));
    return newUpstream;
  }, [updateActiveConfig]);

  const updateStreamUpstream = useCallback((id: string, updates: Partial<StreamUpstreamConfig>) => {
    updateActiveConfig((previous) => {
      const current = previous.stream.upstreams.find((upstream) => upstream.id === id);
      const nextName = updates.name ?? current?.name;
      return {
        ...previous,
        stream: {
          ...previous.stream,
          upstreams: previous.stream.upstreams.map((upstream) => (
            upstream.id === id ? { ...upstream, ...updates } : upstream
          )),
          servers: current && nextName && nextName !== current.name
            ? previous.stream.servers.map((server) => (
              server.proxyPass === current.name ? { ...server, proxyPass: nextName } : server
            ))
            : previous.stream.servers,
        },
      };
    });
  }, [updateActiveConfig]);

  const deleteStreamUpstream = useCallback((id: string) => {
    updateActiveConfig((previous) => {
      const removed = previous.stream.upstreams.find((upstream) => upstream.id === id);
      return {
        ...previous,
        stream: {
          ...previous.stream,
          upstreams: previous.stream.upstreams.filter((upstream) => upstream.id !== id),
          servers: previous.stream.servers.map((server) => (
            removed && server.proxyPass === removed.name ? { ...server, proxyPass: '' } : server
          )),
        },
      };
    });
    if (selectedNodeId === id) resetSelection();
  }, [resetSelection, selectedNodeId, updateActiveConfig]);

  const addStreamServer = useCallback(() => {
    const newServer = createDefaultStreamServer(config.stream.upstreams[0]?.name ?? '');
    updateActiveConfig((previous) => ({
      ...previous,
      stream: {
        ...previous.stream,
        servers: [...previous.stream.servers, newServer],
      },
    }));
    return newServer;
  }, [config.stream.upstreams, updateActiveConfig]);

  const updateStreamServer = useCallback((id: string, updates: Partial<StreamServerConfig>) => {
    updateActiveConfig((previous) => ({
      ...previous,
      stream: {
        ...previous.stream,
        servers: previous.stream.servers.map((server) => (
          server.id === id ? { ...server, ...updates } : server
        )),
      },
    }));
  }, [updateActiveConfig]);

  const deleteStreamServer = useCallback((id: string) => {
    updateActiveConfig((previous) => ({
      ...previous,
      stream: {
        ...previous.stream,
        servers: previous.stream.servers.filter((server) => server.id !== id),
      },
    }));
    if (selectedNodeId === id) resetSelection();
  }, [resetSelection, selectedNodeId, updateActiveConfig]);

  const getServerById = useCallback((id: string) => config.servers.find((server) => server.id === id), [config.servers]);
  const getLocationById = useCallback((id: string) => config.locations.find((location) => location.id === id), [config.locations]);
  const getUpstreamById = useCallback((id: string) => config.upstreams.find((upstream) => upstream.id === id), [config.upstreams]);
  const getStreamUpstreamById = useCallback(
    (id: string) => config.stream.upstreams.find((upstream) => upstream.id === id),
    [config.stream.upstreams],
  );
  const getStreamServerById = useCallback(
    (id: string) => config.stream.servers.find((server) => server.id === id),
    [config.stream.servers],
  );
  const getLocationsByServerId = useCallback(
    (serverId: string) => config.locations.filter((location) => location.serverId === serverId),
    [config.locations],
  );

  const value = useMemo<ConfigContextType>(() => ({
    config,
    files,
    activeFile,
    activeFileId,
    selectedNodeId,
    selectedNodeType,
    sourceFocusVersion,
    selectNode,
    importConfig,
    addConfigFile,
    createConfigFile,
    duplicateConfigFile,
    renameConfigFile,
    deleteConfigFile,
    setActiveFileId,
    applySource,
    updateGlobal,
    updateEvents,
    updateHttp,
    addServer,
    updateServer,
    deleteServer,
    addLocation,
    updateLocation,
    deleteLocation,
    addUpstream,
    updateUpstream,
    deleteUpstream,
    addStreamUpstream,
    updateStreamUpstream,
    deleteStreamUpstream,
    addStreamServer,
    updateStreamServer,
    deleteStreamServer,
    getServerById,
    getLocationById,
    getUpstreamById,
    getStreamUpstreamById,
    getStreamServerById,
    getLocationsByServerId,
  }), [
    activeFile,
    activeFileId,
    addConfigFile,
    addLocation,
    addServer,
    addStreamServer,
    addStreamUpstream,
    addUpstream,
    applySource,
    config,
    createConfigFile,
    deleteConfigFile,
    deleteLocation,
    deleteServer,
    deleteStreamServer,
    deleteStreamUpstream,
    deleteUpstream,
    duplicateConfigFile,
    files,
    getLocationById,
    getLocationsByServerId,
    getServerById,
    getStreamServerById,
    getStreamUpstreamById,
    getUpstreamById,
    importConfig,
    renameConfigFile,
    selectNode,
    selectedNodeId,
    selectedNodeType,
    sourceFocusVersion,
    setActiveFileId,
    updateEvents,
    updateGlobal,
    updateHttp,
    updateLocation,
    updateServer,
    updateStreamServer,
    updateStreamUpstream,
    updateUpstream,
  ]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
