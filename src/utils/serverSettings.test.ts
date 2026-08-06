import { describe, expect, it } from 'vitest';
import { parseNginxConfig } from '@/utils/nginxParser';
import { getSslToggleUpdate } from '@/utils/serverSettings';

const serverAt = (port: number) => parseNginxConfig(`http {
    server {
        listen ${port};
        server_name example.test;
    }
}
`).servers[0];

describe('SSL server settings', () => {
  it('moves the standard HTTP port to 443 when SSL is enabled', () => {
    const update = getSslToggleUpdate(serverAt(80), true);
    expect(update.listen.port).toBe(443);
    expect(update.ssl.enabled).toBe(true);
  });

  it('does not overwrite a custom listener port', () => {
    const update = getSslToggleUpdate(serverAt(8443), true);
    expect(update.listen.port).toBe(8443);
  });

  it('does not rewrite the listener when SSL is disabled', () => {
    const update = getSslToggleUpdate(serverAt(443), false);
    expect(update.listen.port).toBe(443);
    expect(update.ssl.enabled).toBe(false);
  });
});
