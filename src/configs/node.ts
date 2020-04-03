import { Linter } from 'eslint';

/**
 * These rules should be able to be applied ot any node context
 */
export const config: Linter.Config = {
  extends: 'plugin:seedco/base',
  rules: {
    // Server side code should never have floating promises
    '@typescript-eslint/no-floating-promises': 'error',
  },
};
