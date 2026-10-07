# MyDearPartner iOS — Backend Integration Guide

## Production Backend

| Property | Value |
|---|---|
| **Platform** | Django (Python) + Django REST Framework |
| **Server** | Hostinger VPS `srv1833582` |
| **Production URL** | `https://mydearpartner.in` |
| **API Base URL** | `https://mydearpartner.in/api/v1` |
| **WebSocket URL** | `wss://mydearpartner.in/ws/` |
| **Media Base URL** | `https://mydearpartner.in/media` |
| **HTTPS** | ✅ Enabled (`SECURE_SSL_REDIRECT=True`) |
| **Database** | PostgreSQL (`matiromony` database) |
| **OTP Provider** | Renflair SMS (`RENFLAIR_API_KEY` configured) |
| **Payments** | Razorpay (`PAYMENT_MODE=manual_approval`) |
| **2FA** | Enabled (`ENABLE_TWO_FACTOR=True`) |

---

## Authentication Flow

```
User enters email + password
  ↓
iOS → POST /api/v1/auth/login/
  ↓
Backend validates → returns { access, refresh, user }
  ↓
iOS stores { access, refresh } in iOS Keychain
  (service: com.mydearpartner.app, NOT AsyncStorage)
  ↓
iOS → GET /api/v1/profile/me/ (load own profile)
  ↓
Navigate to Main tab
```

### Token Refresh Flow
```
API call returns 401
  ↓
apiClient → POST /api/v1/auth/token/refresh/ { refresh: <stored_refresh> }
  ↓
Backend returns { access: <new_token> }
  ↓
Keychain updated with new access token
  ↓
Original request retried automatically
  ↓
If refresh also fails → clearTokens() → navigate to Login
```

### Session Restoration (App Launch)
```
App launches → SplashScreen shown (3 seconds)
  ↓
loadTokens() from Keychain
  ↓
Token exists?
  → YES: GET /api/v1/profile/me/ → set currentUser → Main tab
  → NO: Navigate to Login
```

---

## API Service Architecture

```
iOS App
├── src/config/env.ts          ← Production URL: https://mydearpartner.in/api/v1
├── src/config/constants.ts    ← Timeouts, retry counts
├── src/utils/keychain.ts      ← Secure token storage (iOS Keychain)
├── src/api/
│   ├── apiClient.ts           ← Core HTTP client (fetch + auth + retry)
│   ├── types.ts               ← API response types (DRF snake_case)
│   ├── authService.ts         ← login, register, logout, OTP
│   ├── profileService.ts      ← profile CRUD, discover, search, photo upload
│   ├── interestService.ts     ← send, cancel, accept, decline interests
│   ├── chatService.ts         ← chat list, messages, REST send
│   ├── wsClient.ts            ← WebSocket client (wss://mydearpartner.in/ws/)
│   └── notificationService.ts ← device token registration
├── src/services/
│   └── PushNotificationService.ts ← APNs integration
└── src/context/
    ├── AuthContext.tsx         ← Authentication state (API-connected)
    └── AppDataContext.tsx      ← Data state (API-connected, mock fallback)
```

---

## API Endpoints Used by iOS

> **Note:** These follow standard Django REST Framework conventions.
> Confirm exact paths from the backend's `urls.py` if they differ.

### Authentication
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/login/` | Email + password login |
| POST | `/api/v1/auth/register/` | New account registration |
| POST | `/api/v1/auth/token/refresh/` | Refresh access token |
| POST | `/api/v1/auth/logout/` | Logout (clears server session) |
| POST | `/api/v1/auth/otp/send/` | Send OTP via Renflair SMS |
| POST | `/api/v1/auth/otp/verify/` | Verify OTP → login |
| POST | `/api/v1/auth/password/change/` | Change password |

### Profiles
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/auth/me/` | Get own profile |
| PATCH | `/api/v1/auth/me/` | Update own profile |
| GET | `/api/v1/profiles/` | Discover profiles (paginated + filtered) |
| GET | `/api/v1/profiles/{id}/` | Get profile by ID |
| POST | `/api/v1/profile/photo/` | Upload photo (multipart) |
| DELETE | `/api/v1/profile/photo/{id}/` | Delete photo |

> ⚠️ **Note:** `/api/v1/profile/me/` returns 404 on the live server. The backend uses `/api/v1/auth/me/`.

### Interests
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/interests/` | Send interest |
| GET | `/api/v1/interests/?type=outgoing` | Get sent interests |
| GET | `/api/v1/interests/?type=incoming` | Get received interests |
| PATCH | `/api/v1/interests/{id}/` | Accept or decline |
| DELETE | `/api/v1/interests/{id}/` | Cancel sent interest |

> ⚠️ **Note:** `/api/v1/interests/sent/` and `/api/v1/interests/received/` return 404. Use `?type=outgoing` and `?type=incoming` instead.

### Chat
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/conversations/` | Get all conversations |
| POST | `/api/v1/conversations/` | Create or get conversation |
| GET | `/api/v1/conversations/{id}/messages/` | Get message history |
| POST | `/api/v1/conversations/{id}/messages/` | Send message (REST fallback) |
| WS | `wss://mydearpartner.in/ws/chat/{id}/?token={jwt}` | Real-time messaging |

> ⚠️ **Note:** `/api/v1/chats/` returns 404 on the live server. The backend uses `/api/v1/conversations/`.

### Notifications
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/devices/` | Register APNs device token |
| DELETE | `/api/v1/devices/{token}/` | Remove token on logout |

### Health
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/health/` | Backend health check |

---

## Token Storage

| | Where | Security |
|---|---|---|
| **Access Token** | iOS Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) | Hardware-backed on A12+ |
| **Refresh Token** | iOS Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) | Hardware-backed on A12+ |
| **Device Push Token** | In-memory only | Not persisted |
| **Shortlist** | AsyncStorage | Non-sensitive preference |
| **Passwords** | Never stored | Always in-flight only |

---

## Photo Upload Flow

```
User picks image from gallery/camera
  ↓
(Optional) Compress image before upload
  ↓
profileService.uploadPhoto(uri, filename, mimeType)
  ↓
apiClient.upload('/profile/photo/', formData)
  ↓
Backend stores to disk / cloud storage
  ↓
Returns { photo_url: "/media/profiles/xxx.jpg" }
  ↓
profileService.mapProfile() resolves full URL:
  https://mydearpartner.in/media/profiles/xxx.jpg
```

---

## Chat Architecture

```
ChatScreen mounts
  ↓
chatWsClient.connect(chatId, onMessage, onStatus)
  ↓
WebSocket: wss://mydearpartner.in/ws/chat/{chatId}/?token={jwt}
  ↓
Messages arrive → AppDataContext state updated → FlatList re-renders

User sends message
  ↓
chatWsClient.sendMessage(text) → { type: "chat_message", message: text }
  ↓
WebSocket CLOSED/ERROR?
  → REST fallback: POST /api/v1/chats/{chatId}/messages/

ChatScreen unmounts
  ↓
chatWsClient.disconnect()
```

---

## Push Notification Setup (Manual Steps Required)

1. **Apple Developer Portal:**
   - Enable Push Notifications for the app bundle
   - Create an APNs Key (.p8) — download and add to backend

2. **Xcode:**
   - Add Push Notifications capability
   - Add Background Modes → Remote Notifications

3. **Backend (django-push-notifications or similar):**
   - Configure APNs credentials
   - Implement `POST /api/v1/devices/` endpoint

4. **iOS App:**
   - Install: `npm install @react-native-firebase/messaging` (recommended) or
     `@react-native-push-notification-ios/push-notification-ios`
   - Update `src/services/PushNotificationService.ts` with the actual library

---

## Environment Switching

| Environment | API Base URL |
|---|---|
| **Development** (local Django) | `http://localhost:8000/api/v1` |
| **Production** | `https://mydearpartner.in/api/v1` |

Switching is automatic: `__DEV__` is `true` in Metro/debug builds,
`false` in release builds. See `src/config/env.ts`.

---

## Build Configuration

```bash
# Development (Metro bundler)
npx react-native run-ios

# Production release build (Xcode)
# 1. Set scheme to Release
# 2. Product → Archive
# 3. Distribute to App Store Connect
```

---

## Security Checklist

- [x] Tokens stored in iOS Keychain (NOT AsyncStorage)
- [x] HTTPS enforced (`SECURE_SSL_REDIRECT=True` on server)
- [x] SSL certificate validation enabled (never disabled)
- [x] No passwords stored client-side
- [x] No tokens logged to console
- [x] Authorization header not logged
- [x] Demo credentials removed from login screen
- [ ] APNs private key — stored only on server, NEVER in app
- [ ] Razorpay payment verification — server-side only
- [ ] Personal data (name, phone) not logged in production

---

## Remaining Work

| Item | Status | Blocker |
|---|---|---|
| Auth login/register | ✅ Implemented | Backend must have auth routes |
| Profile CRUD | ✅ Implemented | Backend must have profile routes |
| Interest system | ✅ Implemented | Backend must have interest routes |
| Chat REST | ✅ Implemented | Backend must have chat routes |
| Chat WebSocket | ✅ Implemented | Backend must have Django Channels |
| Photo upload | ✅ Implemented | Backend must handle multipart |
| Push notifications | 🟡 Partial | Needs APNs key + push library install |
| OTP login (Renflair) | ✅ Implemented | Backend endpoint must be live |
| Payments (Razorpay) | 🟡 UI only | Backend `PAYMENT_MODE=manual_approval` — Razorpay keys not configured |
| Shortlist sync | 🟡 Local only | Backend shortlist/favorites endpoint not confirmed |

---

## Testing Checklist

After configuring the production backend endpoints, test:

- [ ] Register new account
- [ ] Login with email + password  
- [ ] Close app → reopen → session restored
- [ ] Load discover profiles
- [ ] Filter profiles (gender, age, religion)
- [ ] View profile detail
- [ ] Send interest
- [ ] Receive interest (test from another account)
- [ ] Accept interest → chat created
- [ ] Send message via WebSocket
- [ ] Receive message via WebSocket
- [ ] Upload profile photo
- [ ] Update profile fields
- [ ] Logout → token cleared
- [ ] Login again
- [ ] Test on slow network
- [ ] Test with no internet → graceful error
- [ ] Test expired token → auto-logout
