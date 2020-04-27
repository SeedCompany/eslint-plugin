declare module '@typescript-eslint/eslint-plugin/dist/rules/no-unused-vars-experimental' {
  import { RuleModule } from '@typescript-eslint/experimental-utils/dist/ts-eslint/Rule';

  const rule: RuleModule<string, any[]>;
  // eslint-disable-next-line import/no-default-export
  export default rule;
}
