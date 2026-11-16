import { afterEach, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createPlatform, loadConfig, httpGroup, type TestPlatform } from '../helpers/platform.js';
const platforms:TestPlatform[]=[];const sockets:Socket[]=[];
afterEach(async()=>{sockets.splice(0).forEach(s=>s.disconnect());await Promise.all(platforms.splice(0).map(p=>p.close()));});
async function setup(now?:()=>number,env:NodeJS.ProcessEnv={}){const p=createPlatform({config:loadConfig(env),now});platforms.push(p);await new Promise<void>(resolve=>p.httpServer.listen(0,'127.0.0.1',resolve));const address=p.httpServer.address();if(!address||typeof address==='string')throw new Error('No port');return {p,url:'http://127.0.0.1:'+address.port};}
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
it.each(['websocket','polling'])('rejects_cross_origin_connections (%s)',async transport=>{
 const {p,url}=await setup();const g=await httpGroup(p);await expect(client(url,g.people[0].cookie,transport,'https://attacker.test')).rejects.toThrow();
});
it('caps_subscription_attempts_and_rejects_malformed_payloads',async()=>{
 const {p,url}=await setup();const g=await httpGroup(p);const a=g.people[0];const s=await client(url,a.cookie);
 const bad=await s.timeout(1500).emitWithAck('group:subscribe',{code:[]});expect(bad.ok).toBe(false);
 for(let i=0;i<29;i++)expect((await subscribe(s,g.state.code,a.csrfToken)).ok).toBe(true);
 expect(await subscribe(s,g.state.code,a.csrfToken)).toEqual({ok:false,error:'CAPACITY_REACHED'});
});
it('caps_connections_and_frees_capacity_after_disconnect',async()=>{
 const {p,url}=await setup(undefined,{MAX_SOCKETS:'3',MAX_SOCKETS_PER_SESSION:'2'});const g=await httpGroup(p);const [a,b]=g.people;
 const first=await client(url,a.cookie);await client(url,a.cookie);
 await expect(client(url,a.cookie)).rejects.toThrow();
 await client(url,b.cookie).catch(e=>{throw new Error('First second-session connection: '+e.message);});await expect(client(url,b.cookie)).rejects.toThrow();
 await subscribe(first,g.state.code,a.csrfToken);
 const closed=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not report the disconnected subscription')),2000);const off=p.groups.onChange(()=>{off();clearTimeout(timer);resolve();});});
 first.disconnect();await closed;
 let replacement:Socket|undefined;
 await expect.poll(async()=>{try{replacement=await client(url,b.cookie);return true;}catch{return false;}},{timeout:3000,interval:25}).toBe(true);
 expect(replacement?.connected).toBe(true);
});
it('oversized_socket_messages_close_the_connection',async()=>{
 const {p,url}=await setup();const g=await httpGroup(p);const s=await client(url,g.people[0].cookie);
 const disconnected=next(s,'disconnect');s.emit('group:subscribe',{code:'x'.repeat(5000),csrfToken:g.people[0].csrfToken});await disconnected;expect(s.connected).toBe(false);
});
it('another_tab_receives_private_identity_changes_without_resubscribing',async()=>{
 const {p,url}=await setup();const g=await httpGroup(p);const a=g.people[0];const s=await client(url,a.cookie);
 await subscribe(s,g.state.code,a.csrfToken);const identity=next(s,'participant:identity');
 await a.post(g.path+'/claim',{participantId:g.state.participants[0].id});
 expect(await identity).toMatchObject({code:g.state.code,selfId:g.state.participants[0].id,isCreator:true});
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

