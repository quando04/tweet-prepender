import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * Runs one of the extension's classic scripts (e.g. "inject.js") inside a
 * sandbox. `globals` are the mocked browser APIs the script expects. The
 * sandbox doubles as `window`, like the global object in a real page.
 */
export function runScript(fileName, globals = {}) {
  const sandbox = { ...globals };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  const source = readFileSync(
    new URL(`../${fileName}`, import.meta.url),
    'utf8'
  );
  vm.runInContext(source, sandbox, { filename: fileName });

  return sandbox;
}

/**
 * The `window` the script sees. Inside a vm context this is the context's own
 * global object, which is not the same reference as the sandbox object passed
 * in, so tests that compare against `window` (like event.source) need this.
 */
export function getWindow(sandbox) {
  return vm.runInContext('window', sandbox);
}

/** Objects created inside the sandbox have a different prototype, so copy them out before comparing. */
export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Waits for pending promise callbacks (e.g. a mocked chrome.storage call) to finish. */
export function nextTick() {
  return new Promise((resolve) => setImmediate(resolve));
}
