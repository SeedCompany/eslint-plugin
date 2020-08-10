import { Linter } from 'eslint';

/**
 * These rules should be able to be applied ot any node context
 */
export const config: Linter.Config = {
  extends: 'plugin:@seedcompany/base',
  rules: {},
};
