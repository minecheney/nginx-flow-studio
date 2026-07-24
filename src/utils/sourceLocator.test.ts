import { describe, expect, it } from 'vitest';
import { parseNginxConfig } from '@/utils/nginxParser';
import { findNodeSourceRange } from '@/utils/sourceLocator';

const source = `worker_processes auto;

events {
    worker_connections 1024;
}

http {
    upstream api_cluster {
        server 127.0.0.1:9001;
    }

    server {
        listen 80;
        server_name example.com;

        location /api/ {
            proxy_pass http://api_cluster;
        }

        location ~* ^/files/[0-9]{2}.+\\.txt$ {
            try_files $uri =404;
        }
    }
}

stream {
    upstream socket_proxy {
        hash $remote_addr consistent;
        server 172.16.0.16:15676;
    }

    server {
        listen 15675;
        proxy_pass socket_proxy;
    }
}
`;

describe('source node locator', () => {
  it('locates HTTP server, location and upstream blocks', () => {
    const config = parseNginxConfig(source);
    const server = findNodeSourceRange(source, config, config.servers[0].id, 'server');
    const location = findNodeSourceRange(source, config, config.locations[1].id, 'location');
    const upstream = findNodeSourceRange(source, config, config.upstreams[0].id, 'upstream');

    expect(source.slice(server!.from, server!.to)).toContain('server_name example.com;');
    expect(source.slice(location!.from, location!.to)).toContain('location ~* ^/files/[0-9]{2}');
    expect(source.slice(upstream!.from, upstream!.to)).toContain('upstream api_cluster');
  });

  it('locates Stream listener and upstream blocks', () => {
    const config = parseNginxConfig(source);
    const listener = findNodeSourceRange(
      source,
      config,
      config.stream.servers[0].id,
      'stream-server',
    );
    const upstream = findNodeSourceRange(
      source,
      config,
      config.stream.upstreams[0].id,
      'stream-upstream',
    );

    expect(source.slice(listener!.from, listener!.to)).toContain('listen 15675;');
    expect(source.slice(upstream!.from, upstream!.to)).toContain('upstream socket_proxy');
  });
});
