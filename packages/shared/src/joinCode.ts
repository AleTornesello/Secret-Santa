import { randomInt, type RandomInt } from './random.ts';

/** 31 symbols with no look-alikes: no 0/O and no 1/I/L. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 8;

const JOIN_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{8}$/;

export function generateJoinCode(random: RandomInt = randomInt): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[random(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/** Accepts what people type: lower case, spaces and dashes ("abcd-2345"). */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidJoinCode(code: string): boolean {
  return JOIN_CODE_PATTERN.test(code);
}
