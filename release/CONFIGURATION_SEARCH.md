# Configuration search — 7 October 2026

## Subsequently supplied environment file

The user supplied `/Users/venkateshk.worexa/Downloads/env` after the repository search. It contains active production configuration with `PAYMENT_MODE=razorpay`, `RAZORPAY_MODE=live` and `MEMBERSHIP_ACTIVATION_MODE=payment_verified`. The Razorpay public key, secret and webhook-secret fields are nonempty. Their validity and deployment were not tested. The public key matches the app's existing public-key fallback; no key values are reproduced here.

This differs from the earlier pasted configuration, which selected manual approval with Razorpay off. The new file resolves the question of whether production payment configuration was supplied, but it does not supply a staging URL, dedicated test-account pair, Razorpay sandbox setup, SSH identity or Apple provisioning profiles. No live purchase, provider authentication or deployment was attempted, and backend secrets were not copied into the mobile app or tracked files.

Searched 2,322 text/configuration files in the app workspace and adjacent `backend-notification-fix` checkout for staging, sandbox, test-account, deployment and signing configuration. Dependency installations, virtual environments and most generated build folders were excluded. This is a configuration search, not an exhaustive security audit of every file.

| Area | Evidence found | Usable for remaining acceptance? |
| --- | --- | --- |
| Local database | `backend/.env` has DATABASE_URL, PORT and JWT_SECRET | Local scaffold configuration; not a two-account staging setup |
| Payments | `server/.env.example` and adjacent backend `.env.example` files contain Razorpay fields | Key ID, secret and webhook values are placeholders/empty; no usable sandbox credentials identified |
| Dedicated accounts | Adjacent `frontend/tests/e2e/README.md` documents account environment variables; unit tests use mock/local accounts | No configured dedicated staging pair found |
| Firebase | Existing Android/iOS Firebase configuration files | Present; does not prove live APNs/FCM delivery |
| Android signing | Release build configuration and signed APK/AAB | Present; verify upload certificate against Play Console separately |
| iOS signing | Xcode team/bundle configuration | No provisioning profiles found in standard profile directories |
| SSH | `~/.ssh/known_hosts` | No private identity/config file found in that directory; earlier login attempt was rejected |

No secret values were displayed, copied into this report or sent to a remote service. No `.env.local` test configuration was found in either checkout. Code and example configuration exist; the missing external setup cannot be inferred to work from those files alone.
