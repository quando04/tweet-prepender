/**
 * inject.js — runs in the page's own JavaScript context ("MAIN" world).
 *
 * It wraps XMLHttpRequest so that, when X sends the request
 * that publishes a post, the configured text is added to the start of
 * `variables.tweet_text` in the request body.
 *
 * This world has no access to chrome.* APIs, so the saved text is handed over
 * by bridge.js through window.postMessage.
 */
(() => {
  'use strict';

  const MESSAGE_SOURCE = 'tweet-prepender';

  // GraphQL operation X's web app calls to publish a post, e.g.
  // https://x.com/i/api/graphql/<queryId>/CreateTweet
  const CREATE_TWEET_PATH = /^\/i\/api\/graphql\/[^/]+\/CreateTweet$/;

  let prependedText = '';

  // Receive the setting from bridge.js

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;

    if (!data || data.source !== MESSAGE_SOURCE || data.type !== 'SET_TEXT')
      return;
    if (typeof data.text !== 'string') {
      return;
    }

    // Whitespace-only text counts as "off".
    prependedText = data.text.trim() ? data.text : '';
  });

  // Helpers

  function isTwitterHost(hostname) {
    return (
      hostname === 'x.com' ||
      hostname.endsWith('.x.com') ||
      hostname.endsWith('twitter.com') ||
      hostname.endsWith('.twitter.com')
    );
  }

  function isCreateTweet(url, method) {
    if (method !== 'POST') {
      return false;
    }

    try {
      const { hostname, pathname } = new URL(url, location.href);
      const isTwitter = isTwitterHost(hostname);
      return isTwitter && CREATE_TWEET_PATH.test(pathname);
    } catch {
      return false;
    }
  }

  // Put one space between the prepended text and the post, unless the saved
  // text already ends in whitespace (e.g. a newline).
  function withSeparator(text) {
    return /\s$/.test(text) ? text : `${text} `;
  }

  // Returns the rewritten JSON body, or null if nothing should change.
  function prependToBody(bodyText) {
    if (!prependedText) {
      return null;
    }

    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return null;
    }

    const vars = payload && payload.variables;
    if (!vars || typeof vars.tweet_text !== 'string') {
      return null;
    }

    // Editing an existing post: its text already contains the prefix.
    if (vars.edit_options) {
      return null;
    }

    vars.tweet_text = vars.tweet_text
      ? withSeparator(prependedText) + vars.tweet_text
      : prependedText.trimEnd(); // media-only post

    return JSON.stringify(payload);
  }

  // XMLHttpRequest

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const targetRequests = new WeakSet();

  XMLHttpRequest.prototype.open = function (method, url) {
    if (isCreateTweet(String(url), String(method).toUpperCase())) {
      targetRequests.add(this);
    } else {
      targetRequests.delete(this);
    }

    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (targetRequests.has(this) && typeof body === 'string') {
      const rewritten = prependToBody(body);
      if (rewritten !== null) {
        body = rewritten;
      }
    }

    return originalSend.call(this, body);
  };
})();
