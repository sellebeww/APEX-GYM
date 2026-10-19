// Runs the API and Vite together; Ctrl+C stops both.
import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['--watch', 'server/index.ts'], { stdio: 'inherit' }),
  spawn('npx', ['vite', '--port=3000', '--host=127.0.0.1'], { stdio: 'inherit' }),
];
const stop = () => procs.forEach(p => p.kill());
procs.forEach(p => p.on('exit', code => { stop(); process.exit(code ?? 0); }));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
