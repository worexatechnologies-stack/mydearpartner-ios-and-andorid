const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const braces = require('braces');
const shellQuote = require('shell-quote');
const assets = require('metro/private/Assets');

async function check() {
  assert.deepEqual(braces.expand('a/{b,c}/d'), ['a/b/d', 'a/c/d']);
  assert.throws(() => braces.compile('{'.repeat(2000) + 'a,b' + '}'.repeat(2000)), /safe nesting/);
  // Direct AST inputs must be bounded too; protecting only the parser leaves
  // the recursive compile, expand and stringify entry points exposed.
  let deepAst = { type: 'text', value: 'leaf' };
  for (let depth = 0; depth < 150; depth++) deepAst = { type: 'root', nodes: [deepAst] };
  for (const walker of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => walker(deepAst), /safe nesting/);
    const cyclicAst = { type: 'root', nodes: [] };
    cyclicAst.nodes.push(cyclicAst);
    assert.throws(() => walker(cyclicAst), /safe nesting/);
  }
  // A newline after a comment token must never become executable shell input.
  assert.throws(() => shellQuote.quote(['echo', 'ok', { comment: 'x' }, 'a\nid;#']), TypeError);
  const png = fs.readFileSync(path.resolve(__dirname, '../logo.png'));
  const dimensions = assets.getAssetSize('png', png, 'logo.png');
  assert(dimensions.width > 0 && dimensions.height > 0);
  const data = await assets.getAssetData(path.resolve(__dirname, '../logo.png'), 'logo.png', [], null, '/assets');
  assert.equal(data.width, dimensions.width);
  assert.equal(data.height, dimensions.height);
  // A child process bounds verification even if an unpatched parser loops.
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { imageSize } = require('image-size');
    const malformed = Buffer.alloc(24);
    malformed.write('icns'); malformed.writeUInt32BE(24, 4); malformed.write('icp4', 8);
    assert.throws(() => imageSize(malformed));
  `], { cwd: path.resolve(__dirname, '..'), timeout: 5000, encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  console.log('Security tool regressions passed: shell comment/newline injection, nested globs, malformed ICNS, Metro buffer/file images.');
}

check().catch(error => { console.error(error); process.exitCode = 1; });
