# App Privacy answers (App Store Connect → App Privacy)

These are the exact answers to Apple's privacy questionnaire, based on what the
app actually collects (Supabase account + gameplay history). Nothing here is
used for tracking or advertising.

## 1. "Do you or your third-party partners collect data from this app?"
**Yes.** (The app stores your account + practice history in Supabase when signed in.)

> Note: if you ever ship a build with cloud sync fully disabled, the answer would be "No."
> As shipped, sync is on (anonymous by default), so answer **Yes**.

## 2. Data types collected

Enable exactly these. For every one: **Linked to the user's identity = Yes**
(it's tied to an account/user ID), **Used for tracking = No**, and the only
purpose is **App Functionality**.

| Apple category | Data type | Collected? | Linked to identity | Tracking | Purpose |
|---|---|---|---|---|---|
| Contact Info | **Email Address** | Yes (only if user makes an account) | Yes | No | App Functionality |
| Identifiers | **User ID** | Yes (Supabase account/anonymous ID) | Yes | No | App Functionality |
| Usage Data | **Product Interaction** | Yes (scores, problems, timing) | Yes | No | App Functionality |

Everything else → **not collected**. In particular:
- No Location, Contacts, Health, Financial, Browsing History, Search History.
- No Purchases, no Advertising Data, no Crash/Performance/Diagnostics collection.
- No third-party analytics SDKs, no ad networks.

## 3. Tracking
**"Does this app track users?" → No.**
The app does not link data with third-party data for advertising and does not
share data with data brokers. No App Tracking Transparency prompt is needed.

## 4. Account deletion
App Store Connect asks whether the app offers in-app account deletion.
Answer **Yes** — the app must (and will) provide an in-app "Delete account"
action that removes the user's rows and their auth account. See
`submission-checklist.md` → "Account deletion (REQUIRED)".

---

### Plain-English summary (for your own reference)
- Email: only collected if the user opts to create an email account (anonymous otherwise).
- User ID: an opaque Supabase UUID, used to scope each person's data to themselves via row-level security.
- Product Interaction: the gameplay records (scores, per-problem operands/answers/timing) that power benchmarks and weak-spot analytics.
- No ads, no trackers, no data sale. Matches `public/privacy.html`.
