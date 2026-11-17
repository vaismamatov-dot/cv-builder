import { spawn } from 'node:child_process';
import { cp, lstat, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const staging = path.join(root, '.pages-build');
const output = path.join(root, 'out');
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/cv-builder').replace(/\/$/, '');
if (basePath && !/^\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(basePath)) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be empty or a slash-prefixed repository path.');
}

async function clearBuildDirectory(target) {
  const resolved = path.resolve(target);
  if (path.dirname(resolved) !== root || !['.pages-build', 'out'].includes(path.basename(resolved))) {
    throw new Error(`Refusing to remove a path outside the known build directories: ${resolved}`);
  }
  const existing = await lstat(resolved).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!existing) return;
  if (!existing.isDirectory() || existing.isSymbolicLink() || await realpath(resolved) !== resolved) {
    throw new Error(`Refusing to remove an unexpected directory or link: ${resolved}`);
  }
  await rm(resolved, { recursive: true, force: true });
}

function run(script, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Pages build failed (${signal || code}).`)));
  });
}

const env = { ...process.env, PAGES_BUILD: 'true', NEXT_PUBLIC_BASE_PATH: basePath, AI_ENABLED: 'false' };
await run(path.join(root, 'scripts', 'prepare-assets.mjs'), [], root, env);
await clearBuildDirectory(staging);
await mkdir(staging);

try {
  // Build a separate source tree so the full local/server app and its .next stay intact.
  // The POST API is deliberately absent from the static artifact; no environment files are copied.
  const apiDirectory = path.join(root, 'src', 'app', 'api');
  await cp(path.join(root, 'src'), path.join(staging, 'src'), {
    recursive: true,
    filter: source => source !== apiDirectory,
  });
  await cp(path.join(root, 'public'), path.join(staging, 'public'), { recursive: true });
  for (const file of ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'next-env.d.ts']) {
    await cp(path.join(root, file), path.join(staging, file));
  }
  // The package manager root is the checkout; normal Node resolution finds its node_modules.
  // Remove stale Next-generated type globs from the copied config only.
  const tsconfigPath = path.join(staging, 'tsconfig.json');
  const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf8'));
  tsconfig.include = ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'];
  tsconfig.exclude = ['node_modules'];
  await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');

  await run(path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), ['build', '--webpack'], staging, env);
  const exported = path.join(staging, 'out');
  if (!(await stat(path.join(exported, 'index.html'))).isFile()) throw new Error('Next did not emit out/index.html.');
  await clearBuildDirectory(output);
  await cp(exported, output, { recursive: true });
  await writeFile(path.join(output, '.nojekyll'), '');
  console.log(`GitHub Pages export ready: ${output} (base path: ${basePath || '/'}, AI disabled).`);
} finally {
  await clearBuildDirectory(staging);
}
