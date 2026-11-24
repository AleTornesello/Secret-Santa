/** Smallest and largest number of participants a group may have. */
export const GROUP_SIZE = { min: 3, max: 100 } as const;

export function isValidGroupSize(count: number): boolean {
  return Number.isInteger(count) && count >= GROUP_SIZE.min && count <= GROUP_SIZE.max;
}
