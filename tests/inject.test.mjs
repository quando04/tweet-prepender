import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getWindow, runScript } from './helpers.mjs';

const MESSAGE_SOURCE = 'tweet-prepender';
const CREATE_TWEET_URL = 'https://x.com/i/api/graphql/abc123/CreateTweet';
const HOME_TIMELINE_URL = 'https://x.com/i/api/graphql/abc123/HomeTimeline';

/** Builds a CreateTweet-style request body. */
function makeBody(tweetText, variables = {}) {
  return JSON.stringify({
    variables: { tweet_text: tweetText, dark_request: false, ...variables },
    features: { some_feature: true },
    queryId: 'abc123',
  });
}

/** Loads inject.js into a sandbox with a fake XMLHttpRequest. */
function setup() {
  const listeners = [];

  class FakeXHR {
    open(method, url) {
      this.openedWith = { method, url };
    }
    send(body) {
      this.sentBody = body;
    }
  }

  const sandbox = runScript('inject.js', {
    URL,
    location: { href: 'https://x.com/home', origin: 'https://x.com' },
    XMLHttpRequest: FakeXHR,
    addEventListener: (type, listener) => {
      if (type === 'message') listeners.push(listener);
    },
  });

  const env = {
    /** Delivers a window "message" event to the script. */
    send(data, source = getWindow(sandbox)) {
      for (const listener of listeners) listener({ source, data });
    },

    /** Simulates bridge.js publishing the saved text. */
    setText(text) {
      env.send({ source: MESSAGE_SOURCE, type: 'SET_TEXT', text });
    },

    /** A fresh (unopened) fake XHR. */
    newXhr: () => new sandbox.XMLHttpRequest(),

    /** Makes an XHR the way page code would and returns the fake instance. */
    xhr(method, url, body) {
      const request = env.newXhr();
      request.open(method, url);
      request.send(body);
      return request;
    },

    /** Posts a body to CreateTweet and returns the tweet_text that was sent. */
    sentTweetText(body, url = CREATE_TWEET_URL) {
      const request = env.xhr('POST', url, body);
      return JSON.parse(request.sentBody).variables.tweet_text;
    },
  };

  return env;
}

describe('inject.js', () => {
  it('leaves requests untouched while no text is set (default)', () => {
    const env = setup();
    const body = makeBody('my post');

    const request = env.xhr('POST', CREATE_TWEET_URL, body);

    assert.equal(request.sentBody, body);
  });

  it('prepends the text and a space to tweet_text', () => {
    const env = setup();
    env.setText('Hello!');

    assert.equal(env.sentTweetText(makeBody('my post')), 'Hello! my post');
  });

  it('still calls the original open with the same arguments', () => {
    const env = setup();
    env.setText('Hello!');

    const request = env.xhr('POST', CREATE_TWEET_URL, makeBody('my post'));

    assert.equal(request.openedWith.method, 'POST');
    assert.equal(request.openedWith.url, CREATE_TWEET_URL);
  });

  it('keeps every other field in the request intact', () => {
    const env = setup();
    env.setText('Hello!');

    const request = env.xhr(
      'POST',
      CREATE_TWEET_URL,
      makeBody('my post', { media: { media_entities: [] } })
    );

    const sent = JSON.parse(request.sentBody);
    assert.equal(sent.queryId, 'abc123');
    assert.equal(sent.features.some_feature, true);
    assert.equal(sent.variables.dark_request, false);
    assert.deepEqual(sent.variables.media, { media_entities: [] });
  });

  it('does not add a space when the saved text ends with a newline', () => {
    const env = setup();
    env.setText('Hello!\n');

    assert.equal(env.sentTweetText(makeBody('my post')), 'Hello!\nmy post');
  });

  it('uses just the text (no trailing space) for media-only posts', () => {
    const env = setup();
    env.setText('Hello! ');

    assert.equal(env.sentTweetText(makeBody('')), 'Hello!');
  });

  it('skips edits of existing posts', () => {
    const env = setup();
    env.setText('Hello!');
    const body = makeBody('Hello! my post', {
      edit_options: { previous_tweet_id: '123' },
    });

    const request = env.xhr('POST', CREATE_TWEET_URL, body);

    assert.equal(request.sentBody, body);
  });

  it('applies to replies', () => {
    const env = setup();
    env.setText('Hello!');
    const body = makeBody('a reply', { reply: { in_reply_to_tweet_id: '1' } });

    assert.equal(env.sentTweetText(body), 'Hello! a reply');
  });

  it('follows changes to the saved text and can be turned off again', () => {
    const env = setup();
    const body = makeBody('my post');

    env.setText('One');
    const first = env.sentTweetText(body);
    env.setText('Two');
    const second = env.sentTweetText(body);
    env.setText('');
    const third = env.sentTweetText(body);

    assert.deepEqual(
      [first, second, third],
      ['One my post', 'Two my post', 'my post']
    );
  });

  it('treats whitespace-only text as off', () => {
    const env = setup();
    env.setText('   \n ');
    const body = makeBody('my post');

    const request = env.xhr('POST', CREATE_TWEET_URL, body);

    assert.equal(request.sentBody, body);
  });

  it('accepts requests to x.com subdomains', () => {
    const env = setup();
    env.setText('Hello!');

    const text = env.sentTweetText(
      makeBody('my post'),
      'https://api.x.com/i/api/graphql/abc123/CreateTweet'
    );

    assert.equal(text, 'Hello! my post');
  });

  it('accepts relative URLs', () => {
    const env = setup();
    env.setText('Hello!');

    const text = env.sentTweetText(
      makeBody('my post'),
      '/i/api/graphql/abc123/CreateTweet'
    );

    assert.equal(text, 'Hello! my post');
  });

  describe('ignores requests that are not post creation', () => {
    const cases = [
      ['a different GraphQL operation', 'POST', HOME_TIMELINE_URL],
      ['a GET request to the same path', 'GET', CREATE_TWEET_URL],
      [
        'another site',
        'POST',
        'https://example.com/i/api/graphql/abc123/CreateTweet',
      ],
      [
        'a lookalike host',
        'POST',
        'https://notx.com/i/api/graphql/abc123/CreateTweet',
      ],
      [
        'a host that merely starts with x.com',
        'POST',
        'https://x.com.evil.com/i/api/graphql/abc123/CreateTweet',
      ],
      [
        'a longer operation name',
        'POST',
        'https://x.com/i/api/graphql/abc123/CreateTweetDraft',
      ],
    ];

    for (const [name, method, url] of cases) {
      it(name, () => {
        const env = setup();
        env.setText('Hello!');
        const body = makeBody('my post');

        const request = env.xhr(method, url, body);

        assert.equal(request.sentBody, body);
      });
    }
  });

  describe('passes through bodies it cannot rewrite', () => {
    const cases = [
      ['invalid JSON', 'not json'],
      ['JSON without tweet_text', JSON.stringify({ variables: { other: 1 } })],
      ['JSON without variables', JSON.stringify({ queryId: 'abc123' })],
      ['a null body', null],
      ['an undefined body', undefined],
    ];

    for (const [name, body] of cases) {
      it(name, () => {
        const env = setup();
        env.setText('Hello!');

        const request = env.xhr('POST', CREATE_TWEET_URL, body);

        assert.equal(request.sentBody, body);
      });
    }
  });

  it('forgets a target when the same XHR is reopened for another URL', () => {
    const env = setup();
    env.setText('Hello!');
    const body = makeBody('my post');
    const request = env.newXhr();

    request.open('POST', CREATE_TWEET_URL);
    request.open('POST', HOME_TIMELINE_URL);
    request.send(body);

    assert.equal(request.sentBody, body);
  });

  it('rewrites each request independently, without double-prepending', () => {
    const env = setup();
    env.setText('Hello!');
    const body = makeBody('my post');

    const first = env.xhr('POST', CREATE_TWEET_URL, body);
    const second = env.xhr('POST', CREATE_TWEET_URL, body);

    for (const request of [first, second]) {
      assert.equal(
        JSON.parse(request.sentBody).variables.tweet_text,
        'Hello! my post'
      );
    }
  });
});

describe('inject.js: messages', () => {
  const body = makeBody('my post');

  it('ignores messages that do not come from the page window', () => {
    const env = setup();

    env.send({ source: MESSAGE_SOURCE, type: 'SET_TEXT', text: 'Hacked' }, {});

    assert.equal(env.sentTweetText(body), 'my post');
  });

  it('ignores messages with the wrong source or type', () => {
    const env = setup();

    env.send({ source: 'something-else', type: 'SET_TEXT', text: 'Hacked' });
    env.send({ source: MESSAGE_SOURCE, type: 'OTHER', text: 'Hacked' });
    env.send(null);
    env.send('a string');

    assert.equal(env.sentTweetText(body), 'my post');
  });

  it('keeps the previous text when it receives a non-string value', () => {
    const env = setup();
    env.setText('Keep');

    env.setText(123);
    env.setText(undefined);
    env.setText({ toString: () => 'Hacked' });

    assert.equal(env.sentTweetText(body), 'Keep my post');
  });
});
