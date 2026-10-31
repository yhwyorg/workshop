// Installs dependencies only when package-lock.json's contents changed since the last
// install. Used by the Tiltfile's "deps" resource.
//
// Two traps this avoids:
//   - `npm ci` deletes node_modules first. On Windows the running dev and prod
//     servers hold esbuild.exe open, so the delete failed halfway and left
//     node_modules half-empty.
//   - `npm install` rewrites package-lock.json even when nothing changed. Tilt
//     watches that file, so it re-ran npm install, which rewrote the file again,
//     forever. Comparing contents makes the second run a no-op that writes nothing.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const stamp = 'node_modules/.deps-hash';
const hash = () => createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');

if (existsSync(stamp) && readFileSync(stamp, 'utf8') === hash()) {
  console.log('dependencies up to date');
} else {
  execSync('npm install --no-audit --no-fund', { stdio: 'inherit' });
  writeFileSync(stamp, hash());
}
