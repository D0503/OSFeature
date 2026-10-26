import assert from 'node:assert/strict';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectProject, evaluateCompatibility, loadFeature } from '../scripts/lib/project-tools.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cases = [
  ['float-view-ball', 'float-bound-api26', 26],
  ['dlp-anti-peep', 'anti-peep-api21', 21],
  ['agent-framework-kit', 'agent-atomic-api21', 21],
  ['smart-reach', 'smart-reach-api23', 23],
  ['easygo-parallel', 'easygo-navigation-api26', 26]
];
for (const [feature, fixture, api] of cases) {
  const { profile } = await loadFeature(root, feature);
  const input = await inspectProject(join(root, 'evals/fixtures', fixture), {
    sdkPath: join(root, 'evals/fixtures', `sdk-api${api}`)
  });
  const evaluate = value => evaluateCompatibility(value, profile);
  const low = structuredClone(input);
  low.api.target = 1;
  assert.equal(evaluate(low).status, 'upgrade_available', feature);
  assert.equal(evaluate(low).availableRoutes.length, 0, feature);
  for (const option of evaluate(low).upgradeOptions) {
    const required = option.upgradeCompileApi ?? option.requiredCompileApi;
    assert.ok(option.upgradeTargetApi >= required, feature);
    assert.equal(option.keepCompatibleApi, input.api.compatible);
  }
  const high = structuredClone(input);
  high.api.target = 30;
  high.api.compile = 1;
  assert.ok(evaluate(high).upgradeOptions.every(o => o.upgradeTargetApi === 30), feature);
  const unknown = structuredClone(input);
  unknown.api.target = 'unknown';
  assert.equal(evaluate(unknown).status, 'insufficient_context', feature);
  assert.equal(input.api.target, api, 'Evaluation must not mutate the inspection');
}

// Enhanced APIs raise target as well as compile, above the base route version.
const { profile } = await loadFeature(root, 'float-view-ball');
const ball = await inspectProject(join(root, 'evals/fixtures/floating-ball-api20'), {
  sdkPath: join(root, 'evals/fixtures/sdk-api26')
});
ball.api.compile = 26;
ball.floatViewBall.usages.push({ route: 'floating-ball', operation: 'onDestroy', minApi: 26 });
const result = evaluateCompatibility(ball, profile);
assert.equal(result.requiredApi, 26);
assert.equal(result.upgradeOptions.find(o => o.route === 'floating-ball').upgradeTargetApi, 26);
assert.equal(result.status, 'upgrade_available');
console.log('Unified target upgrade policy tests passed');
