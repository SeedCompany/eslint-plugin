/* eslint-disable @typescript-eslint/no-var-requires */
import type { RuleModule } from '@typescript-eslint/experimental-utils/dist/ts-eslint/Rule';
import { ImportDeclaration } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import type {
  Node,
  Program,
} from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';

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
          const existing = token.body.find(
            (s) => isImportDeclaration(s) && s.source.value === 'react'
          );
          if (!existing) {
            return fixer.insertTextBefore(
              token,
              `import React from 'react';\n`
            );
          }
          const range = existing.range;
          return fixer.replaceTextRange(
            [range[0], range[0] + 6],
            'import React,'
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

const isImportDeclaration = (node: Node): node is ImportDeclaration =>
  node.type === 'ImportDeclaration';
