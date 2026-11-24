import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every stylesheet in the app. */
function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith('.css') ? [path] : [];
  });
}

// Vitest runs from apps/web.
const root = join(process.cwd(), 'src');

describe('mobile-first styles', () => {
  const files = cssFiles(root);

  it('finds the stylesheets', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((file) => [relative(root, file), file]))(
    '%s only widens the layout with min-width queries',
    (_name, file) => {
      const css = readFileSync(file, 'utf8');
      // Base rules are the phone layout. A max-width (or `width <`) query would mean the base
      // rules were written for desktop and patched down for phones.
      expect(css).not.toMatch(/@media[^{]*\bmax-(device-)?width\b/);
      expect(css).not.toMatch(/@media[^{]*\bwidth\s*<=?/);
    },
  );
});
