import {
  AST_TOKEN_TYPES,
  type ExportAllDeclaration,
  type StringLiteral,
} from '@typescript-eslint/types/dist/generated/ast-spec';
import type { TSESTree } from '@typescript-eslint/utils';
import type { JSONSchema4 } from '@typescript-eslint/utils/dist/json-schema';
import type {
  RuleModule,
  SourceCode,
} from '@typescript-eslint/utils/dist/ts-eslint';
import type { AST } from '@typescript-eslint/utils/dist/ts-eslint/AST';
import type { RuleFixer } from '@typescript-eslint/utils/dist/ts-eslint/Rule';
import ignore, { Ignore } from 'ignore';
import { Merge } from 'type-fest';

type ImportKind = 'type' | 'value';

export interface ImportRestriction {
  /** Identify restriction by these paths */
  path?: string | string[];
  /** Identify restriction by these patterns */
  pattern?: string | string[];
  /** Limit restriction to only type or value imports only */
  kind?: ImportKind;
  /** Limit restriction to only these names/specifiers */
  importNames?: string | string[];
  message?: string;
  replacement?: ReplacementOrFn;
}

export type ReplacementOrFn =
  | Replacement
  | ((args: {
      specifier?: string;
      path: string;
    }) => Omit<Replacement, 'specifiers'> & { specifier?: string });

interface Replacement {
  /**
   * The new replacement path
   */
  path?: string;
  /**
   * A mapping of restricted specifiers to their replacement names.
   * Any omissions here will leave the specifier unchanged.
   */
  specifiers?: Record<string, string>;
}

type ResolvedImportRestriction = Merge<
  ImportRestriction,
  {
    path: Set<string>;
    pattern?: Ignore;
    importNames?: Set<string>;
  }
>;

type Declaration =
  | TSESTree.ImportDeclaration
  | TSESTree.ExportNamedDeclaration
  | TSESTree.ExportAllDeclaration;
type Specifier =
  | TSESTree.ImportSpecifier
  | TSESTree.ImportNamespaceSpecifier
  | TSESTree.ImportDefaultSpecifier
  | TSESTree.ExportSpecifier;

const string: JSONSchema4 = { type: 'string', minLength: 1 };
const oneOrMore = (schema: JSONSchema4) => ({
  anyOf: [
    schema,
    {
      type: 'array',
      items: schema,
      minItems: 1,
      uniqueItems: true,
    },
  ],
});
const oneOrMoreStrings = oneOrMore(string);

const importKind: JSONSchema4 = {
  type: 'string',
  enum: ['value', 'type'],
};
const schema: JSONSchema4 = {
  type: 'array',
  items: [
    {
      type: 'object',
      properties: {
        path: oneOrMoreStrings,
        pattern: oneOrMoreStrings,
        kind: importKind,
        importNames: oneOrMoreStrings,
        message: string,
        replacement: {}, // "any" to allow functions
      },
      additionalProperties: false,
    },
  ],
  minItems: 0,
};

const messages = {
  path: "'{{importSource}}' import is restricted from being used.",
  pathWithCustomMessage: '{{customMessage}}',

  everything: "'{{importName}}' import from '{{importSource}}' is restricted.",
  everythingWithCustomMessage: '{{customMessage}}',

  specifier: "'{{importName}}' import from '{{importSource}}' is restricted.",
  specifierWithCustomMessage: '{{customMessage}}',
};

export const noRestrictedImports: RuleModule<
  keyof typeof messages,
  ImportRestriction[]
> = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages,
    schema,
  },

  create(context) {
    const sourceCode = context.getSourceCode();
    const options = context.options;
    if (options.length === 0) {
      return {};
    }

    const resolved = options
      .map(
        (opt): ResolvedImportRestriction => ({
          ...opt,
          path: new Set<string>(castArray(opt.path)),
          pattern:
            opt.pattern && opt.pattern.length > 0
              ? ignore({
                  allowRelativePaths: true,
                  ignorecase: false, // import names are case-sensitive
                }).add(castArray(opt.pattern))
              : undefined,
          importNames:
            opt.importNames && opt.importNames.length > 0
              ? new Set(castArray(opt.importNames))
              : undefined,
        })
      )
      .filter((opt) => opt.pattern || opt.path.size > 0);

    /**
     * Checks a node to see if any problems should be reported.
     */
    const checkNode = (node: Declaration) => {
      if (!node.source) {
        return;
      }
      const importSource = node.source.value;

      // Skip `import {} from '..'` as it's unused and should be removed by another rule.
      if (
        node.type === 'ImportDeclaration' &&
        node.specifiers.length === 0 &&
        /import\s*{\s*}\s*from\s*.+/.test(sourceCode.getText(node))
      ) {
        return;
      }

      const restrictions = resolved.filter((opt) => {
        if (opt.path.has(importSource)) {
          return true;
        }
        if (!opt.pattern) {
          return false;
        }
        return opt.pattern.ignores(importSource);
      });
      if (restrictions.length === 0) {
        return;
      }

      const specifiers: Specifier[] =
        node.type === 'ExportAllDeclaration' ? [] : node.specifiers;

      let declarationKind =
        node.type === 'ImportDeclaration' ? node.importKind : node.exportKind;
      const specifierKinds = new Set(
        specifiers.map((specifier) =>
          specifier.type === 'ExportSpecifier'
            ? specifier.exportKind
            : specifier.type === 'ImportSpecifier'
            ? specifier.importKind
            : declarationKind
        )
      );
      // Treat these the same:
      // import { type Foo } from 'foo';
      // import type { Foo } from 'foo';
      if (specifierKinds.size > 0 && !specifierKinds.has('value')) {
        declarationKind = 'type';
      }

      for (const specifier of specifiers) {
        if (node.type === 'ExportAllDeclaration') {
          continue; // will never get here, just for types
        }
        checkSpecifier(specifier, node, declarationKind, restrictions);
      }

      if (
        node.type === 'ExportAllDeclaration' ||
        node.specifiers[0]?.type !== 'ImportNamespaceSpecifier'
      ) {
        checkDeclaration(node, declarationKind, restrictions);
      }
    };

    const checkSpecifier = (
      node: Specifier,
      declaration: Exclude<Declaration, ExportAllDeclaration>,
      declarationKind: ImportKind,
      restrictions: ResolvedImportRestriction[]
    ) => {
      const [importName, kind] =
        node.type === 'ImportSpecifier'
          ? [
              node.imported.name,
              declarationKind === 'type' ? 'type' : node.importKind,
            ]
          : node.type === 'ImportDefaultSpecifier'
          ? ['default', declarationKind]
          : node.type === 'ImportNamespaceSpecifier'
          ? ['*', declarationKind]
          : [
              node.local.name,
              declarationKind === 'type' ? 'type' : node.exportKind,
            ];

      const match = restrictions.find(
        (res) =>
          (importName === '*' || res.importNames?.has(importName)) &&
          (res.kind ? res.kind === kind : true)
      );
      if (!match) {
        return;
      }

      context.report({
        node: match.importNames ? node : declaration,
        messageId: `${
          match.importNames
            ? node.type === 'ImportNamespaceSpecifier'
              ? 'everything'
              : 'specifier'
            : 'path'
        }${match.message ? 'WithCustomMessage' : ''}`,
        data: {
          importSource: declaration.source!.value,
          importName:
            importName === '*'
              ? match.importNames
                ? [...match.importNames].join(',')
                : '*'
              : importName,
          customMessage: match.message,
        },
        fix: (fixer) => {
          if (!match.replacement) {
            return null;
          }

          const replacement = resolveReplacement(
            match.replacement,
            importName,
            declaration
          );

          if (
            replacement.specifier === 'default' &&
            declaration.specifiers.some(
              (s) => s.type === 'ImportDefaultSpecifier'
            )
          ) {
            // Import already has default, let human fix.
            return null;
          }

          if (node.type === 'ImportNamespaceSpecifier') {
            if (match.importNames) {
              // Not worth trying to figure this out, namespace imports are rare
              // anyway.
              return null;
            }
            return replacement.path
              ? fixPath(fixer, declaration.source, replacement.path)
              : null;
          }

          const onlyOne = declaration.specifiers.length === 1;
          const isLast =
            declaration.specifiers[declaration.specifiers.length - 1] === node;

          if (replacement.path) {
            if (!replacement.specifier) {
              return fixer.replaceTextRange(
                declaration.source!.range,
                replacement.path
              );
            }

            const newImportSpecifier =
              replacement.specifier === 'default' &&
              node.type !== 'ExportSpecifier'
                ? node.local.name
                : `{ ${replacement.specifier} as ${node.local.name} }`;
            const keyword =
              node.type === 'ExportSpecifier' ? 'export' : 'import';
            const newStatement = `${keyword} ${newImportSpecifier} from '${replacement.path}';`;

            if (onlyOne) {
              return fixer.replaceText(declaration, newStatement);
            }

            const removalRange = maybeRangeOf(
              isLast ? sourceCode.getTokenBefore(node, isComma) : node,
              isLast
                ? sourceCode.getTokenAfter(node, isClosingBracket)
                : tokenAfterComma(sourceCode, node) ?? node
            );
            if (!removalRange) {
              return null;
            }

            return [
              fixer.removeRange(removalRange),
              fixer.insertTextAfter(declaration, '\n' + newStatement),
            ];
          } else if (replacement.specifier) {
            const oldIsDefault = node.type === 'ImportDefaultSpecifier';
            const newIsDefault = replacement.specifier === 'default';

            if (node.type === 'ExportSpecifier') {
              return fixer.replaceText(
                node,
                `${replacement.specifier} as ${node.local.name}`
              );
            }

            if (onlyOne && newIsDefault) {
              const newSpecifier = node.local.name;

              const openingBracket = sourceCode.getTokenBefore(
                node,
                isOpeningBracket
              );
              const closingBracket = sourceCode.getTokenAfter(
                node,
                isClosingBracket
              );
              const brackets = maybeRangeOf(openingBracket, closingBracket);
              if (!brackets) {
                return null;
              }
              return fixer.replaceTextRange(brackets, newSpecifier);
            } else if (newIsDefault) {
              const openingBracket = sourceCode.getTokenBefore(
                node,
                isOpeningBracket
              );
              if (!openingBracket) {
                return null;
              }
              const removal = maybeRangeOf(
                isLast ? sourceCode.getTokenBefore(node, isComma) : node,
                tokenAfterComma(sourceCode, node) ?? node
              );
              if (!removal) {
                return null;
              }
              return [
                fixer.insertTextBefore(openingBracket, node.local.name + ', '),
                fixer.removeRange(removal),
              ];
            } else if (oldIsDefault && onlyOne) {
              const newSpecifier = `${replacement.specifier} as ${node.local.name}`;
              return fixer.replaceText(node, `{ ${newSpecifier} }`);
            } else if (oldIsDefault) {
              const removalRange = maybeRangeOf(
                node,
                tokenAfterComma(sourceCode, node)
              );
              if (!removalRange) {
                return null;
              }
              const removeOldDefault = fixer.removeRange(removalRange);
              const otherIsNs = declaration.specifiers.some(
                (sp) => sp.type === 'ImportNamespaceSpecifier'
              );
              if (otherIsNs) {
                return [
                  removeOldDefault,
                  fixer.insertTextAfter(
                    declaration,
                    `\nimport { ${replacement.specifier} as ${
                      node.local.name
                    } } from '${declaration.source!.value}';`
                  ),
                ];
              }
              const openingBracket = sourceCode.getTokenAfter(
                node,
                isOpeningBracket
              );
              if (!openingBracket) {
                return null;
              }
              return [
                removeOldDefault,
                fixer.insertTextAfter(
                  openingBracket,
                  ` ${replacement.specifier} as ${node.local.name},`
                ),
              ];
            }

            const newSpecifier = `${replacement.specifier} as ${node.local.name}`;
            return fixer.replaceText(node, newSpecifier);
          }

          return [];
        },
      });
    };

    const checkDeclaration = (
      node: Declaration,
      declarationKind: ImportKind,
      restrictions: ResolvedImportRestriction[]
    ) => {
      const match = restrictions.find(
        (res) =>
          (!res.importNames || node.type === 'ExportAllDeclaration') &&
          (res.kind ? res.kind === declarationKind : true)
      );
      if (!match) {
        return;
      }

      context.report({
        node,
        messageId: `${match.importNames ? 'specifier' : 'path'}${
          match.message ? 'WithCustomMessage' : ''
        }`,
        data: {
          importSource: node.source!.value,
          customMessage: match.message,
        },
        fix: (fixer) => {
          if (!match.replacement) {
            return null;
          }

          const replacement =
            typeof match.replacement === 'function'
              ? match.replacement({
                  path: node.source!.value,
                })
              : match.replacement;

          if (node.type === 'ExportAllDeclaration') {
            if (match.importNames) {
              // Not worth trying to figure this out, namespace imports are rare
              // anyway.
              return null;
            }
            return replacement.path
              ? fixPath(fixer, node.source, replacement.path)
              : null;
          }

          if (replacement.path) {
            return fixPath(fixer, node.source, replacement.path);
          }

          return null;
        },
      });
    };

    return {
      ImportDeclaration: checkNode,
      ExportNamedDeclaration: checkNode,
      ExportAllDeclaration: checkNode,
    };
  },
};

const fixPath = (fixer: RuleFixer, node: StringLiteral | null, path: string) =>
  node ? fixer.replaceText(node, `'${path}'`) : null;

const maybeRangeOf = (
  start: TSESTree.Node | TSESTree.Token | number | null | undefined,
  end: TSESTree.Node | TSESTree.Token | number | null | undefined
): Readonly<AST.Range> | null => (start && end ? rangeOf(start, end) : null);
const rangeOf = (
  start: TSESTree.Node | TSESTree.Token | number,
  end: TSESTree.Node | TSESTree.Token | number
): Readonly<AST.Range> => [
  typeof start === 'number' ? start : start.range[0],
  typeof end === 'number' ? end : end.range[1],
];

const resolveReplacement = (
  replacement: ReplacementOrFn,
  importName: string,
  declaration: Declaration
) => {
  if (typeof replacement === 'function') {
    return replacement({
      specifier: importName,
      path: declaration.source!.value,
    });
  }
  const { specifiers, ...rest } = replacement;
  return {
    ...rest,
    specifier: specifiers?.[importName],
  };
};

const castArray = <T>(arr: T | readonly T[] | null | undefined): T[] =>
  !arr ? [] : Array.isArray(arr) ? arr : [arr];

const tokenAfterComma = (code: SourceCode, node: TSESTree.Node) => {
  const token = code.getTokenAfter(
    node,
    (token) => isComma(token) || isFromKeyword(token)
  );
  if (!token || token.value === 'from') {
    return null;
  }
  return token.range[1] + (code.text[token.range[1]] === ' ' ? 1 : 0);
};

const isFromKeyword = (token: TSESTree.Comment | TSESTree.Token) =>
  token.type === AST_TOKEN_TYPES.Keyword && token.value === 'from';
const isComma = (token: TSESTree.Comment | TSESTree.Token) =>
  token.value === ',';
const isOpeningBracket = (token: TSESTree.Comment | TSESTree.Token) =>
  token.value === '{';
const isClosingBracket = (token: TSESTree.Comment | TSESTree.Token) =>
  token.value === '}';
