/** Contract between the web app and the Edge Functions. */

export type ApiErrorCode =
  | 'invalid_input'
  | 'unauthorized'
  | 'not_found'
  | 'already_taken'
  | 'group_drawn'
  | 'joining_closed'
  | 'rate_limited'
  | 'internal';

export interface ApiError {
  error: ApiErrorCode;
}

export type GroupStatus = 'open' | 'drawn';

export interface ParticipantSummary {
  id: string;
  name: string;
  taken: boolean;
}

export interface GroupPreview {
  id: string;
  name: string;
  budget: number | null;
  status: GroupStatus;
  joinDeadline: string;
  joined: number;
  total: number;
  participants: ParticipantSummary[];
}

export interface CreateGroupResult {
  groupId: string;
  joinCode: string;
  adminToken: string;
  /** Present when the organizer plays too. */
  playerToken: string | null;
  participantId: string | null;
}

export interface JoinGroupResult {
  groupId: string;
  participantId: string;
  playerToken: string;
  status: GroupStatus;
}

export interface AdminGroupView extends GroupPreview {
  joinCode: string;
}

export interface MyAssignment {
  groupId: string;
  groupName: string;
  budget: number | null;
  status: GroupStatus;
  joined: number;
  total: number;
  me: string;
  /** Only once everyone has joined and the draw has happened. */
  recipient: string | null;
}

/** Payload of the Realtime Broadcast on channel `group:<id>`, event `progress`. */
export interface GroupProgress {
  joined: number;
  total: number;
  takenIds: string[];
  status: GroupStatus;
}
