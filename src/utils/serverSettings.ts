import type { ServerConfig } from '@/types/nginx';

export const getSslToggleUpdate = (
  server: ServerConfig,
  enabled: boolean,
): Pick<ServerConfig, 'listen' | 'ssl'> => ({
  listen: {
    ...server.listen,
    port: enabled && server.listen.port === 80 ? 443 : server.listen.port,
  },
  ssl: {
    ...server.ssl,
    enabled,
  },
});
