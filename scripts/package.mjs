/**
 * Usage: npm run package
 */
import AdmZip from 'adm-zip';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Everything the published extension needs. Add new runtime files here.
const INCLUDE = [
  'manifest.json',
  'inject.js',
  'bridge.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'images',
];

const { version } = JSON.parse(
  readFileSync(join(root, 'manifest.json'), 'utf8')
);

const zip = new AdmZip();

for (const entry of INCLUDE) {
  const fullPath = join(root, entry);
  if (!existsSync(fullPath)) {
    console.error(`Cannot package: "${entry}" does not exist.`);
    process.exit(1);
  }
  if (statSync(fullPath).isDirectory()) {
    zip.addLocalFolder(fullPath, entry);
  } else {
    zip.addLocalFile(fullPath); // placed at the zip root
  }
}

const distDir = join(root, 'dist');
mkdirSync(distDir, { recursive: true });

const outFile = join(distDir, `tweet-prepender-v${version}.zip`);
zip.writeZip(outFile);

console.log(`Created ${outFile}`);
