import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { transformSync } from '@babel/core';

const { resolveBuildTarget } = require('../scripts/build-target.cjs');
const origin = 'https://staging.mydearpartner.in';

function compiledTarget(target: Record<string, string>) {
  const filename = path.resolve(__dirname, '../src/config/env.ts');
  const result = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false,
    presets: ['module:@react-native/babel-preset'],
    plugins: [[require.resolve('../scripts/babel-build-target.cjs'), { target }]],
  });
  const context = { exports: {} as Record<string, string>, URL, __DEV__: false };
  vm.runInNewContext(result!.code!, context);
  return context.exports;
}

test('default release embeds production URLs and preserves existing session storage', () => {
  const result = compiledTarget(resolveBuildTarget({}));
  expect(result.API_BASE_URL).toBe('https://mydearpartner.in/api/v1');
  expect(result.WS_BASE_URL).toBe('wss://mydearpartner.in/ws/');
  expect(result.SESSION_STORAGE_SUFFIX).toBe('');
});

test('staging release embeds matching HTTPS/WSS/media targets and separate session storage', () => {
  const result = compiledTarget(resolveBuildTarget({ MDP_ENVIRONMENT: 'staging', MDP_STAGING_ORIGIN: origin }));
  expect(result.API_BASE_URL).toBe(`${origin}/api/v1`);
  expect(result.WS_BASE_URL).toBe('wss://staging.mydearpartner.in/ws/');
  expect(result.MEDIA_BASE_URL).toBe(`${origin}/media`);
  expect(result.APP_NAME).toBe('My Dear Partner (Staging)');
  expect(result.SESSION_STORAGE_SUFFIX).toBe('.staging.staging.mydearpartner.in');
});

test.each([
  undefined, 'http://staging.mydearpartner.in', 'https://mydearpartner.in',
  'https://www.mydearpartner.in', 'https://mydearpartner.in.',
  'https://user:secret@staging.mydearpartner.in', `${origin}/api/v1`,
  `${origin}?token=secret`, `${origin}#secret`, 'https://example.com',
  'https://127.0.0.1', 'https://localhost',
])('invalid staging target fails the build without leaking its value: %s', value => {
  expect(() => resolveBuildTarget({ MDP_ENVIRONMENT: 'staging', MDP_STAGING_ORIGIN: value }))
    .toThrow('MDP_STAGING_ORIGIN must be a dedicated HTTPS origin');
  try { resolveBuildTarget({ MDP_ENVIRONMENT: 'staging', MDP_STAGING_ORIGIN: value }); }
  catch (error: any) { expect(error.message).not.toContain('secret'); }
});

test('ambiguous targets and mistyped modes fail rather than silently selecting production', () => {
  expect(() => resolveBuildTarget({ MDP_ENVIRONMENT: 'stage' })).toThrow('MDP_ENVIRONMENT');
  expect(() => resolveBuildTarget({ MDP_STAGING_ORIGIN: origin })).toThrow('Remove MDP_STAGING_ORIGIN');
});
