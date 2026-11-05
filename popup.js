const STORAGE_KEY = 'prependedText';
const DEFAULT_TEXT = ''; // empty by default: nothing is prepended until the user sets text

const input = document.getElementById('txtPrepended');
const statusBar = document.getElementById('statusBar');

let clearStatusTimer;

chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_TEXT }).then((items) => {
  input.value = items[STORAGE_KEY];
});

input.addEventListener('input', async () => {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: input.value });
    showStatus('Saved');
  } catch {
    showStatus('Could not save');
  }
});

function showStatus(message) {
  statusBar.textContent = message;
  clearTimeout(clearStatusTimer);
  clearStatusTimer = setTimeout(() => {
    statusBar.textContent = '';
  }, 1500);
}
