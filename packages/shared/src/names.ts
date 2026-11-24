/** Turns the names text area into a list: one name per line, trimmed, blank lines dropped. */
export function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line !== '');
}
