/**
 * bridge.js — content script in the extension's isolated world.
 *
 * It can use chrome.storage but cannot touch the page's fetch/XHR.
 * inject.js can touch fetch/XHR but cannot use chrome.storage.
 * This script reads the saved text and passes it to inject.js, both at load
 * time and whenever the user changes it in the popup.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'prependedText';
  const MESSAGE_SOURCE = 'tweet-prepender';

  function publish(text) {
    window.postMessage(
      { source: MESSAGE_SOURCE, type: 'SET_TEXT', text: text || '' },
      window.location.origin
    );
  }

  chrome.storage.local.get({ [STORAGE_KEY]: '' }).then((items) => {
    publish(items[STORAGE_KEY]);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      publish(changes[STORAGE_KEY].newValue);
    }
  });
})();
