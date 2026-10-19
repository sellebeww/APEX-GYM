// Builds a Vercel Build Output API bundle: static SPA from dist/ plus the API as one Node function.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { build } from 'rolldown';
import { securityHeaders } from '../server/app.ts';

const out = '.vercel/output';
const fn = `${out}/functions/api.func`;

execSync('npx vite build', { stdio: 'inherit' });
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync('dist', `${out}/static`, { recursive: true });

await build({
  input: 'server/vercel.ts',
  platform: 'node',
  external: ['better-sqlite3'],
  output: { file: `${fn}/index.mjs`, format: 'esm' },
});
// migrate() reads *.sql next to the bundle; the native SQLite module ships with its runtime deps
fs.cpSync('server/db/migrations', `${fn}/migrations`, { recursive: true });
for (const dep of ['better-sqlite3', 'bindings', 'file-uri-to-path']) {
  fs.cpSync(`node_modules/${dep}`, `${fn}/node_modules/${dep}`, { recursive: true });
}

const nodeMajor = process.versions.node.split('.')[0]; // must match the ABI better-sqlite3 was installed for
fs.writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({ runtime: `nodejs${nodeMajor}.x`, handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false }));
fs.writeFileSync(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    // The CDN serves the SPA directly, so give it the same headers the Node server adds locally
    { src: '^/(.*)$', headers: securityHeaders(true), continue: true },
    { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { handle: 'filesystem' },
    { src: '^/api(/.*)?$', dest: '/api' },
    // SPA fallback: hash routing does the rest
    { src: '/(.*)', dest: '/index.html' },
  ],
}));
