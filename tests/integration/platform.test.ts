import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createPlatform } from '../../src/platform.js';
import { loadConfig } from '../../src/config.js';
const platforms: ReturnType<typeof createPlatform>[] = [];
afterEach(async () => { await Promise.all(platforms.splice(0).map(p => p.close())); });
describe('platform', () => {
  it('health_is_available_without_creating_a_session', async () => {
    const platform = createPlatform({ config: loadConfig({}) }); platforms.push(platform);
    const response = await request(platform.httpServer).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['set-cookie']).toBeUndefined();
  });
  it('production_requires_an_https_public_origin', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() => loadConfig({ NODE_ENV: 'production', PUBLIC_ORIGIN: 'http://example.com' })).toThrow();
    expect(loadConfig({ NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://example.com' }).publicOrigin).toBe('https://example.com');
  });
});

