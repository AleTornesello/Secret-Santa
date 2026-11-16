import { afterEach, expect, it } from 'vitest';
import { createPlatform, loadConfig, person, bootstrap, type TestPlatform } from '../helpers/platform.js';
import { createRateStore } from '../../src/http/rate-store.js';
const platforms:TestPlatform[]=[];afterEach(async()=>{await Promise.all(platforms.splice(0).map(p=>p.close()));});
function make(env:NodeJS.ProcessEnv={},now=Date.now){const p=createPlatform({config:loadConfig(env),now});platforms.push(p);return p;}
it('caps_groups_and_memberships_without_orphaned_groups',async()=>{
 const p=make({MAX_GROUPS:'2',MAX_MEMBERSHIPS_PER_SESSION:'1'});const a=await person(p);
 const first=await a.post('/groups',{names:'Alice\nBob'});expect(first.status).toBe(303);
 expect((await a.post('/groups',{names:'Carol\nDan'})).status).toBe(429);
 const b=await person(p);expect((await b.post('/groups',{names:'Carol\nDan'})).status).toBe(303);
 const c=await person(p);expect((await c.post('/groups',{names:'Eve\nFinn'})).status).toBe(429);
 expect(bootstrap((await a.agent.get(first.headers.location)).text).participants[0].name).toBe('Alice');
});
it('http_creation_rate_limit_expires',async()=>{
 let now=Date.now();const p=make({MAX_MEMBERSHIPS_PER_SESSION:'20'},()=>now);const a=await person(p);
 for(let i=0;i<10;i++)expect((await a.post('/groups',{names:'Alice\nBob'})).status).toBe(303);
 expect((await a.post('/groups',{names:'Alice\nBob'})).status).toBe(429);
 now+=600001;expect((await a.post('/groups',{names:'Alice\nBob'})).status).toBe(303);
 const b=await person(p);expect((await b.post('/groups',{names:'Alice\nBob'})).status).toBe(303);
});
it('rate_limit_counters_expire_and_distinct_keys_are_capped',()=>{
 let now=0;const store=createRateStore({now:()=>now,maxKeys:1,windowMs:100});
 try {expect(store.increment('first').totalHits).toBe(1);expect(()=>store.increment('second')).toThrow(expect.objectContaining({code:'CAPACITY_REACHED'}));now=100;expect(store.increment('second').totalHits).toBe(1);}finally{store.shutdown();}
});

