import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateNames } from '../../src/groups/names.js';
import { createGroupService } from '../../src/groups/service.js';
const services: ReturnType<typeof createGroupService>[] = [];
afterEach(() => { services.splice(0).forEach(s => s.close()); vi.useRealTimers(); });
function make(now = () => Date.now(), maxGroups = 10) { const s = createGroupService({ now, maxGroups }); services.push(s); return s; }
describe('group lifetime', () => {
  it('validates_roster_boundaries_and_unicode', () => {
    for (const names of [null, 'Alice', ['A'], Array.from({length:51},(_,i)=>String(i)), [' ', 'Bob'], [1,'Bob'], ['A'.repeat(81),'Bob'], ['Alice','alice'], ['é','e\u0301']]) {
      expect(() => validateNames(names)).toThrow(expect.objectContaining({code:'INVALID_NAMES'}));
    }
    expect(validateNames([' Alice ','Bob'])).toEqual(['Alice','Bob']);
    expect(validateNames(['🎁'.repeat(80),'Bob'])).toHaveLength(2);
    expect(validateNames(Array.from({length:50},(_,i)=>String(i)))).toHaveLength(50);
  });
  it('expires_at_creation_plus_3600000', () => {
    let now = 1000; const s = make(() => now); const g = s.create(['Alice','Bob'],'creator');
    expect(g.createdAt).toBe(1000); expect(g.expiresAt).toBe(3_601_000);
    expect(g.code).toMatch(/^[a-f0-9]{32}$/);
    now = 3_600_999; expect(s.get(g.code,'creator').expiresAt).toBe(3_601_000);
    now++; expect(() => s.get(g.code,'creator')).toThrow(expect.objectContaining({code:'GROUP_UNAVAILABLE'}));
  });
  it('background_cleanup_removes_idle_groups', () => {
    vi.useFakeTimers(); const s = make(); const changes: unknown[] = []; s.onChange(c => changes.push(c));
    const g = s.create(['Alice','Bob'],'creator'); changes.length = 0;
    vi.advanceTimersByTime(3_600_000); s.sweepExpired();
    expect(changes).toEqual([{code:g.code,revision:g.revision+1,expired:true}]);
    expect(() => s.get(g.code,'creator')).toThrow();
  });
  it('copies_snapshots_and_enforces_group_capacity', () => {
    const s = make(() => 1000,1); const g=s.create(['Alice','Bob'],'creator');
    g.participants[0].name='CHANGED';
    expect(s.get(g.code,'creator').participants[0].name).toBe('Alice');
    expect(() => s.create(['C','D'],'other')).toThrow(expect.objectContaining({code:'CAPACITY_REACHED'}));
  });
});

