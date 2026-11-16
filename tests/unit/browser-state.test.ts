import { expect, it } from 'vitest';
import { applyPublicState, applyPrivateResult, expireClient, type ClientState } from '../../src/browser/state.js';
const initial:ClientState={snapshot:{code:'code',revision:5,status:'DRAWN',createdAt:0,expiresAt:3_600_000,serverNow:1000,participants:[],ready:false,selfId:'a',isCreator:true,recipient:{id:'b',name:'Bob'}},connected:true,expired:false,deadlineLocal:10000};
it('ignores_older_revisions',()=>{expect(applyPublicState(initial,{...initial.snapshot,revision:4,status:'WAITING'},100)).toEqual(initial);});
it('ignores_results_after_terminal_expiry',()=>{const expired=expireClient(initial);expect(expired.snapshot.recipient).toBeNull();expect(applyPrivateResult(expired,{code:'code',revision:6,recipient:{id:'c',name:'Carol'},expiresAt:3_600_000,serverNow:1000},100).snapshot.recipient).toBeNull();});
it('older_public_events_cannot_restore_cleared_result',()=>{const expired=expireClient(initial);expect(applyPublicState(expired,initial.snapshot,100).expired).toBe(true);});
it('uses_remaining_server_lifetime_without_extending_local_deadline',()=>{const update={...initial.snapshot,serverNow:3_599_000};expect(applyPublicState(initial,update,500).deadlineLocal).toBe(1500);expect(applyPublicState(initial,{...update,serverNow:3_600_000},500).expired).toBe(true);});

