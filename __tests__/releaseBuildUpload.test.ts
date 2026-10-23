import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('iOS audit builds skip Crashlytics uploads while normal builds retain the upload phase', () => {
  const project = readFileSync(resolve(__dirname, '../ios/MyDearPartner.xcodeproj/project.pbxproj'), 'utf8');
  const scripts = [...project.matchAll(/shellScript = ("(?:[^"\\]|\\.)*");/g)]
    .map(match => JSON.parse(match[1]) as string);
  const script = scripts.find(value => value.includes('MDP_SKIP_CRASHLYTICS_UPLOAD'));
  expect(script).toBeDefined();
  const directory = mkdtempSync(join(tmpdir(), 'mdp-upload-test-'));
  try {
    const marker = join(directory, 'ran');
    mkdirSync(join(directory, 'FirebaseCrashlytics'));
    writeFileSync(join(directory, 'FirebaseCrashlytics', 'run'), '#!/bin/sh\ntouch "$AUDIT_TEST_MARKER"\n', { mode: 0o700 });
    const env = { ...process.env, PODS_ROOT: directory, AUDIT_TEST_MARKER: marker };
    const skipped = spawnSync('bash', ['-c', script!], {
      env: { ...env, MDP_SKIP_CRASHLYTICS_UPLOAD: '1' }, encoding: 'utf8',
    });
    expect(skipped.status).toBe(0);
    expect(skipped.stdout).toContain('Crashlytics upload disabled');
    expect(existsSync(marker)).toBe(false);
    const normal = spawnSync('bash', ['-c', script!], {
      env: { ...env, MDP_SKIP_CRASHLYTICS_UPLOAD: '0' }, encoding: 'utf8',
    });
    expect(normal.status).toBe(0);
    expect(existsSync(marker)).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
