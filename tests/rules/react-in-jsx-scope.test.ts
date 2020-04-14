import { rule } from '../../src/rules/react-in-jsx-scope';
import { RuleTester } from '../RuleTester';

const tester = new RuleTester({
  parserOptions: {
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

tester.run('@seedcompany/react-in-jsx-scope', rule, {
  valid: [],
  invalid: [
    {
      code: `
export const Component = () => <div><div /></div>;
`,
      output: `
import React from 'react';
export const Component = () => <div><div /></div>;
`,
      errors: [
        {
          messageId: 'notDefined',
          line: 2,
          column: 32,
        },
        {
          messageId: 'notDefined',
          line: 2,
          column: 37,
        },
      ],
    },
  ],
});
