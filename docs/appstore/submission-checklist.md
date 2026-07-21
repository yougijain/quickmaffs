# QuickMaffs — App Store submission checklist

Route: **Capacitor iOS → Codemagic (cloud Mac) → TestFlight → App Store**.
No Mac needed on your end.

---

## Phase 0 — Accounts (gating; start now, ~1–2 days)
- [ ] **Apple Developer Program** enrollment complete ($99/yr). Blocks everything below.
- [ ] **App Store Connect API key** created (Users and Access ▸ Integrations ▸ Keys). Needed by Codemagic.
- [ ] **App record** created in App Store Connect for bundle id `com.quickmaffs.app`; note its numeric **Apple ID**.

## Phase 1 — Native readiness (DONE ✅)
- [x] App icon (1024 master → all iOS/PWA/favicon sizes).
- [x] Native splash screen (`@capacitor/splash-screen`).
- [x] Haptics (`@capacitor/haptics`) on keypad, solved, and personal best.
- [x] Status-bar theming (`@capacitor/status-bar`).

## Phase 2 — Metadata & compliance (THIS PASS)
- [x] **Privacy policy** page → `public/privacy.html` → deploys to
      `https://yougijain.github.io/quickmaffs/privacy.html`.
- [x] **Store listing copy** → `listing.md`.
- [x] **App Privacy answers** → `app-privacy.md`.
- [ ] **Account deletion (REQUIRED — see below).** Apple Guideline 5.1.1(v):
      any app with account creation must let users delete their account in-app.
- [ ] **Screenshots** (see sizes below) — capture on your iPhone from the PWA or TestFlight build.
- [ ] **Version bump** to `1.0.0` (currently `0.1.0`) and set `CFBundleShortVersionString` (Codemagic handles the build number).

## Phase 3 — Build pipeline (READY ✅ / needs your keys)
- [x] `codemagic.yaml` committed at repo root.
- [ ] In Codemagic: connect repo, add the ASC API key integration, and set its
      name + `APP_ID` in `codemagic.yaml` (two clearly-marked placeholders).
- [ ] First build → lands in **TestFlight**.

## Phase 4 — TestFlight → Submit → Review
- [ ] Install the TestFlight build on your iPhone; sanity-check the signed app
      (icon, splash, haptics, sign-in/sync, offline).
- [ ] Fill remaining App Store Connect fields; attach build; **submit for review**.
- [ ] Respond to any review feedback (most likely: Guideline 4.2 minimum
      functionality — Phase 1 native features are our defense).

---

## ⚠️ Account deletion — REQUIRED before submission
Apple **rejects** apps that let users create an account but not delete it.
QuickMaffs has accounts (anonymous + email) and cloud sync, so we must add an
in-app **"Delete account"** action that:
1. Deletes the user's `sessions`, `attempts`, and `user_settings` rows.
2. Deletes the underlying auth user (requires admin privileges — do this via a
   Supabase **Edge Function** using the service-role key, invoked with the
   user's JWT; the anon client can't delete an auth user directly).
3. Clears local storage and returns the app to the signed-out/anonymous state.

Recommended home for the button: **Stats ▸ account section**, below sign-out,
styled as a red destructive action with a confirm.

_This is an engineering task, not just metadata — flag to implement before Phase 4._

---

## Screenshot sizes (App Store Connect requirements)
You must provide at least one set; the 6.7" set is the safest single upload and
covers most modern iPhones.
- **6.7" (iPhone 15/16 Pro Max):** 1290 × 2796 px — **required**.
- **6.5" (iPhone 11 Pro Max / XS Max):** 1242 × 2688 px — recommended.
Capture 3–5: Home, Game (mid-drill), Results (with tier + personal best), Stats,
Drills. From the PWA on your phone: play a run, screenshot with the side buttons.

## Notes
- Supabase publishable (anon) key ships in `.env.production` and is safe (RLS-scoped);
  no build secrets are required in Codemagic.
- Sign in with Apple is **not** required (first-party email/password only; the
  4.8 rule triggers only on third-party social logins).
