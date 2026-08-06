import { describe, expect, it } from 'vitest';
import { preserveVisualNodeIds } from '@/utils/configIdentity';
import { parseNginxConfig } from '@/utils/nginxParser';

const beforeSource = `http {
    upstream backend {
        server 127.0.0.1:9000;
    }
    server {
        listen 80;
        server_name old.example.com;
        location /old/ {
            proxy_pass http://backend;
        }
    }
}
`;

const editedSource = `http {
    upstream api_cluster {
        server 127.0.0.1:9001;
    }
    server {
        listen 443 ssl;
        server_name new.example.com;
        location /new/ {
            proxy_pass http://api_cluster;
        }
    }
}
`;

describe('source-to-canvas identity reconciliation', () => {
  it('keeps existing node IDs while applying edited source values', () => {
    const before = parseNginxConfig(beforeSource);
    const parsed = parseNginxConfig(editedSource);
    const reconciled = preserveVisualNodeIds(before, parsed);

    expect(reconciled.servers[0].id).toBe(before.servers[0].id);
    expect(reconciled.servers[0]).toMatchObject({
      serverName: 'new.example.com',
      listen: expect.objectContaining({ port: 443 }),
      ssl: expect.objectContaining({ enabled: true }),
    });
    expect(reconciled.upstreams[0].id).toBe(before.upstreams[0].id);
    expect(reconciled.upstreams[0].name).toBe('api_cluster');
    expect(reconciled.locations[0].id).toBe(before.locations[0].id);
    expect(reconciled.locations[0].serverId).toBe(before.servers[0].id);
    expect(reconciled.locations[0].upstreamId).toBe(before.upstreams[0].id);
    expect(reconciled.locations[0].path).toBe('/new/');
  });
});
