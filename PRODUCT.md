# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users
*(Inferred from repository codebase, documentation, and user interface copy)*
- **Primary Users:** South Asian and Indian individuals actively seeking serious, lifelong marriage who want a modern, respectful, and dignified partner search experience.
- **Operating Context of Users:** Navigating partner discovery either independently or in consultation with family, prioritizing background authenticity, lifestyle compatibility, and personal privacy.

## Product Purpose
*(Inferred from repository codebase and documentation)*
- **Core Mission:** "Where meaningful connections turn into beautiful marriages."
- **Why It Exists:** To provide a trusted, modern matrimonial platform that bridges the gap between casual dating apps (which lack marital commitment) and traditional matrimonial websites (which are often cluttered, bureaucratic, and privacy-invasive).
- **Definition of Success:** Two individuals discovering mutual compatibility, establishing safe communication, and progressing toward marriage.

## Positioning
*(Inferred from repository codebase)*
- **Modern High-Trust Matchmaking:** Combines fluid mobile-first user experience with strict privacy protections (e.g. hidden contact details, member verification, photo privacy) and matrimony-first intent.
- **Distinctive Mechanism:** Serious compatibility profiles (family background, lifestyle, career, horoscope, preferences) presented in a warm, contemporary interface with curated discovery, profile comparison, and verified badges.

## Operating Context
- **Primary Surface:** Native mobile applications on iOS and Android.
- **Usage Rituals:** Daily discovery browsing, evaluating detailed partner profiles, comparing candidates side-by-side (`CompareScreen`), sending interest requests, reviewing profile visitors, and holding 1-on-1 conversations (`ChatScreen`) with quick-reply prompts.
- **Safety Context:** Private and sensitive environment; zero tolerance for spam, harassment, or unauthorized contact sharing.

## Capabilities and Constraints
- **Core Capabilities:**
  - Authenticated onboarding and rich multi-step profile configuration (lifestyle, habits, education, family details, partner preferences).
  - Discovery feed (`DiscoverScreen`) and advanced search (`SearchScreen`) with saved search alerts.
  - Candidate comparison matrix (`CompareScreen`) evaluating lifestyle, community, and career compatibility.
  - Real-time 1-on-1 messaging (`ChatScreen`, `ChatsListScreen`) with quick replies and unread indicators.
  - Member verification workflow (`VerificationScreen`) granting verified badges.
  - Member privacy controls: Contact details hidden globally on all profiles; photo visibility controls; block & report tools (`BlockedScreen`).
  - Tiered membership subscriptions (`MembershipScreen`) integrated with Razorpay.
  - Push notification integration via Firebase Cloud Messaging and Notifee.
- **Technical & Design Constraints:**
  - React Native 0.87.0 targeting iOS (CocoaPods/Xcode) and Android (SDK 35).
  - Dual-platform styling adaptations in `src/theme/platform.ts` (custom button radii, tab bar heights, iOS shadows vs Android elevation).
  - Minimum interactive touch target of 48×48dp (`interaction.targetSize: 48`).
  - Safe area inset compliance via `react-native-safe-area-context`.
  - Offline resilience and dedicated error states (`ConnectionErrorScreen`, `ProcessingScreen`).

## Brand Commitments
- **Name:** MyDearPartner ("MyDear" in text dark `#302432`, "Partner" in primary `#A53760`).
- **Tagline:** "TRUSTED MATCHMAKING"
- **Voice & Tone:** Warm, reassuring, dignified, intentional, and celebration-worthy.
- **Core Palette:**
  - Primary: `#A53760` (Deep Rose / Berry), Primary Dark: `#772544`, Primary Light: `#F9EAF0`
  - Action: `#D9145A`, Action Dark: `#B9104B`
  - Background / Canvas: `#FFF8FA` / `#FFF2F6` (Warm ivory / soft rose tint)
  - Surfaces: `#FFFFFF`
  - Typography: `#302432` (Rich plum dark text), `#706574` (Secondary muted plum)
  - Gold Accent: `['#FBBF24', '#F59E0B']` for premium tiers

## Evidence on Hand
- Complete production-grade React Native repository with 25+ application screens, verified test suites (74 suites, 418 tests passing), and design token architecture (`src/theme/theme.ts`, `src/theme/tokens.ts`, `src/theme/platform.ts`).
- Production branding assets: `assets/` and `src/assets/images/` including `logo.png`, `welcome_marriage.jpg`, `welcome_bg_wavy.jpg`.
- Comprehensive testing and security audit documentation (`APP_HEALTH_CHECK_2026-10-22.md`, `FULL_APP_TEST_2026-10-22.md`).
- **Absences:** No web application frontend is part of this repository; production backend credentials, live store certificates, and third-party API keys are strictly excluded from source control.

## Product Principles
- **Trust Before Interaction:** Member safety and dignity come first; verified authenticity, photo privacy, and protected contact information take precedence over friction-free exposure.
- **Intentionality Over Gamification:** UI elements encourage thoughtful evaluation of compatibility, personal values, and life vision rather than superficial swiping.
- **Warmth and Reassurance:** Matrimony search can be stressful; the visual aesthetic and micro-copy must project comfort, optimism, and calm confidence.
- **Platform-Native Precision:** Respect iOS and Android interaction models, tactile touch feedback, and accessibility guidelines natively.

## Accessibility & Inclusion
- Minimum touch target area of 48×48dp across all interactive controls.
- High-contrast typography hierarchy (`#302432` text on light backgrounds meeting WCAG AA standards).
- Dynamic safe-area padding across notch, dynamic island, and gesture bar form factors.
- Keyboard-aware scrolling on all input and profile editing forms.
