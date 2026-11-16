import { expect, it } from 'vitest';
import { assignRecipients } from '../../src/groups/draw.js';
it('two_people_swap_recipients',()=>expect(assignRecipients(['a','b'])).toEqual(new Map([['a','b'],['b','a']])));
it('permutation_has_unique_recipients_without_self_matches',()=>{
 for(let n=2;n<=50;n++){const ids=Array.from({length:n},(_,i)=>String(i));const draw=assignRecipients(ids);expect(draw.size).toBe(n);expect(new Set(draw.values())).toEqual(new Set(ids));for(const [giver,recipient] of draw)expect(giver).not.toBe(recipient);}
});
it('rejects_self_matches_and_accepts_the_next_valid_shuffle',()=>{
 const sequence=[2,1,0,0]; let calls=0;
 expect(assignRecipients(['a','b','c'],()=>sequence[calls++])).toEqual(new Map([['a','b'],['b','c'],['c','a']]));
 expect(calls).toBe(4);
});

