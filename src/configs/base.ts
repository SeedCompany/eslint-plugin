import { Linter } from 'eslint';

/**
 * These rules should be able to be applied everywhere: browser, node, lambdas, etc.
 */
export const config: Linter.Config = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    project: 'tsconfig.json',
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'import-helpers',
    'prettier',
    '@seedcompany',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  rules: {
    // region typescript-eslint

    // region recommended rules - deprecated
    '@typescript-eslint/ban-ts-ignore': 'off',
    '@typescript-eslint/ban-ts-comment': 'error',

    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/class-name-casing': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/naming-convention': 'off', // TODO
    // endregion

    // region recommended rules - tweaks
    '@typescript-eslint/consistent-type-assertions': [
      'error',
      {
        assertionStyle: 'as',
        // disallow since it hides errors (required fields that are missing)
        objectLiteralTypeAssertions: 'never',
      },
    ],
    '@typescript-eslint/no-use-before-define': [
      'error',
      // This disallows referencing before declaration (stricter, not looser)
      { functions: false, classes: false, variables: false, typedefs: false },
    ],
    // Replacing with our own
    '@typescript-eslint/no-unused-vars': 'off',
    '@seedcompany/no-unused-vars': [
      'warn',
      {
        ignoreArgsIfArgsAfterAreUsed: true,
      },
    ],
    '@typescript-eslint/unbound-method': [
      'error',
      // We'll assume statics don't need scope, so don't need to be bound
      // We should have another lint rule to enforce static methods have
      // (this: unknown) so `this` isn't misused
      { ignoreStatic: true },
    ],
    // endregion

    // region recommended rules - loosening
    // Allow return types to be inferred
    '@typescript-eslint/explicit-function-return-type': 'off',
    // This is too invasive. Usage is discouraged though.
    '@typescript-eslint/no-explicit-any': 'off',
    // Loosen because we are still smarter than the compiler sometimes
    '@typescript-eslint/no-non-null-assertion': 'off',
    // I think we should be able to define async functions without using await.
    // We are defining the contract and setting up usages to be async which
    // requires design work. async code could come later.
    '@typescript-eslint/require-await': 'off',
    // endregion

    // region other rules
    '@typescript-eslint/array-type': [
      'warn',
      // Simple is more friendly until generics are thrown in
      { default: 'array-simple' },
    ],
    '@typescript-eslint/consistent-type-definitions': 'error',
    '@typescript-eslint/explicit-member-accessibility': [
      'warn',
      // public is default, omit it. Follows same thought process as inferred types.
      // This doesn't need an override for parameter properties, because those
      // should always be readonly.
      { accessibility: 'no-public' },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    '@typescript-eslint/no-throw-literal': 'error',
    '@typescript-eslint/no-unused-expressions': [
      'warn',
      {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true,
      },
    ],
    'no-useless-constructor': 'off', // replace with TS version
    '@typescript-eslint/no-useless-constructor': 'error',
    '@typescript-eslint/no-unnecessary-qualifier': 'warn',
    '@typescript-eslint/no-unnecessary-type-arguments': 'warn',
    '@typescript-eslint/prefer-for-of': 'error',
    '@typescript-eslint/prefer-function-type': 'error',
    // '@typescript-eslint/prefer-nullish-coalescing': 'warn', // TODO Research
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/prefer-readonly': 'warn',
    // This doesn't seem to add a lot of value, and is annoying with arrow functions
    // common example: Promise.all(item => handle(item))
    // If we do re-enable I would consider with the option `checkArrowFunctions: false`
    '@typescript-eslint/promise-function-async': 'off',
    '@typescript-eslint/require-array-sort-compare': 'error',
    // This importantly catches promises inside of try/catch/finally statements
    // and is the only tool that enforces correct usage. It also removes awaits
    // from returns for all other usages, which I would be ok ignoring but is
    // not an option. I guess it's good for consistency and catching the
    // missing await in try/catches is worth it.
    '@typescript-eslint/return-await': 'error',
    '@typescript-eslint/restrict-plus-operands': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/unified-signatures': 'error',
    // endregion

    // endregion

    // region Rules taken from Create React App which apply everywhere
    // Some have been omitted if they are already covered by
    // TypeScript, Prettier, or other configured rules
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-caller': 'warn',
    'no-cond-assign': 'error',
    'no-control-regex': 'warn',
    'no-eval': 'warn',
    'no-extend-native': 'warn',
    'no-extra-bind': 'warn',
    'no-extra-label': 'warn',
    'no-implied-eval': 'warn',
    'no-labels': 'warn',
    'no-lone-blocks': 'warn',
    'no-loop-func': 'warn',
    'no-mixed-operators': [
      'warn',
      {
        groups: [
          ['&', '|', '^', '~', '<<', '>>', '>>>'],
          ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
          ['&&', '||'],
          ['in', 'instanceof'],
        ],
        allowSamePrecedence: false,
      },
    ],
    'no-multi-str': 'warn',
    'no-new-func': 'warn',
    'no-new-object': 'warn',
    'no-new-wrappers': 'warn',
    'no-octal-escape': 'warn',
    'no-script-url': 'warn',
    'no-self-compare': 'warn',
    'no-sequences': 'warn',
    'no-template-curly-in-string': 'warn',
    'no-throw-literal': 'warn',
    'no-useless-computed-key': 'warn',
    'no-useless-concat': 'warn',
    'no-useless-rename': 'warn',
    strict: ['warn', 'never'],
    'unicode-bom': ['warn', 'never'],
    // endregion

    // region Import/Export rules
    // TS handles errors, so these are just for styling
    'import/first': 'warn',
    'import/newline-after-import': 'warn',
    // 'import/no-default-export': 'warn', // For the most part yes
    'import/no-useless-path-segments': 'warn',
    'import/no-duplicates': 'warn',
    // Orders import statements
    'import-helpers/order-imports': [
      'warn',
      {
        newlinesBetween: 'never',
        groups: ['module', 'absolute', ['parent', 'sibling', 'index']],
        alphabetize: {
          order: 'asc',
          ignoreCase: true,
        },
      },
    ],
    // Alphabetizes imports within modules (curly brackets)
    'sort-imports': [
      'warn',
      {
        // leave it to import-helpers/order-imports
        ignoreDeclarationSort: true,
        // a,Z instead of Z,a
        ignoreCase: true,
      },
    ],
    // endregion

    'prettier/prettier': 'warn',
  },
};
