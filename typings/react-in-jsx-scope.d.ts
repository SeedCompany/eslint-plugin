/* eslint-disable import-helpers/order-imports,import/no-duplicates */
declare module 'eslint-plugin-react/lib/rules/react-in-jsx-scope' {
  import { RuleModule } from '@typescript-eslint/experimental-utils/dist/ts-eslint/Rule';

  const rule: RuleModule<string, any[]>;
  export = rule;
}
declare module 'eslint-plugin-react/lib/util/pragma' {
  import { RuleContext } from '@typescript-eslint/experimental-utils/dist/ts-eslint';

  export function getFromContext(context: RuleContext<any, any>): string;
}

declare module 'eslint-plugin-react/lib/util/variable' {
  import {
    RuleContext,
    Scope,
  } from '@typescript-eslint/experimental-utils/dist/ts-eslint';

  export function findVariable(
    variables: Scope.Variable[],
    name: string
  ): boolean;
  export function variablesInScope(
    context: RuleContext<any, any>
  ): Scope.Variable[];
}
