import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { nextTick, plain, runScript } from './helpers.mjs';

// If an element ID is renamed in popup.html and popup.js, change it here too.
const INPUT_ID = 'txtPrepended';
const STATUS_ID = 'statusBar';

/** Loads popup.js with a fake DOM, mocked chrome.storage and manual timers. */
function setup({ stored = {}, failSave = false } = {}) {
  const saved = [];
  const getCalls = [];
  const timers = [];

  const input = {
    value: '',
    handlers: {},
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    },
  };
  const status = { textContent: '' };
  const elements = { [INPUT_ID]: input, [STATUS_ID]: status };

  runScript('popup.js', {
    document: {
      getElementById: (id) => {
        if (!(id in elements)) {
          throw new Error(`popup.js looked up unknown id "${id}"`);
        }

        return elements[id];
      },
    },
    chrome: {
      storage: {
        local: {
          get: async (defaults) => {
            getCalls.push(plain(defaults));
            return { ...defaults, ...stored };
          },
          set: async (items) => {
            if (failSave) throw new Error('quota exceeded');
            saved.push(plain(items));
          },
        },
      },
    },
    setTimeout: (callback, delay) => {
      timers.push({ callback, delay, cleared: false });
      return timers.length - 1;
    },
    clearTimeout: (id) => {
      if (timers[id]) timers[id].cleared = true;
    },
  });

  return {
    input,
    status,
    saved,
    getCalls,
    timers,
    /** Simulates the user typing, then waits for the save to settle. */
    async type(value) {
      input.value = value;
      await input.handlers.input();
    },
  };
}

describe('popup.js', () => {
  it('shows an empty box by default', async () => {
    const env = setup();
    await nextTick();

    assert.deepEqual(env.getCalls[0], { prependedText: '' });
    assert.equal(env.input.value, '');
  });

  it('shows the previously saved text', async () => {
    const env = setup({ stored: { prependedText: 'Hello!' } });
    await nextTick();

    assert.equal(env.input.value, 'Hello!');
  });

  it('saves the text as soon as it changes', async () => {
    const env = setup();

    await env.type('Hello!');

    assert.deepEqual(env.saved, [{ prependedText: 'Hello!' }]);
  });

  it('saves the text exactly as typed, including line breaks and spaces', async () => {
    const env = setup();

    await env.type('  Hello!\n');

    assert.equal(env.saved[0].prependedText, '  Hello!\n');
  });

  it('saves an empty string when the box is cleared', async () => {
    const env = setup({ stored: { prependedText: 'Hello!' } });

    await env.type('');

    assert.deepEqual(env.saved, [{ prependedText: '' }]);
  });

  it('confirms a save, then clears the message after 1.5 seconds', async () => {
    const env = setup();

    await env.type('Hello!');
    assert.equal(env.status.textContent, 'Saved');

    const [timer] = env.timers;
    assert.equal(timer.delay, 1500);
    timer.callback();
    assert.equal(env.status.textContent, '');
  });

  it('cancels the previous message timer on each new save', async () => {
    const env = setup();

    await env.type('a');
    await env.type('ab');

    assert.equal(env.timers[0].cleared, true);
    assert.equal(env.timers[1].cleared, false);
  });

  it('reports a failed save', async () => {
    const env = setup({ failSave: true });

    await env.type('Hello!');

    assert.equal(env.status.textContent, 'Could not save');
    assert.deepEqual(env.saved, []);
  });
});

describe('popup files stay in sync', () => {
  const read = (name) =>
    readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  const html = read('popup.html');
  const js = read('popup.js');
  const css = read('popup.css');

  const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(
    (match) => match[1]
  );
  const matchesAll = (text, pattern) =>
    [...text.matchAll(pattern)].map((match) => match[1]);

  it('uses the expected element IDs', () => {
    assert.ok(htmlIds.includes(INPUT_ID));
    assert.ok(htmlIds.includes(STATUS_ID));
  });

  it('popup.js only looks up IDs that exist in popup.html', () => {
    const used = matchesAll(js, /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g);

    assert.deepEqual(used.sort(), [INPUT_ID, STATUS_ID].sort());
    for (const id of used) {
      assert.ok(htmlIds.includes(id), `#${id} is not in popup.html`);
    }
  });

  it('popup.css only styles IDs that exist in popup.html', () => {
    // Look only at selectors (text before "{"), so hex colors like #fff are ignored.
    const selectors = matchesAll(css, /([^{}]+)\{/g).join(' ');
    const styled = matchesAll(selectors, /#([A-Za-z_][\w-]*)/g);

    assert.ok(styled.length > 0);
    for (const id of styled) {
      assert.ok(
        htmlIds.includes(id),
        `popup.css styles #${id}, which is not in popup.html`
      );
    }
  });

  it('every label points at an existing element', () => {
    const targets = matchesAll(html, /<label[^>]*\bfor="([^"]+)"/g);

    assert.ok(targets.length > 0);
    for (const id of targets) {
      assert.ok(
        htmlIds.includes(id),
        `label for="${id}" has no matching element`
      );
    }
  });

  it('keeps the agreed placeholder text', () => {
    assert.ok(html.includes('placeholder="Prepended text, e.g., Hello!"'));
  });
});
