import { afterEach, expect, it, vi } from 'vitest';
import { createSessionStore } from '../../src/sessions/store.js';
const stores: ReturnType<typeof createSessionStore>[]=[];
afterEach(()=>{stores.splice(0).forEach(s=>s.close());vi.useRealTimers();});
function make(now:()=>number=Date.now,maxSessions=10,maxMembershipsPerSession=10){const s=createSessionStore({now,maxSessions,maxMembershipsPerSession});stores.push(s);return s;}
it('tokens_are_opaque_and_forged_tokens_are_unknown',()=>{const s=make();const a=s.create();expect(a.id).toMatch(/^[a-f0-9]{64}$/);expect(a.csrfToken).not.toBe(a.id);expect(s.get('forged')).toBeUndefined();});
it('expired_group_drops_membership_and_unused_session',()=>{let now=0;const s=make(()=>now);const a=s.create();s.retain(a.id,'first',100);s.retain(a.id,'second',200);now=100;s.sweepExpired();expect(s.get(a.id)).toEqual(a);now=200;s.sweepExpired();expect(s.get(a.id)).toBeUndefined();});
it('background_removes_untouched_sessions',()=>{vi.useFakeTimers();const s=make();const a=s.create();vi.advanceTimersByTime(3_600_000);expect(s.get(a.id)).toBeUndefined();});
it('enforces_session_and_membership_capacity',()=>{const s=make(Date.now,1,1);const a=s.create();expect(()=>s.create()).toThrow(expect.objectContaining({code:'CAPACITY_REACHED'}));s.retain(a.id,'group',Date.now()+10000);expect(s.canRetain(a.id,'group')).toBe(true);expect(s.canRetain(a.id,'other')).toBe(false);expect(()=>s.retain(a.id,'other',Date.now()+10000)).toThrow();s.forgetGroup('group');expect(s.get(a.id)).toBeUndefined();});

