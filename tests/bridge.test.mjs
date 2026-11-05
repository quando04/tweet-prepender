import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextTick, plain, runScript } from './helpers.mjs';

/** Loads bridge.js with a mocked chrome.storage and window.postMessage. */
function setup(stored = { prependedText: 'Hello!' }) {
  const posted = [];
  const getCalls = [];
  let changeListener;

  runScript('bridge.js', {
    location: { origin: 'https://x.com' },
    postMessage: (message, targetOrigin) => {
      posted.push({ message: plain(message), targetOrigin });
    },
    chrome: {
      storage: {
        local: {
          get: async (defaults) => {
            getCalls.push(plain(defaults));
            return { ...defaults, ...stored };
          },
        },
        onChanged: {
          addListener: (listener) => {
            changeListener = listener;
          },
        },
      },
    },
  });

  return {
    posted,
    getCalls,
    change: (changes, area = 'local') => changeListener(changes, area),
  };
}

describe('bridge.js', () => {
  it('publishes the saved text when the page loads', async () => {
    const env = setup({ prependedText: 'Hello!' });
    await nextTick();

    assert.equal(env.posted.length, 1);
    assert.deepEqual(env.posted[0].message, {
      source: 'tweet-prepender',
      type: 'SET_TEXT',
      text: 'Hello!',
    });
  });

  it("only posts to the page's own origin", async () => {
    const env = setup();
    await nextTick();

    assert.equal(env.posted[0].targetOrigin, 'https://x.com');
  });

  it('defaults to an empty string when nothing is saved', async () => {
    const env = setup({});
    await nextTick();

    assert.deepEqual(env.getCalls[0], { prependedText: '' });
    assert.equal(env.posted[0].message.text, '');
  });

  it('publishes again when the text changes in storage', async () => {
    const env = setup();
    await nextTick();

    env.change({ prependedText: { oldValue: 'Hello!', newValue: 'Goodbye!' } });

    assert.equal(env.posted.length, 2);
    assert.equal(env.posted[1].message.text, 'Goodbye!');
  });

  it('publishes an empty string when the saved text is removed', async () => {
    const env = setup();
    await nextTick();

    env.change({ prependedText: { oldValue: 'Hello!' } });

    assert.equal(env.posted[1].message.text, '');
  });

  it('ignores changes in other storage areas and to other keys', async () => {
    const env = setup();
    await nextTick();

    env.change({ prependedText: { newValue: 'Nope' } }, 'sync');
    env.change({ somethingElse: { newValue: 'Nope' } });

    assert.equal(env.posted.length, 1);
  });
});
