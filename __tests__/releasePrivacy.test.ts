import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import legal from '../src/config/legal.json';

test('the iOS privacy manifest declares account, profile, chat and purchase data', () => {
  const manifest = readFileSync(resolve(__dirname, '../ios/MyDearPartner/PrivacyInfo.xcprivacy'), 'utf8');
  const entries = manifest.match(/<dict>\s*<key>NSPrivacyCollectedDataType<\/key>[\s\S]*?<\/dict>/g) ?? [];
  const kinds = entries.map(entry => entry.match(/<string>(NSPrivacyCollectedDataType\w+)<\/string>/)?.[1]);
  for (const kind of [
    'Name', 'EmailAddress', 'PhoneNumber', 'UserID', 'DeviceID', 'CoarseLocation',
    'SensitiveInfo', 'Health', 'OtherFinancialInfo', 'EmailsOrTextMessages',
    'PhotosorVideos', 'OtherUserContent', 'CustomerSupport', 'PurchaseHistory',
    'SearchHistory', 'ProductInteraction', 'CrashData', 'OtherDataTypes',
  ]) expect(kinds).toContain(`NSPrivacyCollectedDataType${kind}`);
  for (const entry of entries) {
    expect(entry).toMatch(/<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<true\/>/);
    expect(entry).toMatch(/<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<false\/>/);
    expect(entry).toMatch(/NSPrivacyCollectedDataTypePurpose(?:AppFunctionality|Analytics)/);
  }
});

test('the privacy text discloses the analytics and diagnostics integrations', () => {
  const policy = legal.privacy.sections.map(section => section.body).join(' ');
  expect(policy).toContain('Firebase Analytics');
  expect(policy).toContain('Firebase Crashlytics');
  expect(policy).toContain('account identifier');
});
