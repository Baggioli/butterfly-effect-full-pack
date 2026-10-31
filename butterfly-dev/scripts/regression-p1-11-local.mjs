/** Local regression wrapper: unit smoke + optional e2e. Never touches A2. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function run(script) {
  console.log('\n>>>', script);
  const r = spawnSync('node', [script], { cwd: root, stdio: 'inherit' });
  if (r.status) process.exit(r.status || 1);
}
run('scripts/smoke-p1-11-coldstart.mjs');
if (process.env.SKIP_E2E === '1') {
  console.log('SKIP_E2E=1 — browser e2e skipped');
} else {
  run('scripts/e2e-p1-11-coldstart.mjs');
}
console.log('\nLocal regression green. A2 hot-update still requires explicit order.');
