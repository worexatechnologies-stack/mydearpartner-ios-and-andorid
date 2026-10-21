const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { calculateDeterministicCompatibility } = require('../dist/matchmaking/scoringEngine');
const { getEnhancedCompatibility, invalidateAiCache } = require('../dist/matchmaking/geminiService');
const { matchmakingRouter } = require('../dist/matchmaking/routes');
const originalFetch = global.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalBase = process.env.MEMBER_API_BASE_URL;
afterEach(() => {
  global.fetch = originalFetch; invalidateAiCache();
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  if (originalBase === undefined) delete process.env.MEMBER_API_BASE_URL; else process.env.MEMBER_API_BASE_URL = originalBase;
});
const a = { id: 'a', age: 28, city: 'Bengaluru', education: 'MBA', profession: 'Engineer', interests: ['Music'] };
const b = { id: 'b', age: 24, city: 'Bengaluru', education: 'MBA', profession: 'Teacher', interests: ['Music', 'Walking'] };
const aiResponse = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'Discuss shared interests.', explanation: 'Ask about music and work expectations.', shared_strengths: ['Music'], considerations: ['Discuss future plans.'] }) }] } }] }), { status: 200 });

test('no facts yield no fabricated score or strengths', () => {
  const result = calculateDeterministicCompatibility({ id: 'a' }, { id: 'b' });
  assert.equal(result.compatibilityScore, null); assert.equal(result.dataCompleteness, 0);
  assert.deepEqual(result.sharedStrengths, []); assert.equal(result.isAiEnhanced, false);
});
test('only supplied comparable facts affect the baseline', () => {
  const result = calculateDeterministicCompatibility(a, b);
  assert.equal(result.compatibilityScore, 63); // 1 + 1 + 0 + 0.5 over four factors.
  assert.equal(result.factorBreakdown.find(f => f.factor === 'diet').applicable, false);
  assert.ok(result.sharedStrengths.includes('Shared interests: music'));
});
test('missing key and provider errors return labeled rule-based output', async () => {
  delete process.env.GEMINI_API_KEY;
  global.fetch = () => { throw new Error('must not call provider'); };
  assert.equal((await getEnhancedCompatibility(a, b)).isAiEnhanced, false);
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => new Response('{}', { status: 429 });
  assert.equal((await getEnhancedCompatibility(a, b)).isAiEnhanced, false);
});
test('Gemini uses a header key and the correct candidate facts without changing the score', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++; assert.ok(!url.includes('test-key')); assert.equal(options.headers['x-goog-api-key'], 'test-key');
    const prompt = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
    assert.equal(prompt.candidateB.age, 24); assert.equal(prompt.candidateA.age, 28);
    assert.equal(prompt.candidateA.id, undefined); assert.equal(prompt.candidateB.religion, undefined);
    return aiResponse();
  };
  const result = await getEnhancedCompatibility(a, b);
  assert.equal(result.isAiEnhanced, true);
  assert.equal(result.compatibilityScore, calculateDeterministicCompatibility(a, b).compatibilityScore);
  await getEnhancedCompatibility(a, b); assert.equal(calls, 1);
  await getEnhancedCompatibility(a, { ...b, city: 'Mumbai' }); assert.equal(calls, 2);
});
test('malformed AI JSON never becomes an enhanced result', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"summary":12}' }] } }] }));
  assert.equal((await getEnhancedCompatibility(a, b)).isAiEnhanced, false);
});

async function post(body, token) {
  const app = express(); app.use(express.json()); app.use('/matches', matchmakingRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    return await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: '/matches/compatibility/', method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer test-session' } : {}) } }, res => {
          let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        });
      req.on('error', reject); req.end(JSON.stringify(body));
    });
  } finally { await new Promise(resolve => server.close(resolve)); }
}
test('matching endpoint rejects unauthenticated and malformed requests', async () => {
  assert.equal((await post({ candidateId: 'b' })).status, 401);
  assert.equal((await post({ candidateId: '../private' }, true)).status, 400);
  delete process.env.MEMBER_API_BASE_URL;
  assert.equal((await post({ candidateId: 'b' }, true)).status, 503);
});
test('matching fetches authorized profiles and ignores client-supplied profile facts', async () => {
  process.env.MEMBER_API_BASE_URL = 'https://members.example/api/v1';
  const paths = [];
  global.fetch = async (url, options) => {
    paths.push(url); assert.equal(options.headers.Authorization, 'Bearer test-session');
    return new Response(JSON.stringify({ data: url.endsWith('/auth/me/') ? { user: { ...a, id: 'verified-user' } } : b }));
  };
  const result = await post({ candidateId: 'b', useAi: false, myProfile: { id: 'fake' }, candidateProfile: { city: 'fake' } }, true);
  assert.equal(result.status, 200); assert.equal(result.body.candidateId, 'b');
  assert.equal(result.body.isAiEnhanced, false);
  assert.ok(paths[0].endsWith('/auth/me/')); assert.ok(paths[1].endsWith('/profiles/b/'));
});
test('candidate visibility denials remain denials', async () => {
  process.env.MEMBER_API_BASE_URL = 'https://members.example/api/v1';
  global.fetch = async url => url.endsWith('/auth/me/') ? new Response(JSON.stringify({ id: 'authorized-user-2' })) : new Response('{}', { status: 403 });
  assert.equal((await post({ candidateId: 'b' }, true)).status, 403);
});

test('invalid member sessions cannot access candidate profiles', async () => {
  process.env.MEMBER_API_BASE_URL = 'https://members.example/api/v1';
  let calls = 0;
  global.fetch = async () => { calls++; return new Response('{}', { status: 401 }); };
  assert.equal((await post({ candidateId: 'b' }, true)).status, 401);
  assert.equal(calls, 1);
});
test('member rate limiting bounds repeated AI requests', async () => {
  process.env.MEMBER_API_BASE_URL = 'https://members.example/api/v1';
  delete process.env.GEMINI_API_KEY;
  global.fetch = async url => new Response(JSON.stringify(url.endsWith('/auth/me/') ? { ...a, id: 'rate-limited-member' } : b));
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await post({ candidateId: 'b', useAi: true }, true)).status, 200);
  assert.equal((await post({ candidateId: 'b', useAi: true }, true)).status, 429);
});

test('capabilities expose configuration without contacting Gemini or leaking a key', async () => {
  const app = express(); app.use('/matches', matchmakingRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  global.fetch = async () => { throw new Error('Availability must not call a provider'); };
  const read = () => new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${server.address().port}/matches/capabilities/`, res => {
      let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
  try {
    delete process.env.GEMINI_API_KEY;
    assert.deepEqual(await read(), { service: 'match-insights', version: 1, aiConfigured: false });
    process.env.GEMINI_API_KEY = 'private-test-key';
    process.env.MEMBER_API_BASE_URL = 'https://members.example/api/v1';
    const configured = await read();
    assert.equal(configured.aiConfigured, true);
    assert.ok(!JSON.stringify(configured).includes('private-test-key'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('explicit preferences are directional and missing candidate facts earn no points', () => {
  const result = calculateDeterministicCompatibility(
    { id: 'a', partnerPreferences: { minAge: 26, maxAge: 30, city: ['Mumbai'], diet: ['Vegetarian'] } },
    { id: 'b', age: 25, city: 'Mumbai', partnerPreferences: { education: ['MBA'] } },
  );
  assert.equal(result.compatibilityScore, 50);
  assert.equal(result.factorBreakdown.find(f => f.factor === 'your_preference_city').score, 1);
  assert.equal(result.factorBreakdown.find(f => f.factor === 'your_preference_age').score, 0);
  assert.equal(result.factorBreakdown.find(f => f.factor === 'your_preference_diet').applicable, false);
  assert.equal(result.factorBreakdown.find(f => f.factor === 'their_preference_education').applicable, false);
});

test('gateway resolves preferences from authenticated upstream profiles only', async () => {
  process.env.MEMBER_API_BASE_URL = 'https://members.example/api/v1';
  global.fetch = async url => new Response(JSON.stringify(url.endsWith('/auth/me/')
    ? { id: 'preference-user', partner_preferences: { min_age: 26, max_age: 30, city: ['Mumbai'] } }
    : { id: 'b', age: 25, city: 'Mumbai' }));
  const result = await post({ candidateId: 'b', partnerPreferences: { minAge: 18 } }, true);
  assert.equal(result.status, 200);
  assert.equal(result.body.compatibilityScore, 50);
});
