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
2. Run the SQL files in `supabase/migrations/` in order: `202610230001_initial.sql`, `202610230002_time_based_rates.sql`, `202610230003_evening_rate_200.sql`, `202610230004_weekend_open_play.sql`, `202610230005_finance.sql`, `202610230006_equipment_rental.sql`, then `202610240007_payment_options.sql`. The first creates the courts, settings, staff membership, booking rules, permissions, and QR storage. The second adds daytime/evening pricing to online reservations and walk-ins. The third increases the original ₱150 evening rate to ₱200. The fourth adds weekend open-play passes and prevents private bookings during the shared session. The fifth adds staff-only finance reports, private notes, and walk-in payment classifications. The sixth adds an optional equipment set with a saved price and separate finance totals. The seventh adds the 50% reservation fee/full-payment choices, verified payments, and staff balance collection. Run **only migrations you have not already applied**. Existing reservations, totals, and custom rates are preserved; a custom evening rate can be changed in Venue settings.
3. Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` for local development and allow `http://localhost:3000/auth/callback**` as a redirect URL (the suffix permits booking-return and password-recovery query parameters). Use `localhost` consistently in your browser; `0.0.0.0` is a listening address, not the website URL. When deploying, add the production URL and callback and optionally set `NEXT_PUBLIC_SITE_URL` to that public origin. The app uses the incoming browser host for local callback redirects and keeps code-exchange session cookies. Confirm PKCE email links in the browser where signup started; if the link cannot restore that session, sign in with the confirmed email and password. See [Supabase's redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls) and [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow). Use a custom SMTP provider before a public launch.
4. Create your own account at `/login`, then confirm your email if required. In the SQL Editor, grant that account staff access (replace the example email with your actual account email):

```sql
insert into public.staff_members (user_id)
select id from auth.users where lower(email) = lower('your-email@example.com')
on conflict (user_id) do nothing;
```

5. Sign in, open `/admin/settings`, and save your venue details. Staff accounts land on `/admin` after signing in; customers land on `/my-bookings`. Signing in from a booking or other protected page returns to that page. Upload a real GCash QR or paste a direct **HTTPS image URL**, not a GCash app link or a file sharing page. An image is necessary for customers to see and save the QR.
6. Review the configured rates and hours, then add the GCash account name and QR image. Add an address, contact details, and your final cancellation/refund policy. Enable **Open online reservations** when ready. Existing reservations remain visible when you close new bookings.

Rates, hours, address, city, contact details, introduction, GCash details, unpaid hold duration, and cancellation policy are editable. Both courts are configured for **6 AM–4 PM at ₱100/hour** and **4 PM–10 PM at ₱200/hour**. On weekdays, a booking spanning 3–5 PM totals **₱300**. Saturdays and Sundays offer **private court bookings from 6–9 AM**, **open play from 9 AM–4 PM at ₱50 per person**, then **private court bookings from 4–10 PM**. Open play shares both courts with player rotation and has **no daily player limit** by default. The schedule, pass price, and optional player limit are editable in Venue settings. Customers and staff can select one optional **₱30 rental set containing 1 paddle + 2 balls** per reservation. The charge is added **once per booking**, included in the GCash total, and saved at the current equipment price. Court and open-play rates stay separate; no equipment inventory tracking is configured. Booking starts **closed**. Public pages work before setup and availability is labeled as a preview until the database is ready. Court slots start on the hour and bookings last 1–4 hours, up to 30 days ahead.

## Main routes

| Route             | Purpose                                                                             |
| ----------------- | ----------------------------------------------------------------------------------- |
| `/`               | Responsive venue website, both courts, FAQs, directions when configured             |
| `/book`           | Public availability and reservation flow                                            |
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
- Weekend open-play passes cover the full shared session, with 1–20 players per reservation. The daily player limit is optional; leaving it blank allows unlimited players. A database lock protects optional capacity and prevents private bookings or maintenance blocks from conflicting with active passes.
- Passes use the same GCash reference, hold, confirmation, cancellation, and account pages as court bookings. Staff can record paid walk-in passes in the calendar. Prices and session times are saved on each reservation, preserving past totals when settings change.
- Existing court reservations are preserved when open play is enabled. If one overlaps a weekend session, pass sales for that date stay unavailable until staff resolves the conflict. Schedule changes are prevented while future active passes depend on the existing hours.
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
