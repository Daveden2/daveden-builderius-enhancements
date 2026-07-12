/**
 * ESLint for the plugin's browser assets.
 *
 * The builder scripts are deliberately ES5-flavoured (var, function
 * expressions) and run inline inside the Builderius chrome, so the ruleset is
 * correctness-focused: undefined globals, dead code, common logic slips.
 * Stylistic rules are left off — phpcs guards the PHP style, and the JS follows
 * the file's own established idiom.
 */
const globals = require('globals');
const js = require('@eslint/js');

module.exports = [
  {
    files: ['assets/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
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
    },
  },
];
