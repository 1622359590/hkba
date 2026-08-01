import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('particle rendering uses one current tsParticles package family', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  const source = await readFile(
    new URL('../components/webgl/ParticleBackground.tsx', import.meta.url),
    'utf8',
  );
  const dependencies = packageJson.dependencies;

  assert.match(dependencies['@tsparticles/react'], /^\^4\./);
  assert.match(dependencies['@tsparticles/slim'], /^\^4\./);
  assert.equal(dependencies['react-tsparticles'], undefined);
  assert.equal(dependencies['tsparticles-slim'], undefined);
  assert.equal(dependencies.tsparticles, undefined);
  assert.match(source, /from '@tsparticles\/react'/);
  assert.match(source, /from '@tsparticles\/slim'/);
});
