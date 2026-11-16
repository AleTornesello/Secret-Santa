import { afterEach, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createPlatform, loadConfig, httpGroup, type TestPlatform } from '../helpers/platform.js';
const platforms:TestPlatform[]=[];const sockets:Socket[]=[];
afterEach(async()=>{sockets.splice(0).forEach(s=>s.disconnect());await Promise.all(platforms.splice(0).map(p=>p.close()));});
async function setup(now?:()=>number){const p=createPlatform({config:loadConfig({}),now});platforms.push(p);await new Promise<void>(resolve=>p.httpServer.listen(0,'127.0.0.1',resolve));const address=p.httpServer.address();if(!address||typeof address==='string')throw new Error('No port');return {p,url:'http://127.0.0.1:'+address.port};}
async function client(url:string,cookie:string,transport='websocket',origin='http://127.0.0.1:3000'){
 const s=io(url,{transports:[transport],extraHeaders:{Cookie:cookie,Origin:origin},reconnection:false,timeout:1500});sockets.push(s);
 await new Promise<void>((resolve,reject)=>{s.once('connect',()=>resolve());s.once('connect_error',reject);});return s;
}
const subscribe=(s:Socket,code:string,csrfToken:string):Promise<any>=>s.timeout(1500).emitWithAck('group:subscribe',{code,csrfToken});
function next(s:Socket,event:string):Promise<any>{return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Missing '+event)),2000);s.once(event,p=>{clearTimeout(t);resolve(p);});});}
it.each(['websocket','polling'])('draw_delivers_only_own_result_and_reconnect_restores_it (%s)',async transport=>{
 const {p,url}=await setup();const g=await httpGroup(p);const clients:Socket[]=[];
 for(const [i,person]of g.people.entries()){await person.post(g.path+'/claim',{participantId:g.state.participants[i].id});const s=await client(url,person.cookie,transport);clients.push(s);const ack=await subscribe(s,g.state.code,person.csrfToken);expect(ack.ok).toBe(true);expect(ack.snapshot.selfId).toBe(g.state.participants[i].id);}
 const results=clients.map(s=>next(s,'participant:result'));await g.people[0].post(g.path+'/draw');const received=await Promise.all(results);
 expect(new Set(received.map(r=>r.recipient.id)).size).toBe(3);
 for(const [i,result]of received.entries()){expect(result.recipient.id).not.toBe(g.state.participants[i].id);expect(result).not.toHaveProperty('assignments');}
 clients[1].disconnect();const reconnect=await client(url,g.people[1].cookie,transport);const ack=await subscribe(reconnect,g.state.code,g.people[1].csrfToken);expect(ack.snapshot.recipient).toEqual(received[1].recipient);
});
it('rejects_invalid_session_origin_csrf_and_group_switches',async()=>{
 const {p,url}=await setup();const g=await httpGroup(p);
 await expect(client(url,'ss_session=forged')).rejects.toThrow();
 await expect(client(url,g.people[0].cookie,'websocket','https://attacker.test')).rejects.toThrow();
 const s=await client(url,g.people[0].cookie);expect((await subscribe(s,g.state.code,'forged')).ok).toBe(false);
 const ack=await subscribe(s,g.state.code,g.people[0].csrfToken);expect(ack.ok).toBe(true);expect(ack.snapshot.ready).toBe(false);
 const other=p.groups.create(['C','D'],g.people[0].sessionId);expect((await subscribe(s,other.code,g.people[0].csrfToken)).ok).toBe(false);
});
it('expiry_removes_subscriptions_and_revoked_tabs_never_receive_another_owners_result',async()=>{
 let now=0;const {p,url}=await setup(()=>now);const g=await httpGroup(p,['Alice','Bob']);const [creator,bob]=g.people;
 await bob.post(g.path+'/claim',{participantId:g.state.participants[1].id});const old=await client(url,bob.cookie);await subscribe(old,g.state.code,bob.csrfToken);
 const released=next(old,'participant:released');await creator.post(g.path+'/release',{participantId:g.state.participants[1].id});await released;
 const expired=next(old,'group:expired');now=3_600_000;p.groups.sweepExpired();expect((await expired).code).toBe(g.state.code);
 expect((await subscribe(old,g.state.code,bob.csrfToken)).ok).toBe(false);
});

