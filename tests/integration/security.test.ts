import { afterEach, expect, it } from 'vitest';
import request from 'supertest';
import { createPlatform, loadConfig, person, type TestPlatform } from '../helpers/platform.js';
const platforms:TestPlatform[]=[];afterEach(async()=>{await Promise.all(platforms.splice(0).map(p=>p.close()));});
function make(){const p=createPlatform({config:loadConfig({})});platforms.push(p);return p;}
it('rejects_forged_or_missing_csrf_and_cross_origin_mutations',async()=>{
 const p=make();const a=await person(p);
 for(const data of [{names:'Alice\nBob'},{names:'Alice\nBob',csrfToken:'fake'}])expect((await a.agent.post('/groups').set('Origin','http://127.0.0.1:3000').type('form').send(data)).status).toBe(403);
 expect((await a.agent.post('/groups').set('Origin','https://attacker.test').type('form').send({names:'Alice\nBob',csrfToken:a.csrfToken})).status).toBe(403);
});
it('sets_security_headers_without_leaking_internal_errors',async()=>{
 const p=make();const r=await request(p.httpServer).get('/');
 expect(r.headers['content-security-policy']).toContain("default-src 'self'");
 expect(r.headers['x-frame-options']).toBe('DENY');expect(r.headers['referrer-policy']).toBe('same-origin');
 const a=await person(p);const bad=await a.post('/groups',{names:'A'});expect(bad.text).not.toMatch(/stack|node_modules|TypeError/);
});
it('rejects_oversized_http_bodies',async()=>{const p=make();const a=await person(p);expect((await a.post('/groups',{names:'x'.repeat(70000)})).status).toBe(413);});
it('maximum_valid_unicode_roster_fits_form_body',async()=>{
 const p=make();const a=await person(p);const names=Array.from({length:50},(_,i)=>String(i).padStart(2,'0')+'🎁'.repeat(78));expect((await a.post('/groups',{names:names.join('\n')})).status).toBe(303);
});

