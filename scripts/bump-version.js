const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../package.json');
const androidGradlePath = path.join(__dirname, '../android/app/build.gradle');
const iosPlistPath = path.join(__dirname, '../ios/MyDearPartner/Info.plist');

// 1. Bump package.json
const pkg = require(packageJsonPath);
const currentVersion = pkg.version;
const parts = currentVersion.split('.').map(Number);
parts[2] += 1; // bump patch
const newVersion = parts.join('.');
pkg.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ Bumped package.json version to ${newVersion}`);

// 2. Bump Android build.gradle
let gradle = fs.readFileSync(androidGradlePath, 'utf8');
let newVersionCode = 1;
gradle = gradle.replace(/versionCode (\d+)/, (match, code) => {
  newVersionCode = parseInt(code, 10) + 1;
  return `versionCode ${newVersionCode}`;
});
gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${newVersion}"`);
fs.writeFileSync(androidGradlePath, gradle);
console.log(`✅ Bumped Android versionCode to ${newVersionCode} and versionName to ${newVersion}`);

// 3. Bump iOS Info.plist
let plist = fs.readFileSync(iosPlistPath, 'utf8');
plist = plist.replace(
  /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
  `$1${newVersion}$2`
);
// Bump CFBundleVersion (build number)
plist = plist.replace(
  /(<key>CFBundleVersion<\/key>\s*<string>)(\d+)(<\/string>)/,
  (match, prefix, num, suffix) => {
    return `${prefix}${parseInt(num, 10) + 1}${suffix}`;
  }
);
fs.writeFileSync(iosPlistPath, plist);
console.log(`✅ Bumped iOS CFBundleShortVersionString to ${newVersion} and incremented CFBundleVersion`);

console.log('\n🎉 Version bump complete! You are ready to build a new release.');
