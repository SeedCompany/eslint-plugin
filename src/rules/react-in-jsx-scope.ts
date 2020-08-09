/* eslint-disable @typescript-eslint/no-var-requires */
import type { RuleModule } from '@typescript-eslint/experimental-utils/dist/ts-eslint/Rule';
import type { Node, Program } from '@typescript-eslint/types/dist/ts-estree';

import baseRule = require('eslint-plugin-react/lib/rules/react-in-jsx-scope');
import pragmaUtil = require('eslint-plugin-react/lib/util/pragma');
import variableUtil = require('eslint-plugin-react/lib/util/variable');

export const rule: RuleModule<string, any[]> = {
  meta: {
    ...baseRule.meta,
    messages: {
      notDefined: `'{{name}}' must be in scope when using JSX`,
    },
    fixable: 'code',
  },
  create(context) {
    const pragma = pragmaUtil.getFromContext(context);

    function checkIfReactIsInScope(node: Node) {
      const variables = variableUtil.variablesInScope(context);
      if (variableUtil.findVariable(variables, pragma)) {
        return;
      }
      context.report({
        node,
        messageId: 'notDefined',
        data: {
          name: pragma,
        },
        fix: (fixer) => {
          const token = context.getAncestors()[0] as Program;
          return fixer.insertTextBefore(
            token,
            `import * as React from 'react';\n`
          );
        },
      });
    }

    return {
      JSXOpeningElement: checkIfReactIsInScope,
      JSXOpeningFragment: checkIfReactIsInScope,
    };
  },
};
