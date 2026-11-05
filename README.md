# Tweet Prepender

Automatically add your chosen text to the beginning of every X (formerly Twitter) post. Save time and keep your posts consistent.

Set your text once in the popup. From then on, it's added to the start of each post you publish on x.com. You still write and press **Post** as usual, and nothing is published without you.

## Usage

1. Click the Tweet Prepender icon in the toolbar.
2. Type the text you want added, e.g., `Hello!`. It saves automatically.
3. Write a post on x.com and publish it. The text is added when the post is sent.

To turn it off, clear the text box.

### Good to know

- The compose box won't show the prepended text, and its character counter doesn't include it. Your post is only changed in the request X receives. If the combined text is over your length limit, X rejects the post.
- A single space is inserted between your text and the post. If your saved text ends with a line break (press Enter in the box), that is used instead, so the post starts on a new line.
- The text is added to replies, quote posts, and every post in a thread.
- Editing an already-published post is left unchanged, so the text isn't added twice.
- The default text is empty, so nothing is prepended until you set something.

## Install (unpacked)

Requires a Chromium-based browser, version 111 or later (Chrome, Edge, Brave, etc.).

1. Download and unzip the project, or clone the repository.
2. Open `chrome://extensions` (`edge://extensions` in Edge).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the project folder (the one containing `manifest.json`).
5. Reload any open x.com tabs.

After changing any file, click the reload icon on the extension's card, then reload x.com.

## How it works

Manifest V3 extensions can't modify request bodies through `webRequest` or `declarativeNetRequest`. Instead, the extension wraps the page's own `XMLHttpRequest`:

1. `inject.js` runs in the page's JavaScript context (`"world": "MAIN"`) at `document_start`. When X sends the `CreateTweet` GraphQL request, it adds your text to the start of `variables.tweet_text` in the request body. Every other request passes through untouched.
2. That context can't use extension APIs, so `bridge.js` runs in the extension's isolated context, reads the saved text from `chrome.storage`, and passes it to `inject.js` with `window.postMessage`. It sends the text on load and again whenever you change it.
3. `popup.html`, `popup.css` and `popup.js` make up the popup where you edit the text.

If anything goes wrong while rewriting a request, the original request is sent unchanged.

## Permissions and privacy

| Permission                           | Why                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `storage`                            | Saves your prepended text on this device (`chrome.storage.local`).                                        |
| Content scripts on `https://x.com/*` | Needed to see and modify the post request. Chrome describes this as "read and change your data on x.com". |

The extension doesn't request `webRequest`, `activeTab`, `scripting`, `tabs`, or any `host_permissions`. It makes no network requests of its own, collects no analytics, and doesn't read or store the content of your posts. Your saved text never leaves your browser.

`twitter.com` redirects to `x.com`, so only `x.com` is matched.

## Limitations

- **Relies on X's internal web API.** The `CreateTweet` endpoint and the `tweet_text` field can change. If the extension stops working, publish a post with DevTools open (Network tab, filter `CreateTweet`) and compare the request to the path in `CREATE_TWEET_PATH` and the field name in `inject.js`.
- **Other post types may not be covered.** Long-form posts and scheduled posts may use different endpoints.
- **twitter.com and x.com only.** Other X surfaces (such as separate apps or subdomains) aren't matched.

## Troubleshooting

- **Nothing is added.** Check that the text box isn't empty, that you reloaded x.com after installing or updating.
- **Post fails after enabling.** The combined text is probably over your length limit. Shorten the post.
- **Check what was sent.** In DevTools, open the `CreateTweet` request and look at the **Payload** tab. `variables.tweet_text` should start with your text.

## Project structure

```text
tweet-prepender/
├── manifest.json     Extension manifest (MV3, `storage` permission only)
├── inject.js         Page-context script that rewrites the CreateTweet request
├── bridge.js         Relays the saved text from extension storage to inject.js
├── popup.html        Popup markup
├── popup.css         Popup styles
├── popup.js          Loads and saves the text
└── images/icons/     16, 48 and 128 px icons
```

## LLM assistance

LLM assistance was used only for sections of the code, code comments, and the README in this project.

## Disclaimer

Tweet Prepender is an independent project. It isn't affiliated with, endorsed by, or sponsored by X Corp. "X" and "Twitter" are trademarks of their respective owners.
