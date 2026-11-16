import { afterEach, expect, it } from 'vitest';
import { createGroupService } from '../../src/groups/service.js';
import { readyGroup } from '../helpers/groups.js';
const services: ReturnType<typeof createGroupService>[]=[];
afterEach(()=>services.splice(0).forEach(s=>s.close()));
function make(options: Partial<Parameters<typeof createGroupService>[0]> = {}) {const s=createGroupService({now:Date.now,maxGroups:10,...options});services.push(s);return s;}
it('draw_requires_creator_and_all_connected_claims',()=>{
 const s=make();const g=s.create(['Alice','Bob'],'creator');
 expect(()=>s.draw(g.code,'stranger')).toThrow(expect.objectContaining({code:'FORBIDDEN'}));
 expect(()=>s.draw(g.code,'creator')).toThrow(expect.objectContaining({code:'NOT_READY'}));
});
it('creator_without_claim_cannot_draw',()=>{
 const s=make();const g=readyGroup(s);s.release(g.code,g.sessions[0],g.ids[0]);s.claim(g.code,'outsider',g.ids[0]);s.connect(g.code,'outsider','outsider');
 expect(()=>s.draw(g.code,g.sessions[0])).toThrow(expect.objectContaining({code:'NOT_READY'}));
});
it('repeated_draw_returns_same_result_and_private_snapshots',()=>{
 const s=make();const g=readyGroup(s);s.draw(g.code,g.sessions[0]);
 const initial=g.sessions.map(session=>s.get(g.code,session).recipient);
 for(let i=0;i<10;i++)s.draw(g.code,g.sessions[0]);
 expect(g.sessions.map(session=>s.get(g.code,session).recipient)).toEqual(initial);
 expect(s.get(g.code,'stranger').recipient).toBeNull();
 expect(()=>s.draw(g.code,'stranger')).toThrow(expect.objectContaining({code:'FORBIDDEN'}));
 const copy=s.get(g.code,g.sessions[0]);copy.recipient!.name='hacked';expect(s.get(g.code,g.sessions[0]).recipient!.name).not.toBe('hacked');
 expect(new Set(initial.map(r=>r!.id)).size).toBe(3);
});
it('claims_and_releases_fail_after_draw',()=>{
 const s=make();const g=readyGroup(s);s.draw(g.code,g.sessions[0]);
 expect(()=>s.claim(g.code,'new',g.ids[0])).toThrow(expect.objectContaining({code:'DRAW_FINAL'}));
 expect(()=>s.release(g.code,g.sessions[0],g.ids[0])).toThrow(expect.objectContaining({code:'DRAW_FINAL'}));
});
it('deadline_rechecked_before_commit',()=>{
 let now=0;const s=make({now:()=>now,assign:ids=>{now=3_600_000;return new Map(ids.map((id,i)=>[id,ids[(i+1)%ids.length]]));}});
 const g=readyGroup(s);
 expect(()=>s.draw(g.code,g.sessions[0])).toThrow(expect.objectContaining({code:'GROUP_UNAVAILABLE'}));
});

