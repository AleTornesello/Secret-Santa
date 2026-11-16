import { test as base, expect } from '@playwright/test';
import { createPlatform } from '../../src/platform.js';
import { loadConfig } from '../../src/config.js';
type Platform = ReturnType<typeof createPlatform>;
export const test = base.extend<{ platform: Platform; clock: { value: number }; advanceServerTime: (ms: number) => void }>({
 clock: async ({}, use) => { await use({value: Date.now()}); },
 platform: async ({ clock }, use) => {
   const config = loadConfig({});
   const platform = createPlatform({config, now: () => clock.value});
   await new Promise<void>(resolve=>platform.httpServer.listen(0,'127.0.0.1',()=>resolve()));
   const address=platform.httpServer.address();if(!address||typeof address==='string')throw new Error('Missing address');
   config.publicOrigin='http://127.0.0.1:'+address.port;
   try{await use(platform);}finally{await platform.close();}
 },
 baseURL: async ({platform},use)=>{const address=platform.httpServer.address();if(!address||typeof address==='string')throw new Error('Missing address');await use('http://127.0.0.1:'+address.port);},
 advanceServerTime:async({clock,platform},use)=>{await use(ms=>{clock.value+=ms;platform.groups.sweepExpired();platform.sessions.sweepExpired();});},
});
export { expect };

