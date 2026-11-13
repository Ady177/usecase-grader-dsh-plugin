import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'src');
const output = join(root, 'lib');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
  const inputPath = join(source, entry.name);
  const js = stripTypeScriptTypes(await readFile(inputPath, 'utf8'), { mode: 'strip' }).replace(/^[\t ]+$/gm, '');
  await writeFile(join(output, `${basename(entry.name, '.ts')}.js`), js, 'utf8');
}
console.log('Built TypeScript plugin modules with Node.js type stripping.');
