const fs = require('node:fs');
const path = require('node:path');

// This reads local configuration only. It never logs values, connects to a
// provider, signs in, performs payments or deploys code.
const configPath = path.resolve(process.argv[2] || 'release/.env.acceptance.local');
let settings = {};
if (fs.existsSync(configPath)) {
  for (const line of fs.readFileSync(configPath, 'utf8').split(/\r?\n/)) {
    const entry = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (!entry) continue;
    let value = entry[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    settings[entry[1]] = value;
  }
}
const present = key => !!settings[key] && !/^(?:your[_ -]|replace|changeme|<)/i.test(settings[key]);
let failures = 0;
function check(label, ok) {
  console.log(`${ok ? 'CONFIGURED' : 'MISSING/INVALID'}: ${label}`);
  if (!ok) failures++;
}
check('Local acceptance configuration', fs.existsSync(configPath));
let stagingValid = false;
try {
  const url = new URL(settings.STAGING_BASE_URL);
  stagingValid = url.protocol === 'https:' && !url.username && !url.password &&
    !/(^|\.)mydearpartner\.in$/i.test(url.hostname) &&
    !/(^|\.)(?:example\.(?:com|test)|invalid)$/i.test(url.hostname);
} catch { /* Missing or invalid URL. */ }
check('Dedicated HTTPS staging URL', stagingValid);
for (const key of ['TEST_MEMBER_A_IDENTIFIER', 'TEST_MEMBER_A_PASSWORD',
  'TEST_MEMBER_B_IDENTIFIER', 'TEST_MEMBER_B_PASSWORD']) check(key, present(key));
check('Two distinct test accounts', present('TEST_MEMBER_A_IDENTIFIER') &&
  present('TEST_MEMBER_B_IDENTIFIER') && settings.TEST_MEMBER_A_IDENTIFIER !== settings.TEST_MEMBER_B_IDENTIFIER);
check('Razorpay sandbox public key', /^rzp_test_[A-Za-z0-9]{10,}$/.test(settings.RAZORPAY_KEY_ID || ''));
for (const key of ['RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) check(key, present(key));
check('Deployment SSH alias', present('DEPLOY_SSH_ALIAS'));
let identityExists = false;
try { identityExists = present('DEPLOY_SSH_IDENTITY_FILE') && fs.statSync(settings.DEPLOY_SSH_IDENTITY_FILE).isFile(); } catch { /* Missing file. */ }
check('Local deployment identity file', identityExists);
console.log('Configuration presence does not verify credentials, access, signing, devices or release readiness.');
process.exitCode = failures ? 1 : 0;
