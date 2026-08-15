/**
 * ESLint for the plugin's browser assets.
 *
 * The builder scripts run directly inside the Builderius chrome without a
 * transpilation step. Keep syntax within the Baseline widely-available set,
 * while enforcing modern declarations, callbacks and object literals.
 */
const globals = require('globals');
const js = require('@eslint/js');

module.exports = [
  {
    files: ['assets/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Injected/looked-up at runtime inside the builder page.
        Builderius: 'readonly',
        webpackChunkbuilderius: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // The codebase uses empty catch blocks as documented fail-soft guards.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // catch (e) without using e is the established fail-soft idiom.
      'no-unused-vars': ['error', { caughtErrors: 'none', args: 'after-used' }],
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
    },
  },
];
