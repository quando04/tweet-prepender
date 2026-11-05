import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const root = new URL('../', import.meta.url);
const readJson = (name) =>
  JSON.parse(readFileSync(new URL(name, root), 'utf8'));
const manifest = readJson('manifest.json');
const pkg = readJson('package.json');

describe('manifest.json', () => {
  it('is Manifest V3', () => {
    assert.equal(manifest.manifest_version, 3);
  });

  it('requests only the storage permission and no host permissions', () => {
    assert.deepEqual(manifest.permissions, ['storage']);
    assert.equal(manifest.host_permissions, undefined);
    assert.equal(manifest.optional_permissions, undefined);
  });

  it('runs content scripts only on https://x.com/* and https://twitter.com/*', () => {
    assert.ok(manifest.content_scripts.length > 0);
    for (const script of manifest.content_scripts) {
      assert.deepEqual(script.matches, [
        'https://x.com/*',
        'https://twitter.com/*',
      ]);
    }
  });

  it('runs inject.js in the page world and bridge.js in the isolated world', () => {
    const byFile = (file) =>
      manifest.content_scripts.find((script) => script.js.includes(file));

    assert.equal(byFile('inject.js').world, 'MAIN');
    assert.equal(byFile('bridge.js').world, undefined);
    for (const script of manifest.content_scripts) {
      assert.equal(script.run_at, 'document_start');
    }
  });

  it('requires a Chrome version that supports "world": "MAIN"', () => {
    assert.ok(Number(manifest.minimum_chrome_version) >= 111);
  });

  it('has a description within the 132-character store limit', () => {
    assert.ok(manifest.description.length <= 132);
  });

  it('only references files that exist', () => {
    const files = [
      manifest.action.default_popup,
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon),
      ...manifest.content_scripts.flatMap((script) => script.js),
    ];

    for (const file of files) {
      assert.ok(existsSync(new URL(file, root)), `${file} is missing`);
    }
  });

  it('has the same version as package.json', () => {
    assert.equal(manifest.version, pkg.version);
  });
});
