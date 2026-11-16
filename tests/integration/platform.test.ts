import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createPlatform } from '../../src/platform.js';
import { loadConfig } from '../../src/config.js';
import { spawn } from 'node:child_process';
import { createServer as createPortReservation } from 'node:net';
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
  it('restart_loses_existing_group', async () => {
    const first = createPlatform({ config: loadConfig({}) });
    const group = first.groups.create(['Alice','Bob'], 'creator'); await first.close();
    const second = createPlatform({ config: loadConfig({}) }); platforms.push(second);
    expect(() => second.groups.get(group.code,'creator')).toThrow(expect.objectContaining({ code: 'GROUP_UNAVAILABLE' }));
  });
  it('production_build_serves_html_assets_and_shuts_down', async () => {
    const reservation = createPortReservation();
    await new Promise<void>(resolve => reservation.listen(0,'127.0.0.1',() => resolve()));
    const address = reservation.address(); if (!address || typeof address === 'string') throw new Error('Missing port');
    const port = address.port; await new Promise<void>(resolve => reservation.close(() => resolve()));
    const child = spawn(process.execPath, ['dist/main.js'], { windowsHide: true, stdio: ['ignore','ignore','pipe'], env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://santa.example.com' } });
    const exit = new Promise<void>((resolve,reject) => { child.once('error',reject); child.once('exit',() => resolve()); });
    const url = 'http://127.0.0.1:' + port;
    try {
      await expect.poll(async () => { try { return (await fetch(url + '/healthz')).status; } catch { return 0; } }, { timeout: 5000, interval: 50 }).toBe(200);
      const home = await fetch(url); expect(await home.text()).toContain('Who’s joining?');
      expect((await fetch(url + '/assets/group.js')).status).toBe(200);
      expect((await fetch(url + '/assets/styles.css')).status).toBe(200);
    } finally {
      child.kill('SIGTERM'); const timeout = setTimeout(() => child.kill('SIGKILL'), 2000);
      await exit; clearTimeout(timeout);
    }
    if (process.platform !== 'win32') expect(child.exitCode).toBe(0);
  });
});

