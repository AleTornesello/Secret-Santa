import request from 'supertest';
import { createPlatform } from '../../src/platform.js';
import { loadConfig } from '../../src/config.js';
import type { SessionGroupState } from '../../src/groups/types.js';
export { createPlatform, loadConfig };
export function bootstrap(html:string):SessionGroupState { const match=html.match(/<script id="group-data" type="application\/json">([\s\S]*?)<\/script>/);if(!match)throw new Error('Missing bootstrap');return JSON.parse(match[1]);}
export function csrf(html:string):string { const m=html.match(/name="csrfToken" value="([^"]+)"/);if(!m)throw new Error('Missing CSRF');return m[1];}
export type TestPlatform=ReturnType<typeof createPlatform>;
export async function person(platform:TestPlatform,path='/') {
 const agent=request.agent(platform.httpServer);const response=await agent.get(path);
 const cookie=(response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
 const sessionId=cookie.split('=')[1];const csrfToken=csrf(response.text);
 return {agent,cookie,sessionId,csrfToken,post:(route:string,data:Record<string,string>={})=>agent.post(route).set('Origin','http://127.0.0.1:3000').type('form').send({csrfToken,...data})};
}
export async function httpGroup(platform:TestPlatform,names=['Alice','Bob','Carol']) {
 const creator=await person(platform);const created=await creator.post('/groups',{names:names.join('\n')});if(created.status!==303)throw new Error('Creation failed: '+created.status);
 const path=created.headers.location;const view=await creator.agent.get(path);const state=bootstrap(view.text);
 const people=[creator];for(let i=1;i<names.length;i++)people.push(await person(platform,path));
 return {path,state,people};
}

