import { createPlatform } from './platform.js';
import { loadConfig } from './config.js';
const config = loadConfig(process.env);
const platform = createPlatform({ config });
platform.httpServer.listen(config.port, config.host, () => { console.log('Secret Santa server ready'); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void platform.close().then(() => process.exit(0)); });

