import { stripIndent as ts } from 'common-tags';
import { ImportRestriction, rule } from '../../src/rules/no-restricted-imports';
import { InvalidTestCaseOf, RuleTester } from '../RuleTester';

const imports = {
  a: ts`import 'foo';`,
  b: ts`import def from 'foo';`,
  c: ts`import * as all from 'foo';`,
  d: ts`import { bad } from 'foo';`,
  e: ts`import { bad, two } from 'foo';`,
  l: ts`import { first, bad } from 'foo';`,
  f: ts`import def, { bad } from 'foo';`,
  g: ts`import def, * as all from 'foo';`,
  h: ts`export { bad } from 'foo';`,
  i: ts`export { bad, two } from 'foo';`,
  j: ts`export * from 'foo';`,
  k: ts`export * as ns from 'foo';`,
};

const c = <T extends ImportRestriction>(t: T) => t;

const configs = {
  // path1 -> path2
  a: c({
    path: 'foo',
    replacement: () => ({ path: 'bar' }),
  }),
  // name1 -> name2
  b: c({
    path: 'foo',
    importNames: ['bad'],
    replacement: { specifiers: { bad: 'good' } },
  }),
  // name1 path1 -> name2 path2
  c: c({
    path: 'foo',
    importNames: ['bad'],
    replacement: { path: 'bar', specifiers: { bad: 'good' } },
  }),
  // name1 path1 -> name1 path2
  h: c({
    path: 'foo',
    importNames: 'bad',
    replacement: { path: 'bar' },
  }),
  // name1 -> default1
  d: c({
    path: 'foo',
    importNames: 'bad',
    replacement: { specifiers: { bad: 'default' } },
  }),
  // default -> name1
  e: c({
    path: 'foo',
    importNames: 'default',
    replacement: { specifiers: { default: 'good' } },
  }),
  // name1 path1 -> default1 path2
  f: c({
    path: 'foo',
    importNames: 'bad',
    replacement: { path: 'bar', specifiers: { bad: 'default' } },
  }),
  // default path1 -> name1 path2
  g: c({
    path: 'foo',
    importNames: 'default',
    replacement: { path: 'bar', specifiers: { default: 'good' } },
  }),
};

type Case = [
  code: keyof typeof imports,
  config: keyof typeof configs,
  output: string | null,
  other?: Partial<InvalidTestCaseOf<typeof rule>>
];

const cases: Case[] = [
  ['a', 'a', ts`import 'bar';`],
  ['a', 'b', null, { errors: 0 }],
  ['a', 'c', null, { errors: 0 }],
  ['a', 'd', null, { errors: 0 }],
  ['a', 'e', null, { errors: 0 }],
  ['a', 'f', null, { errors: 0 }],
  ['a', 'g', null, { errors: 0 }],
  ['a', 'h', null, { errors: 0 }],

  ['b', 'a', ts`import def from 'bar';`],
  ['b', 'b', null, { errors: 0 }],
  ['b', 'c', null, { errors: 0 }],
  ['b', 'h', null, { errors: 0 }],
  ['b', 'd', null, { errors: 0 }],
  ['b', 'e', ts`import { good as def } from 'foo';`],
  ['b', 'f', null, { errors: 0 }],
  ['b', 'g', ts`import { good as def } from 'bar';`],

  ['c', 'a', ts`import * as all from 'bar';`],
  ['c', 'b', null],
  ['c', 'c', null],
  ['c', 'd', null],
  ['c', 'e', null],
  ['c', 'f', null],
  ['c', 'g', null],
  ['c', 'h', null],

  ['d', 'a', ts`import { bad } from 'bar';`],
  ['d', 'b', ts`import { good as bad } from 'foo';`],
  ['d', 'c', ts`import { good as bad } from 'bar';`],
  ['d', 'h', ts`import { bad } from 'bar';`],
  ['d', 'd', ts`import bad from 'foo';`],
  ['d', 'e', null, { errors: 0 }],
  ['d', 'f', ts`import bad from 'bar';`],
  ['d', 'g', null, { errors: 0 }],

  ['e', 'a', ts`import { bad, two } from 'bar';`],
  ['e', 'b', ts`import { good as bad, two } from 'foo';`],
  [
    'e',
    'c',
    ts`
      import { two } from 'foo';
      import { good as bad } from 'bar';
    `,
  ],
  [
    'e',
    'h',
    ts`
      import { two } from 'foo';
      import { bad } from 'bar';
    `,
  ],
  ['e', 'd', ts`import bad, { two } from 'foo';`],
  ['e', 'e', null, { errors: 0 }],
  [
    'e',
    'f',
    ts`
      import { two } from 'foo';
      import bad from 'bar';
    `,
  ],
  ['e', 'g', null, { errors: 0 }],

  ['l', 'a', ts`import { first, bad } from 'bar';`],
  ['l', 'b', ts`import { first, good as bad } from 'foo';`],
  [
    'l',
    'c',
    ts`
      import { first } from 'foo';
      import { good as bad } from 'bar';
    `,
  ],
  [
    'l',
    'h',
    ts`
      import { first } from 'foo';
      import { bad } from 'bar';
    `,
  ],
  ['l', 'd', ts`import bad, { first } from 'foo';`],
  ['l', 'e', null, { errors: 0 }],
  [
    'l',
    'f',
    ts`
      import { first } from 'foo';
      import bad from 'bar';
    `,
  ],
  ['l', 'g', null, { errors: 0 }],

  ['f', 'a', ts`import def, { bad } from 'bar';`],
  ['f', 'b', ts`import def, { good as bad } from 'foo';`],
  [
    'f',
    'c',
    ts`
      import def from 'foo';
      import { good as bad } from 'bar';
    `,
  ],
  [
    'f',
    'h',
    ts`
      import def from 'foo';
      import { bad } from 'bar';
    `,
  ],
  ['f', 'd', null],
  ['f', 'e', ts`import { good as def, bad } from 'foo';`],
  ['f', 'f', null],
  [
    'f',
    'g',
    ts`
      import { bad } from 'foo';
      import { good as def } from 'bar';
    `,
  ],

  ['g', 'a', ts`import def, * as all from 'bar';`, { errors: 2 }],
  ['g', 'b', null],
  ['g', 'c', null],
  ['g', 'h', null],
  ['g', 'd', null],
  [
    'g',
    'e',
    ts`
      import * as all from 'foo';
      import { good as def } from 'foo';
    `,
    { errors: 2 },
  ],
  ['g', 'f', null],
  [
    'g',
    'g',
    ts`
      import * as all from 'foo';
      import { good as def } from 'bar';
    `,
    { errors: 2 },
  ],

  ['h', 'a', ts`export { bad } from 'bar';`],
  ['h', 'b', ts`export { good as bad } from 'foo';`],
  ['h', 'c', ts`export { good as bad } from 'bar';`],
  ['h', 'h', ts`export { bad } from 'bar';`],
  ['h', 'd', ts`export { default as bad } from 'foo';`],
  ['h', 'e', null, { errors: 0 }],
  ['h', 'f', ts`export { default as bad } from 'bar';`],
  ['h', 'g', null, { errors: 0 }],

  ['i', 'a', ts`export { bad, two } from 'bar';`],
  ['i', 'b', ts`export { good as bad, two } from 'foo';`],
  [
    'i',
    'c',
    ts`
      export { two } from 'foo';
      export { good as bad } from 'bar';
    `,
  ],
  [
    'i',
    'h',
    ts`
      export { two } from 'foo';
      export { bad } from 'bar';
    `,
  ],
  ['i', 'd', ts`export { default as bad, two } from 'foo';`],
  ['i', 'e', null, { errors: 0 }],
  [
    'i',
    'f',
    ts`
      export { two } from 'foo';
      export { default as bad } from 'bar';
    `,
  ],
  ['i', 'g', null, { errors: 0 }],

  ['j', 'a', ts`export * from 'bar';`],
  ['j', 'b', null],
  ['j', 'c', null],
  ['j', 'd', null],
  ['j', 'e', null],
  ['j', 'f', null],
  ['j', 'g', null],
  ['j', 'h', null],

  ['k', 'a', ts`export * as ns from 'bar';`],
  ['k', 'b', null],
  ['k', 'c', null],
  ['k', 'd', null],
  ['k', 'e', null],
  ['k', 'f', null],
  ['k', 'g', null],
  ['k', 'h', null],
];

new RuleTester().run('@seedcompany/no-restricted-imports', rule, {
  valid: [],
  invalid: [
    ...cases.flatMap(([code, config, output, rest]) => {
      if (rest?.errors === 0) {
        return [];
      }
      return {
        name: `${code}${config}) ${imports[code]} -> ${output ?? 'no autofix'}`,
        ...rest,
        code: imports[code],
        output,
        options: [configs[config]],
        errors: rest?.errors ?? 1,
      };
    }),
  ],
});
