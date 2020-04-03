import { CLIEngine } from 'eslint';
import * as configs from '.';

test.each(Object.entries(configs))('%s', (name, config) => {
  const engine = new CLIEngine({
    baseConfig: config,
    useEslintrc: false,
    cwd: __dirname,
  });
  const result = engine.executeOnFiles([`./${name}.ts`]);
  expect(result.results).toHaveLength(1);
  expect(result.results[0].messages.map((m) => m.message)).toEqual([]);
  expect(result.usedDeprecatedRules).toHaveLength(0);
});
