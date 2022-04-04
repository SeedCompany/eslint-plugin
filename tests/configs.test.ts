import { ESLint } from 'eslint';
import * as configs from '../src/configs';

test.each(Object.entries(configs))('%s', async (name, config) => {
  const linter = new ESLint({
    baseConfig: config,
    useEslintrc: false,
    cwd: __dirname,
  });
  const [results] = await linter.lintFiles([`../src/configs/${name}.ts`]);
  expect(results!.messages.map((m) => m.message)).toEqual([]);
  expect(results!.usedDeprecatedRules).toHaveLength(0);
});
