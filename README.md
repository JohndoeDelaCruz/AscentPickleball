# Ascent Pickleball

A Next.js App Router / TypeScript website for a two-court Philippine venue. Supabase provides authentication, Postgres reservations, and storage for your GCash QR. GCash payments are **manual**: customers pay your QR and submit a reference; staff verifies the incoming transaction before confirming. No Stripe, PayMongo, automatic charges, or automatic refunds are integrated.

## Run locally

Requires Node.js 20.9+ (Node 24 LTS recommended).

```powershell
npm install
npm run dev
```

Open http://localhost:3000. The supplied Supabase URL and publishable key are saved in `.env.local`, which Git ignores. For another environment, copy `.env.example` to `.env.local` and add that project's public credentials. Never put a service-role key in a `NEXT_PUBLIC_` variable. Next.js runs with Node; XAMPP/Apache is not required.

## One-time Supabase setup

The supplied publishable key can read permitted data and authenticate users, but **cannot create tables or assign administrators**. Apply the migrations once, in order, before live reservations or settings persistence can work:

1. Open your project's SQL Editor: https://supabase.com/dashboard/project/rmrzxyytjrckicbgerdj/sql/new
2. Run the SQL files in `supabase/migrations/` in order: `202610230001_initial.sql`, `202610230002_time_based_rates.sql`, `202610230003_evening_rate_200.sql`, `202610230004_weekend_open_play.sql`, `202610230005_finance.sql`, `202610230006_equipment_rental.sql`, `202610240007_payment_options.sql`, `202610240008_open_play_capacity.sql`, then `202610260009_venue_rules.sql`. The first creates the courts, settings, staff membership, booking rules, permissions, and QR storage. The second adds daytime/evening pricing to online reservations and walk-ins. The third increases the original ₱150 evening rate to ₱200. The fourth adds weekend open-play passes and prevents private bookings during the shared session. The fifth adds staff-only finance reports, private notes, and walk-in payment classifications. The sixth adds an optional equipment set with a saved price and separate finance totals. The seventh adds the 50% reservation fee/full-payment choices, verified payments, and staff balance collection. The eighth sets the open-play limit to 24 participants across both courts (12 per court). The ninth adds editable private-court capacity and rental ball counts, preserving historical booking inclusions. Run **only migrations you have not already applied**. Existing reservations, totals, and custom rates are preserved; a custom evening rate can be changed in Venue settings.
3. Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` for local development and allow `http://localhost:3000/auth/callback**` as a redirect URL (the suffix permits booking-return and password-recovery query parameters). Use `localhost` consistently in your browser; `0.0.0.0` is a listening address, not the website URL. When deploying, add the production URL and callback and optionally set `NEXT_PUBLIC_SITE_URL` to that public origin. The app uses the incoming browser host for local callback redirects and keeps code-exchange session cookies. Confirm PKCE email links in the browser where signup started; if the link cannot restore that session, sign in with the confirmed email and password. See [Supabase's redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls) and [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow). Use a custom SMTP provider before a public launch.
4. Create your own account at `/login`, then confirm your email if required. In the SQL Editor, grant that account staff access (replace the example email with your actual account email):

```sql
insert into public.staff_members (user_id)
select id from auth.users where lower(email) = lower('your-email@example.com')
on conflict (user_id) do nothing;
```

5. Sign in, open `/admin/settings`, and save your venue details. Staff accounts land on `/admin` after signing in; customers land on `/my-bookings`. Signing in from a booking or other protected page returns to that page. Upload a real GCash QR or paste a direct **HTTPS image URL**, not a GCash app link or a file sharing page. An image is necessary for customers to see and save the QR.
6. Review the configured rates and hours, then add the GCash account name and QR image. Add an address, contact details, and your final cancellation/refund policy. Enable **Open online reservations** when ready. Existing reservations remain visible when you close new bookings.

Rates, hours, address, city, contact details, introduction, GCash details, unpaid hold duration, and cancellation policy are editable. Before a custom schedule is saved, starter hours are **6 AM–4 PM at ₱100/hour** and **4 PM–10 PM at ₱200/hour**. On weekdays, a booking spanning 3–5 PM totals **₱300**. Saturdays and Sundays offer **private court bookings from 6–9 AM**, **open play from 9 AM–4 PM at ₱50 per person**, then **private court bookings from 4–10 PM**. Open play accommodates **12 rotating players per court, with a 24-player limit across both courts in the legacy session**. Staff manages rotation between games; passes share the session rather than assigning players to a specific court. Current saved rates are preserved during conversion. The schedule, session prices, and player limits are editable in the new Booking schedule table. Customers and staff can choose multiple optional **₱30 rental sets containing 1 paddle + 1 ball each by default** per reservation. The charge is the saved per-set price multiplied by the selected quantity, included in the GCash total once per session. Court and open-play rates stay separate; no equipment inventory tracking is configured. Booking starts **closed**. Public pages work before setup and availability is labeled as a preview until the database is ready. Court slots start on the hour and bookings last 1–4 hours, up to 30 days ahead.

## Turnstile authentication protection

The app includes Cloudflare Turnstile on sign-in, sign-up, password-reset requests, and the signed-in password-change form's current-password verification. It uses the public sitekey `0x4AAAAAAFnx7p5dsT8C-AVD` by default. To change it, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel (Production and any applicable Preview environments), then redeploy. No secret key is stored in the app.

Rollout order:

1. In Cloudflare, allow `ascentpickleball.vercel.app` on the matching **Managed** widget. Add any other actual deployment hostnames explicitly.
2. Deploy this app update first and confirm the widget renders on login, signup, password reset, and account settings.
3. In Supabase **Authentication → Bot and Abuse Protection**, enable CAPTCHA, select **Cloudflare Turnstile**, and save the matching widget's **Secret key** directly in Supabase. Keep the secret out of Git, client code, and `NEXT_PUBLIC_` variables.
4. Test customer and staff sign-in, registration, reset email requests, and changing a password. An authenticated password-recovery link updates the password using its existing Supabase session; that update does not use a second CAPTCHA.

Supabase performs authoritative token verification for the Auth endpoints, including direct requests that bypass the website. The app passes tokens through the supported `captchaToken` options, resets verification after every attempt or mode change, and clears expired/failed checks. Do not validate the same token separately in Next.js: Turnstile tokens are single use. Disabling the submit button alone is not bot protection; the Supabase CAPTCHA setting must also be enabled after deployment. No database migration is required.

For isolated local testing, override the public sitekey with Cloudflare's documented dummy keys and use a separate test Supabase project with its matching dummy secret, or a local auth stub. Production rejects dummy-key overrides. Dummy tokens cannot authenticate against a production Turnstile secret. Cloudflare recommends keeping local hostnames off the production widget; use separate development configuration. Do not enable CAPTCHA on the live project with a test secret. See [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [Turnstile widget options](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/), and [official test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Schedule editor rollout

Apply **`supabase/migrations/202610260010_schedule_editor.sql`** after migration 009, then deploy the updated app. This additive migration leaves `schedule_config` null, so the current schedule and all saved reservations continue unchanged. If it has not been applied, the editor shows a setup notice and disables saving.

In **Venue settings → Booking schedule**, edit the regular weekly table or add a temporary override with inclusive first/last dates. Select weekdays, whole-hour start/end times, private booking or open play, a rate, and a player limit. Private rates are per court/hour; open-play rates and limits apply separately to each session across both courts. Unlisted days and gaps are closed. End-of-day midnight is supported. **Save schedule** saves the entire table together; the other venue settings have their own save controls.

**Use introductory-week template** prepares a draft for the current Monday–Sunday in Philippine Time. Review its dates and save to activate it. The template contains Monday–Thursday private 6–8 AM at ₱100/hour, open play 8 AM–5 PM at ₱50/person/session, and private 5–10 PM at ₱200/hour. Friday–Sunday has private 6–9 AM at ₱100/hour, open play 9 AM–5 PM at ₱100/person/session, and a separate 5–10 PM open-play session at ₱100/person/session. Each open-play session has 24 places across both courts; private courts allow 8 players.

Temporary overrides replace the weekly schedule within their date range and automatically give way to regular hours afterward. Their date ranges cannot overlap. Existing reservations keep their saved prices, equipment inclusions, and payment terms. The database rejects schedule changes that remove reserved private time, change a reserved open-play session's boundaries, or reduce a session below its reserved player count. Resolve those reservations with customers before changing the affected hours. Concurrent staff edits require reloading the newer saved schedule.

Customer calendars, staff walk-ins, session availability, prices, and homepage schedules use the same effective date-based schedule. Active reservations and unpaid holds consume places in their selected session only. Prices and capacity are validated in Postgres, including requests from older clients. Regular weekly and temporary schedule edits require staff access. Tests use an isolated database and do not write live bookings.

## Booking request limits

Apply `supabase/migrations/202610270011_booking_rate_limits.sql` **after migration 010 and deployment of this app version**. The new app fails closed with a setup message until migration 011 is installed. The migration revokes direct customer access to older mutation RPCs, so old deployments/browser tabs must be updated or refreshed. Do not roll back the app alone to an older booking implementation after applying it. Existing reservations, saved prices, payment details, and venue settings are preserved.

Each signed-in account can make **five reservation attempts per rolling ten minutes**, shared between private courts and open play. Cancellations and initial payment-reference submissions each have their own five-attempt/ten-minute allowance. Failed validation, unavailable slots, invalid references, and attempts against reservations the caller does not own count too. Cancelling a reservation does not refund its creation attempt. Browsing availability and staff calendar walk-ins/blocks are unaffected. The two-pending-reservation cap still applies separately.

Every customer mutation goes through `request_customer_booking`, including forms rejected by server validation. An atomic, row-locked counter in the non-public `private` schema is shared across servers and browser tabs; it stores at most three rows of five timestamps per account and is deleted with the account. Its clock is the database clock. No extra service, API secret, in-memory cache, or client-supplied user ID/IP is used. Customers cannot read, clear, or modify counters, and older customer creation/payment/cancellation RPCs cannot be called directly. The remaining `reserve_scheduled_booking` entry point verifies staff membership before delegating.

The gateway returns a structured `error`, `code`, and `retry_after_seconds` on cooldown; the UI displays the retry time in minutes. Business errors use the same response envelope. **These are normal RPC responses, not HTTP errors**: the transaction must commit its attempt counter even when the underlying booking operation rolls back. Clients must inspect the response's `error` field. Only the business operation runs inside an exception subtransaction; counters stay outside it. Unexpected database details are hidden from the customer. Request timeouts/connection failures that abort the entire transaction cannot retain a counter increment.

This is account-based booking abuse protection, separate from Supabase Auth/Turnstile and network-level flood protection. It does not limit public reads, anonymous traffic, privileged staff actions, or an attacker spreading requests over many accounts. An additional trusted-IP limit at the hosting/API edge can be added separately; do not trust an arbitrary forwarded header or throttle all venue Wi-Fi customers as one account.

## Multiple equipment sets

Apply `supabase/migrations/202610270012_equipment_quantity.sql` after migration 011, **before deploying the quantity-selector app**. The migration is compatible with existing one-set clients. The new app uses `request_customer_booking_v2` and `reserve_staff_equipment_booking`; these fail closed until migration 012 is installed, preventing a multiple-set quote from being silently charged as one set.

Use the compact **Equipment** minus/plus controls or type a quantity; **0 means no rental**. Private rentals are capped by the lowest player limit across the booked hours (the default is 8); open-play rentals cannot exceed the number of passes in that reservation. One set contains one paddle and the configured number of balls. Each quantity is charged once per session, rather than once per court hour. The quantity, per-set price, ball count per set, and equipment total are saved on the booking. The database calculates all amounts and includes the entire rental charge in both full payments and the 50% reservation fee.

Previous rentals become quantity 1 with their original price and ball count; no historical total or payment is changed. Customer booking details, booking history, staff calendar, finance details, and daily CSV exports show the saved quantity. Confirmed walk-ins include the quantity in the collected amount. No rental inventory or automatic membership discount is introduced. Customer gateway versions share the same request-limit counter, and direct access to the new internal helper is revoked.

## Main routes

| Route             | Purpose                                                                             |
| ----------------- | ----------------------------------------------------------------------------------- |
| `/`               | Responsive venue website, both courts, FAQs, directions when configured             |
| `/book`           | Public availability and reservation flow                                            |
| `/membership`     | Annual membership benefits and staff enrollment through Facebook                    |
| `/court-rules`    | Court time, capacity, equipment, etiquette, and safety rules                          |
| `/login`          | Sign up, log in, password recovery                                                  |
| `/account`        | Signed-in customers and staff: change password after verifying the current password |
| `/my-bookings`    | Your reservations and statuses                                                      |
| `/booking/[id]`   | Booking details, GCash QR, payment reference, unpaid cancellation                   |
| `/admin`          | Staff calendar, GCash reviews, confirmed walk-ins, maintenance blocks               |
| `/admin/settings` | Editable venue details, rates/hours, QR upload, booking toggle                      |
| `/admin/finance`  | Daily log, monthly sales/hours, payment methods, private staff notes, CSV downloads |
| `/privacy`        | Basic notice covering the implemented data collection                               |

## Reservation behavior

- A database exclusion constraint prevents overlapping court reservations even when requests arrive together. Adjacent bookings and bookings on the other court remain valid.
- Open-play passes cover one selected session, with 1–20 players per reservation. Each session has its own optional player limit; leaving it blank allows unlimited players. A database lock protects capacity and prevents private bookings or maintenance blocks from conflicting with active passes.
- Rates, time blocks, session capacity, and private-court player limits are saved together with **Save schedule**. The equipment price, rental ball count, default private capacity, and unpaid hold duration retain individual **Apply** buttons. These defaults are separate from the limits saved in existing schedule rows. Native clock pickers accept whole hours, including midnight at the end of a day.
- Membership is ₱300 for one year. Enrollment, payment, verification, and benefit redemption are arranged with staff through the configured Facebook page. The displayed ₱30 court discount applies once to the booking total for bookings longer than one hour. Membership status and discounts are not automatically applied by the online booking system.
- Rental ball counts are saved per booking. Existing rental reservations retain the previously advertised 2 balls; new reservations use the configured ball count. Capacity and equipment inclusions appear on the homepage, court rules, and booking flow. Full court rules are linked from the booking agreements and footer.
- Passes use the same GCash reference, hold, confirmation, cancellation, and account pages as court bookings. Staff can record paid walk-in passes in the calendar. Prices and session times are saved on each reservation, preserving past totals when settings change.
- Existing court reservations are preserved. If one overlaps an open-play session, pass sales for that session stay unavailable until staff resolves the conflict. Schedule changes are prevented while future active reservations depend on the existing hours.
- Database functions calculate prices from saved venue settings, enforce Philippine Time, validate future dates/opening hours, and limit each player to two pending reservations.
- New reservations start `awaiting_payment` with a configurable deadline (30 minutes by default).
- A submitted GCash reference moves the reservation to `awaiting_verification`; it is not payment verification. References cannot be reused across bookings. Staff must check incoming transactions in their own GCash app.
- Customers can choose a **50% reservation fee** or **full payment** for courts and open play. The fee is half of the entire saved total, including selected equipment, rounded to the nearest centavo. Full payment is the default. Verifying a fee confirms the reservation and records only that fee as paid; the remaining balance is due at the venue before play. Staff records the collected balance from the court calendar or finance log, choosing its actual payment method. The database calculates the exact balance and rejects duplicate settlement and reused references. Existing bookings retain full-payment terms.
- Holds with no submitted payment reference expire on availability reads, booking attempts, or account/calendar views. A background scheduler is not required for correctness: availability always cleans stale holds first. Pending verification does not expire automatically, protecting players who have submitted payment details.
- If a customer pays after a hold expires, they must contact the venue; do not silently reconfirm a released slot. Staff can resolve the payment manually and create another reservation if a court is available.
- Players can cancel only unpaid reservations. Staff handles changes to paid bookings and refunds manually. Staff walk-ins are recorded as confirmed, so payment should be collected before saving.
- Row Level Security hides player details from the public, isolates each player's reservations, and limits staff membership and settings changes. QR uploads accept only PNG, JPEG, and WebP up to 2 MB. Only staff can upload them.
- No confirmation email service is configured. Booking status updates are shown in the account and booking pages. Supabase handles authentication emails.

## Finance reports

The Finance tab follows the supplied daily rental log and monthly summary. It reads existing bookings automatically. **Verified collections are grouped by Philippine play date**, including future confirmed reservations; this is not a cash-receipt-date or profit statement. Confirmed booking value and unpaid balances appear separately from collections. A verified 50% fee contributes only the amount received. Pending, cancelled, expired, and blocked bookings do not contribute to collections. Open-play collections and player counts are separate from private court collections and booked hours.

Staff can record Cash, GCash, Bank transfer, Card, or Other for paid walk-ins and balance payments. These labels record payment collected externally; they do not add payment processing. Online initial payments remain GCash; a later venue balance can use a different method. Older walk-ins start as **Not recorded** rather than guessing their payment method. Staff can classify initial payments and add private reservation notes from the daily log. Worker on duty and manager notes are saved per day and are visible only to staff.

Daily and monthly CSV downloads open in Excel. The daily download includes all records for that date, regardless of the displayed page. Monthly totals cover the actual calendar month, including leap years, and are aggregated in Postgres rather than being truncated at an API row limit. Equipment collections are allocated proportionally to the verified amount, rounded to centavos; court/pass collections receive the remainder so totals reconcile. Saved hourly averages exclude equipment and use the full saved booking value. CSVs include payment terms, collections, and unpaid balances. Expenses and refunds are outside these reports. A cancelled paid booking is excluded from collections; refunds must still be handled separately.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

The database suite runs the **actual migrations** in an isolated PGlite Postgres database with minimal Supabase auth/storage fixtures. It checks RLS, overlapping slots, staff permissions, reference ownership/reuse, expiration, tiered pricing, preservation of existing totals, weekend session boundaries, shared passes, capacity, and the booking lifecycle without writing test records to your live Supabase project. Production Supabase migrations must be applied separately.

## Design and launch notes

The homepage uses a wide venue photo hero with its headline, description, booking links, and venue caption. The caption's circled arrow is removed. Decorative starbursts use SVGs so they render consistently across desktop and mobile platforms.

The green and lime palette, wordmark, and original SVG court illustrations are starter branding and artwork. Replace the illustrations with venue photography when available. The privacy notice describes implemented behavior; update venue contact details and business policies before opening reservations. Hosting and a domain have not been provisioned; the app can be deployed to any compatible Next.js Node host with the two public environment variables configured.
