export type GroupCode = string;
export type SessionId = string;
export type ParticipantId = string;
export type GroupStatus = 'WAITING' | 'DRAWN';
export type Recipient = { id: ParticipantId; name: string };
export type PublicParticipant = { id: ParticipantId; name: string; claimed: boolean; connected: boolean };
export type PublicGroupState = { code: GroupCode; revision: number; status: GroupStatus; createdAt: number; expiresAt: number; serverNow: number; participants: PublicParticipant[]; ready: boolean };
export type SessionGroupState = PublicGroupState & { selfId: ParticipantId | null; isCreator: boolean; recipient: Recipient | null };
export type GroupChange = { code: GroupCode; revision: number; expired: boolean };

