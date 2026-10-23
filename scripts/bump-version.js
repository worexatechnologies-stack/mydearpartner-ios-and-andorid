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
// Keep the npm lockfile's release metadata in sync with package.json.
const lockPath = path.join(__dirname, '../package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = newVersion;
  if (lock.packages && lock.packages['']) lock.packages[''].version = newVersion;
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}
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
// 4. Bump iOS project.pbxproj
const iosPbxprojPath = path.join(__dirname, '../ios/MyDearPartner.xcodeproj/project.pbxproj');
if (fs.existsSync(iosPbxprojPath)) {
  let pbx = fs.readFileSync(iosPbxprojPath, 'utf8');
  pbx = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${newVersionCode};`);
  pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${newVersion};`);
  fs.writeFileSync(iosPbxprojPath, pbx);
  console.log(`✅ Bumped iOS project.pbxproj CURRENT_PROJECT_VERSION to ${newVersionCode} and MARKETING_VERSION to ${newVersion}`);
}

console.log('\n🎉 Version bump complete! You are ready to build a new release.');
