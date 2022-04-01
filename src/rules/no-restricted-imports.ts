import { TSESTree } from '@typescript-eslint/utils';
import { JSONSchema4 } from '@typescript-eslint/utils/dist/json-schema';
import { RuleModule } from '@typescript-eslint/utils/dist/ts-eslint';
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
      declaration: Declaration,
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
      });
    };

    return {
      ImportDeclaration: checkNode,
      ExportNamedDeclaration: checkNode,
      ExportAllDeclaration: checkNode,
    };
  },
};

const castArray = <T>(arr: T | readonly T[] | null | undefined): T[] =>
  !arr ? [] : Array.isArray(arr) ? arr : [arr];
