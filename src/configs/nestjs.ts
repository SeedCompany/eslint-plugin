import { Linter } from 'eslint';

/**
 * The config for nestjs projects
 */
export const config: Linter.Config = {
  extends: 'plugin:@seedcompany/node',
  rules: {
    // This gives false positives for NestJS modules
    '@typescript-eslint/no-extraneous-class': 'off',
  },
};
