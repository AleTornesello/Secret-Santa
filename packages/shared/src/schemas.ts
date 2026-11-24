import { z } from 'zod';
import { GROUP_SIZE } from './group.ts';
import { isValidJoinCode, normalizeJoinCode } from './joinCode.ts';

export const groupNameSchema = z.string().trim().min(1).max(60);
export const displayNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1).max(40));

/** Optional budget in euros: positive, at most 999,999.99, whole cents. */
export const budgetSchema = z
  .number()
  .positive()
  .max(999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Whole cents only');

export const joinCodeSchema = z
  .string()
  .transform(normalizeJoinCode)
  .refine(isValidJoinCode, 'Invalid join code');

export const createGroupInput = z
  .object({
    name: groupNameSchema,
    budget: budgetSchema.nullish(),
    names: z.array(displayNameSchema).min(GROUP_SIZE.min).max(GROUP_SIZE.max),
    /** Index in `names` of the organizer's own name, when the organizer plays too. */
    ownIndex: z.number().int().nonnegative().nullish(),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.names.forEach((name, index) => {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['names', index], message: 'Duplicate name' });
      }
      seen.add(key);
    });
    if (value.ownIndex != null && value.ownIndex >= value.names.length) {
      ctx.addIssue({ code: 'custom', path: ['ownIndex'], message: 'No such name' });
    }
  });

export const previewGroupInput = z.object({ code: joinCodeSchema });
export const joinGroupInput = z.object({ code: joinCodeSchema, participantId: z.uuid() });
export const groupIdInput = z.object({ groupId: z.uuid() });
export const releaseClaimInput = z.object({ groupId: z.uuid(), participantId: z.uuid() });

export type CreateGroupInput = z.infer<typeof createGroupInput>;
export type JoinGroupInput = z.infer<typeof joinGroupInput>;
