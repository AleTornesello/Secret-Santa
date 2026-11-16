import type { GroupService } from '../../src/groups/service.js';
export function readyGroup(service: GroupService, names = ['Alice','Bob','Carol']) {
  const sessions = names.map((_,i) => 'session-' + i);
  const group = service.create(names,sessions[0]);
  group.participants.forEach((p,i)=>{ service.claim(group.code,sessions[i],p.id); service.connect(group.code,sessions[i],'socket-'+i); });
  return {code:group.code,sessions,ids:group.participants.map(p=>p.id)};
}

