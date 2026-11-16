export type ErrorCode = 'INVALID_NAMES' | 'GROUP_UNAVAILABLE' | 'NAME_TAKEN' | 'ALREADY_CLAIMED' | 'FORBIDDEN' | 'NOT_READY' | 'DRAW_FINAL' | 'CAPACITY_REACHED' | 'INVALID_REQUEST';
const messages: Record<ErrorCode, string> = {
  INVALID_NAMES: 'Enter 2 to 50 distinct names, each between 1 and 80 characters.',
  GROUP_UNAVAILABLE: 'This group is unavailable. It may have expired or the server may have restarted.',
  NAME_TAKEN: 'That name has already been selected. Choose your available name.',
  ALREADY_CLAIMED: 'You have already selected a name in this group.',
  FORBIDDEN: 'You do not have permission for this action.',
  NOT_READY: 'Everyone, including the creator, must select a name and be connected.',
  DRAW_FINAL: 'The draw is final. Names and assignments cannot be changed.',
  CAPACITY_REACHED: 'The server is busy. Please try again later.',
  INVALID_REQUEST: 'The request could not be accepted.',
};
export class GroupError extends Error {
  constructor(public readonly code: ErrorCode) { super(messages[code]); this.name = 'GroupError'; }
}

