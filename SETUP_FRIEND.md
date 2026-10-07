# Setting Up MyDearPartner for Android/iOS E2EE Decryption

This guide contains the system requirements and setup instructions to get the E2EE (End-to-End Encryption) messaging decryption functional on both Android and iOS.

---

## 1. System Requirements

### General
- **Node.js**: `22.11.0` or newer (`node -v`)

### Android Setup
- **JDK**: `17`
- **Android Studio** (latest stable version)
- Inside **Android Studio → SDK Manager → SDK Tools**, ensure you install:
  - Android SDK Platform **37**
  - Build-Tools **37.0.0**
  - **NDK 27.1.12297006** (this exact NDK version is critical — native C++ build will fail without it)
  - CMake

### iOS Setup (macOS only)
- **Xcode** (latest stable version)
- **CocoaPods** (installed locally via Bundler)

---

## 2. Installation and Build

### Step 1: Install Dependencies
Run in the root directory:
```bash
npm install
```

### Step 2: iOS Build Setup (macOS)
1. Execute CocoaPods installation inside the `ios` directory:
   ```bash
   cd ios
   bundle exec ruby ../vendor/bundle/ruby/2.6.0/bin/pod install
   cd ..
   ```
2. Make sure execution permissions are correct:
   ```bash
   find ios -name "*.sh" -exec chmod +x {} +
   find node_modules -name "*.sh" -exec chmod +x {} +
   ```

### Step 3: Run the App

1. Start Metro Bundler:
   ```bash
   npm run start -- --port 8082
   ```

2. In a second terminal window, run the application:
   - **For iOS**:
     ```bash
     bundle exec npm run ios
     ```
   - **For Android**:
     ```bash
     npx react-native run-android
     ```

---

## 3. Verify Decryption

When the app runs and connects, you should see the following logs in your Metro Bundler console confirming that WebCrypto has passed its verification self-test:
```
[shim] crypto.subtle ready: true
[shim] e2ee self-test: PASS — round-trip OK
[shim] WebCrypto is fully functional — E2EE messages will decrypt.
```
Once verified, the chat messages will display decrypted plaintext instead of `🔒 Encrypted message`.
