import js from '@eslint/js';

// Globals the extension scripts use. Listed by hand so the only dependencies
// are `eslint` and `@eslint/js`.
const extensionGlobals = {
  chrome: 'readonly',
  window: 'readonly',
  document: 'readonly',
  location: 'readonly',
  URL: 'readonly',
  XMLHttpRequest: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
};

export default [
  { ignores: ['node_modules/'] },

  js.configs.recommended,

  {
    // The extension files are classic scripts, not ES modules.
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: extensionGlobals,
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  {
    // Build scripts and tests run in Node as ES modules.
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setImmediate: 'readonly',
        URL: 'readonly',
      },
    },
  },
];
