import baseRule from '@typescript-eslint/eslint-plugin/dist/rules/no-unused-vars';
import {
  ReportDescriptor,
  RuleModule,
} from '@typescript-eslint/experimental-utils/dist/ts-eslint/Rule';
import type {
  BaseNode,
  Comment,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportSpecifier as ImportNamedSpecifier,
  Node,
  Token,
} from '@typescript-eslint/types/dist/ts-estree';
import { Mutable } from 'type-fest';

type ImportSpecifier = ImportNamedSpecifier | ImportDefaultSpecifier;

export const noUnusedVars: RuleModule<string, any[]> = {
  meta: {
    ...baseRule.meta,
    fixable: 'code',
  },
  create(context) {
    const report = (descriptor: ReportDescriptor<string>) => {
      const node = ((descriptor as unknown) as { node?: Node }).node;
      if (!node) {
        return;
      }
      if (
        !isImportDeclaration(node) &&
        (!node.parent || !isImportSpecifier(node.parent))
      ) {
        context.report(descriptor);
        return;
      }

      (descriptor as Mutable<typeof descriptor>).fix = (fixer) => {
        if (isImportDeclaration(node)) {
          return fixer.remove(node);
        }

        const sourceCode = context.getSourceCode();
        const unusedImport = node.parent as ImportSpecifier;
        const declaration = unusedImport.parent as ImportDeclaration;
        const { specifiers: imports } = declaration;

        const removeBetween = (start: BaseNode | null, end: BaseNode | null) =>
          start && end
            ? fixer.removeRange([start.range[0], end.range[1]])
            : null;

        // Import is not last, remove it and the following comma
        if (unusedImport !== imports[imports.length - 1]) {
          return removeBetween(
            unusedImport,
            sourceCode.getTokenAfter(unusedImport, isComma)
          );
        }

        // Import is the only named import...
        if (imports.filter(isNamedImportSpecifier).length === 1) {
          // ...following a default import
          // ex. "import default, { unused } from 'module';"
          if (imports.some(isDefaultImportSpecifier)) {
            return removeBetween(
              sourceCode.getTokenBefore(unusedImport, isComma),
              sourceCode.getTokenAfter(unusedImport, isClosingBracket)
            );
          }
          // ...in the declaration
          // ex. "import { unused } from 'module';"
          return fixer.remove(declaration);
        }

        // Import is last following another, remove it and the comma before it
        return removeBetween(
          sourceCode.getTokenBefore(unusedImport, isComma),
          unusedImport
        );
      };

      context.report(descriptor);
    };

    const contextForBaseRule = Object.create(context, {
      report: {
        value: report,
        writable: false,
      },
    });
    return baseRule.create(contextForBaseRule);
  },
};

const isImportDeclaration = (node: Node): node is ImportDeclaration =>
  node.type === 'ImportDeclaration';

const isImportSpecifier = (node: Node) =>
  isNamedImportSpecifier(node) || isDefaultImportSpecifier(node);

const isNamedImportSpecifier = (node: Node): node is ImportSpecifier =>
  node.type === 'ImportSpecifier';

const isDefaultImportSpecifier = (node: Node): node is ImportDefaultSpecifier =>
  node.type === 'ImportDefaultSpecifier';

const isComma = (token: Token | Comment) => token.value === ',';

const isClosingBracket = (token: Token | Comment) => token.value === '}';
