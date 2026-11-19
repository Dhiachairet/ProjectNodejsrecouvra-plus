import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Maintainability thresholds (ISO/IEC 25010, 6.7). Warnings, not errors: they are measured
// and reported as metrics, and they point at refactoring candidates without blocking a build.
const MAINTAINABILITY_RULES = {
  complexity: ['warn', 10],
  'max-depth': ['warn', 4],
  'max-params': ['warn', 4],
  'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }]
};

// Node globals for ES modules: without the CommonJS-only require, module, exports, __dirname and
// __filename, which do not exist here ("type": "module"). Web Storage is not available in Node by default.
const NODE_GLOBALS = { ...globals.nodeBuiltin, localStorage: 'off', sessionStorage: 'off' };

export default [
  { ignores: ['**/node_modules/', '**/dist/', 'coverage/'] },

  js.configs.recommended,

  {
    // Everything outside the React app runs in Node: API, scripts, tests, tool configs
    files: ['**/*.{js,mjs,cjs}'],
    ignores: ['frontend/src/**'],
    languageOptions: { globals: NODE_GLOBALS }
  },

  {
    // React app, run in the browser. This block is also what makes ESLint lint the .jsx files at all.
    files: ['frontend/src/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },

  {
    // A leading underscore marks a parameter that must exist but is not used (e.g. Express error handlers)
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
  },

  {
    files: ['src/**/*.js', 'frontend/src/**/*.{js,jsx}'],
    rules: MAINTAINABILITY_RULES
  }
];
