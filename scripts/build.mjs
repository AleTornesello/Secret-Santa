import { execFileSync } from 'node:child_process';
import { cp, mkdir, access } from 'node:fs/promises';
import { build } from 'esbuild';
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'], { stdio: 'inherit' });
for (const directory of ['views', 'public']) {
  try { await access('src/' + directory); } catch { continue; }
  await cp('src/' + directory, 'dist/' + directory, { recursive: true });
}
try { await access('src/browser/group.ts'); } catch { process.exit(0); }
await mkdir('dist/public', { recursive: true });
await build({ entryPoints: ['src/browser/group.ts'], bundle: true, outfile: 'dist/public/group.js', format: 'iife', target: ['es2022'], minify: true });

