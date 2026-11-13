import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { centavos, cartTotal, collectionsCsv, dayKey, reportFor, type PosData } from "../src/lib/pos";

test("centavo arithmetic and payment-date reports preserve deposits and refunds", () => {
  assert.equal(centavos("175.25"), 17525);
  assert.equal(centavos("0.01"), 1);
  for (const n of ["-1", "0.001", "NaN", "1e3", ""])
    assert.throws(() => centavos(n));
  assert.equal(
    cartTotal([
      { price_cents: 10, quantity: 3 },
      { price_cents: 20, quantity: 1 },
    ]),
    50,
  );
  assert.equal(dayKey("2026-11-03T20:00:00Z"), "2026-11-04");
  const data: PosData = {
    products: [], sales: [], bookings: [], shifts: [], movements: [], role: "manager", ready: true,
    payments: [
      { id: "deposit", sale_id: "court", amount_cents: 20000, method: "gcash", reference: null, shift_id: null, created_at: "2026-11-03T10:00:00Z" },
      { id: "balance", sale_id: "court", amount_cents: 20000, method: "cash", reference: null, shift_id: "shift", created_at: "2026-11-03T20:00:00Z" },
    ],
    refunds: [
      { id: "refund", sale_id: "court", amount_cents: 40000, method: "cash", reason: "Cancelled", shift_id: "shift", created_at: "2026-11-04T05:00:00Z" },
    ],
  };
  assert.equal(reportFor(data, "2026-11-03").collected, 20000);
  assert.equal(reportFor(data, "2026-11-04").collected, 20000);
  assert.equal(reportFor(data, "2026-11-04").net, -20000);
  const csv = collectionsCsv(data, "2026-11-04");
  assert.ok(csv.includes('"Payment","cash","","200"'));
  assert.ok(csv.includes('"Refund","cash","","-400"'));
  assert.ok(!csv.includes('"gcash"'));
});

test("full database: atomic checkout, ledger integrity, permissions, booking deposits and shifts", async (t) => {
  const db = new PGlite({ extensions: { btree_gist } });
  const owner = randomUUID(),
    cashier = randomUUID(),
    player = randomUUID();
  async function as<T>(
    user: string,
    fn: () => Promise<T>,
    role = "authenticated",
  ) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    await db.exec(`set role ${role}`);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  }
  const call = async <T>(user: string, fn: string, args: unknown[] = []) =>
    as(user, () =>
      db.query<{ value: T }>(
        `select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
        args,
      ),
    ).then((r) => r.rows[0].value);
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema storage;create schema extensions;set search_path=public,extensions;grant usage on schema public,auth,storage to anon,authenticated;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,update on storage.objects to anon,authenticated;alter default privileges grant execute on functions to anon,authenticated;alter default privileges grant all on tables to anon,authenticated;`,
    );
    const files = (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files.filter((f) => f < "202611040013"))
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.query(
      "insert into auth.users values($1,'owner@test.example'),($2,'cashier@test.example'),($3,'player@test.example')",
      [owner, cashier, player],
    );
    await db.query(
      "insert into public.staff_members(user_id) values($1)",
      [owner],
    );
    const today = dayKey();
    const blocks = [
      { id: "private-morning", days: [1, 2, 3, 4, 5, 6, 7], start: 6, end: 8, kind: "court", rate: 100, capacity: 8 },
      { id: "open-morning", days: [1, 2, 3, 4, 5, 6, 7], start: 8, end: 12, kind: "open_play", rate: 50, capacity: 24 },
      { id: "open-afternoon", days: [1, 2, 3, 4, 5, 6, 7], start: 12, end: 16, kind: "open_play", rate: 50, capacity: 24 },
      { id: "private-evening", days: [1, 2, 3, 4, 5, 6, 7], start: 16, end: 22, kind: "court", rate: 200, capacity: 8 },
    ];
    const schedule = { weekly: blocks, overrides: [{ id: "temporary", name: "Today’s schedule", start_date: today, end_date: today, blocks }] };
    await call(owner, "save_booking_schedule", [JSON.stringify(schedule), null]);
    const legacyPaid = randomUUID(), legacyDeposit = randomUUID(), savedBlock = randomUUID();
    await db.query(`insert into public.bookings(id,user_id,court_id,booking_date,start_hour,duration,total_amount,status,customer_name,customer_phone,payment_option,payment_reference)
      values($1,null,1,$4::date-1,6,1,100,'confirmed','Existing walk-in','09171234567','full',null),
      ($2,$5,1,$4::date-1,7,1,100,'confirmed','Existing deposit','09171234567','reservation_fee','LEGACY-123456'),
      ($3,null,2,$4::date,16,1,200,'blocked','Existing block','09171234567','full',null)`,
      [legacyPaid, legacyDeposit, savedBlock, today, player]);
    await call(owner, "staff_save_booking_finance", [legacyPaid, "cash", "Original notes"]);
    const readCurrentData = async () => ({
      settings: (await db.query("select * from public.venue_settings")).rows,
      bookings: (await db.query("select * from public.bookings order by id")).rows,
      finance: (await db.query("select * from public.booking_finance order by booking_id")).rows,
      schedule: await call<unknown>(player, "get_booking_schedule", [today]),
    });
    const previous = await readCurrentData();
    for (const file of files.filter((f) => f >= "202611040013" && f < "202611110018"))
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await t.test("cutover preserves today's published schedule, bookings, staff access, and finance records", async () => {
      assert.deepEqual(await readCurrentData(), previous);
      assert.equal(await call(owner, "club_role"), "manager");
      assert.equal((await db.query("select * from public.pos_payments")).rows.length, 0);
      await call(owner, "staff_save_booking_finance", [legacyPaid, "cash", "Updated notes"]);
      assert.equal((await db.query("select * from public.pos_sales")).rows.length, 0);
      await assert.rejects(
        () => call(owner, "pos_collect_balance", [legacyDeposit, "gcash", "legacy123456"]),
        /reference is already/,
      );
      await call(owner, "staff_record_balance", [legacyDeposit, "bank_transfer", ""]);
      const ledger = (await db.query("select s.paid_cents,p.amount_cents,p.method,p.shift_id from public.pos_sales s join public.pos_payments p on s.id=p.sale_id where s.booking_id=$1", [legacyDeposit])).rows;
      assert.deepEqual(ledger, [{ paid_cents: 10000, amount_cents: 5000, method: "bank_transfer", shift_id: null }]);
    });
    await db.exec("update public.venue_settings set schedule_config=null");
    await db.query("update public.staff_members set role='owner' where user_id=$1", [owner]);
    await db.query("insert into public.staff_members(user_id,role) values($1,'cashier')", [cashier]);
    const legacyReview = randomUUID();
    await db.query(
      `insert into public.bookings(id,user_id,court_id,booking_date,start_hour,duration,total_amount,
        status,customer_name,customer_phone,payment_reference,hold_expires_at)
       values($1,$2,1,current_date-3,18,1,200,'awaiting_verification','Legacy Review','09171234567',
        'OLD-REVIEW-123',now()-interval '2 hours')`,
      [legacyReview, player],
    );
    for (const file of files.filter((f) => f >= "202611110018" && f < "202611130020"))
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));

    await t.test("GCash review finds overdue bookings across dates and safely releases rejected court time and open-play capacity", async () => {
      const day = (await db.query<{ date: string }>(
        "select ((now() at time zone 'Asia/Manila')::date + 2)::text date",
      )).rows[0].date;
      await db.query(
        "update public.venue_settings set booking_enabled=true,gcash_name='Ascent',gcash_qr_url='https://example.com/qr.png',schedule_config=$1",
        [JSON.stringify({ weekly: blocks, overrides: [] })],
      );
      const request = (action: string, input: object) =>
        call<{ id?: string; success?: boolean; error?: string }>(player, "request_customer_booking_v2", [action, JSON.stringify(input)]);
      const court = { booking_date: day, court_id: 1, start_hour: 17, duration: 1, customer_name: "Review Player", customer_phone: "09171234567" };
      const reserved = await request("reserve_court", court);
      assert.ok(reserved.id, reserved.error);
      const reference = "REVIEW-123456";
      assert.deepEqual(await request("payment", { booking_id: reserved.id, reference }), { success: true });

      const queue = () => as(cashier, () => db.query<{
        id: string; overdue: boolean; payment_submitted_at: string | null;
      }>("select * from public.pos_payment_reviews()")).then((r) => r.rows);
      const pending = await queue();
      assert.deepEqual(pending.map(({ id, overdue }) => ({ id, overdue })), [
        { id: legacyReview, overdue: true }, { id: reserved.id, overdue: false },
      ]);
      assert.equal(pending[0].payment_submitted_at, null);
      assert.ok(pending[1].payment_submitted_at);
      assert.equal(Object.hasOwn(pending[0], "customer_phone"), false);
      await assert.rejects(() => call(player, "pos_payment_reviews"), /staff access/);
      await assert.rejects(() => as("", () => db.query("select * from public.pos_payment_reviews()"), "anon"), /permission denied/);
      await assert.rejects(() => call(player, "pos_reject_booking_payment", [reserved.id, "No matching payment"]), /staff access/);
      await assert.rejects(() => call(cashier, "pos_reject_booking_payment", [reserved.id, " "]), /rejection reason/);

      await db.query("update public.bookings set payment_submitted_at=now()-interval '31 minutes',hold_expires_at=now()-interval '30 minutes' where id=$1", [reserved.id]);
      await call(cashier, "expire_unpaid_holds");
      assert.equal((await queue()).find((b) => b.id === reserved.id)?.overdue, true);
      assert.ok((await request("reserve_court", court)).error, "Overdue reviews still hold the court");

      await call(cashier, "pos_reject_booking_payment", [reserved.id, "No matching incoming payment"]);
      assert.equal((await queue()).some((b) => b.id === reserved.id), false);
      await assert.rejects(() => call(cashier, "pos_verify_booking", [reserved.id]), /Only a submitted/);
      assert.deepEqual((await db.query(
        "select status,payment_reference,payment_rejected_at is not null as rejected,paid_amount::int from public.bookings where id=$1",
        [reserved.id],
      )).rows, [{ status: "cancelled", payment_reference: null, rejected: true, paid_amount: 0 }]);
      assert.equal((await db.query("select 1 from public.pos_sales where booking_id=$1", [reserved.id])).rows.length, 0);
      assert.deepEqual((await db.query(
        "select actor_id,detail->>'reason' reason,detail->>'reference' reference from public.pos_audit where entity_id=$1 and action='booking.payment.reject'",
        [reserved.id],
      )).rows, [{ actor_id: cashier, reason: "No matching incoming payment", reference }]);
      await call(cashier, "pos_reject_booking_payment", [legacyReview, "No matching incoming payment"]);

      const replacement = await request("reserve_court", court);
      assert.ok(replacement.id, replacement.error);
      assert.deepEqual(await request("payment", { booking_id: replacement.id, reference }), { success: true });
      await call(cashier, "pos_verify_booking", [replacement.id]);
      await assert.rejects(() => call(cashier, "pos_reject_booking_payment", [replacement.id, "Stale rejection"]), /Only an unpaid booking/);

      const remainingPasses = async () => (await db.query<{ remaining: number }>(
        "select remaining from public.get_open_play_sessions($1) where start_hour=8", [day],
      )).rows[0].remaining;
      const openPlay = await request("reserve_open_play", { ...court, start_hour: 8, participant_count: 3 });
      assert.ok(openPlay.id, openPlay.error);
      assert.deepEqual(await request("payment", { booking_id: openPlay.id, reference: "OPEN-REVIEW-123" }), { success: true });
      assert.equal(await remainingPasses(), 21);
      await call(cashier, "pos_reject_booking_payment", [openPlay.id, "Reference could not be matched"]);
      assert.equal(await remainingPasses(), 24);
      await db.exec("update public.venue_settings set schedule_config=null");
    });

    await t.test("cashier reservation view excludes private contact fields and rejects customers", async () => {
      await assert.rejects(() => call(player, "pos_reservations", [today]), /staff access/);
      const raw = await as(cashier, () => db.query("select id from public.bookings where id=$1", [savedBlock]));
      assert.equal(raw.rows.length, 0);
      const visible = await as(cashier, () => db.query("select * from public.pos_reservations($1) where id=$2", [today, savedBlock]));
      assert.equal(visible.rows.length, 1);
      assert.equal(Object.hasOwn(visible.rows[0] as object, "customer_phone"), false);
      assert.equal(Object.hasOwn(visible.rows[0] as object, "user_id"), false);
      assert.equal(Object.hasOwn(visible.rows[0] as object, "notes"), false);
    });
    let product: string = "",
      shift: string = "";
    const key = randomUUID();
    const request = {
      key,
      items: [] as {
        product_id: string;
        quantity: number;
        price_cents: number;
      }[],
      method: "cash",
      reference: "",
      tendered_cents: 10000,
      customer_name: "Test customer",
      verified: true,
    };
    await t.test(
      "anonymous and customer calls cannot mutate or read the POS ledger",
      async () => {
        assert.equal(await call(player, "is_club_staff"), false);
        await assert.rejects(
          () => call(player, "pos_open_shift", [0]),
          /staff access/,
        );
        await assert.rejects(
          () =>
            as("", () => db.query("select public.pos_open_shift(0)"), "anon"),
          /permission denied/,
        );
        const rows = await as(player, () =>
          db.query("select * from public.pos_products"),
        );
        assert.equal(rows.rows.length, 0);
        for (const name of [
          "pos_checkout(jsonb)",
          "pos_open_shift(integer)",
          "pos_refund(uuid,text,text,boolean)",
        ])
          assert.equal(
            (
              await db.query<{ allowed: boolean }>(
                "select has_function_privilege('anon',$1,'execute') allowed",
                [`public.${name}`],
              )
            ).rows[0].allowed,
            false,
          );
      },
    );
    await t.test(
      "manager product controls and a single open physical drawer",
      async () => {
        const p = {
          name: "Water",
          sku: "WTR-01",
          barcode: "48000001",
          category: "Drinks",
          price_cents: 3000,
          cost_cents: 1000,
          reorder_level: 2,
          active: true,
        };
        await assert.rejects(
          () => call(cashier, "pos_save_product", [p]),
          /Manager authorization/,
        );
        product = await call<string>(owner, "pos_save_product", [p]);
        await call(owner, "pos_adjust_stock", [product, 5, "Opening stock"]);
        await assert.rejects(
          () =>
            as(owner, () =>
              db.query("update public.pos_products set stock=999"),
            ),
          /permission denied/,
        );
        shift = await call<string>(owner, "pos_open_shift", [100000]);
        await assert.rejects(
          () => call(cashier, "pos_open_shift", [0]),
          /already has an open/,
        );
        request.items = [
          { product_id: product, quantity: 2, price_cents: 3000 },
        ];
      },
    );
    await t.test(
      "checkout retries return the original receipt and deduct stock once",
      async () => {
        const sale = await call<{ total_cents: number }>(
          owner,
          "pos_checkout",
          [request],
        );
        assert.equal(sale.total_cents, 6000);
        await call(owner, "pos_checkout", [request]);
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "select stock from public.pos_products where id=$1",
              [product],
            )
          ).rows[0].stock,
          3,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.pos_payments where sale_id=$1",
              [key],
            )
          ).rows.length,
          1,
        );
        await assert.rejects(
          () =>
            call(owner, "pos_checkout", [
              { ...request, customer_name: "Changed request" },
            ]),
          /checkout key was already used/,
        );
      },
    );
    await t.test(
      "overselling, stale prices, insufficient cash and duplicate lines roll back completely",
      async () => {
        for (const items of [
          [{ product_id: product, quantity: 4, price_cents: 3000 }],
          [{ product_id: product, quantity: 1, price_cents: 1 }],
          [
            { product_id: product, quantity: 1, price_cents: 3000 },
            { product_id: product, quantity: 1, price_cents: 3000 },
          ],
        ])
          await assert.rejects(
            () =>
              call(owner, "pos_checkout", [
                { ...request, key: randomUUID(), items },
              ]),
            /stock|price changed|Duplicate/,
          );
        await assert.rejects(
          () =>
            call(owner, "pos_checkout", [
              { ...request, key: randomUUID(), tendered_cents: 1 },
            ]),
          /Cash received/,
        );
        assert.equal(
          (await db.query("select * from public.pos_sales where kind='retail'")).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "select stock from public.pos_products where id=$1",
              [product],
            )
          ).rows[0].stock,
          3,
        );
      },
    );
    await t.test(
      "one GCash reference cannot pay for retail twice",
      async () => {
        const req = {
          ...request,
          key: randomUUID(),
          items: [{ product_id: product, quantity: 1, price_cents: 3000 }],
          method: "gcash",
          reference: "GC-123456",
        };
        await call(owner, "pos_checkout", [req]);
        await assert.rejects(
          () =>
            call(owner, "pos_checkout", [
              { ...req, key: randomUUID(), reference: "gc123456" },
            ]),
          /reference is already/,
        );
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "select stock from public.pos_products where id=$1",
              [product],
            )
          ).rows[0].stock,
          2,
        );
      },
    );
    await t.test(
      "customer deposit stays uncollected until cashier verification; balance posts exactly once",
      async () => {
        const booking = randomUUID();
        await db.query(
          "insert into public.bookings(id,user_id,court_id,booking_date,start_hour,duration,total_amount,status,customer_name,customer_phone,payment_option,payment_reference) values($1,$2,1,current_date+1,18,2,400,'awaiting_verification','Deposit Player','09171234567','reservation_fee','BOOK-123456')",
          [booking, player],
        );
        assert.equal(
          (
            await db.query(
              "select * from public.pos_sales where booking_id=$1",
              [booking],
            )
          ).rows.length,
          0,
        );
        await call(cashier, "pos_verify_booking", [booking]);
        let s = (
          await db.query<{ id: string; paid_cents: number }>(
            "select * from public.pos_sales where booking_id=$1",
            [booking],
          )
        ).rows[0];
        assert.equal(s.paid_cents, 20000);
        await assert.rejects(
          () => call(cashier, "pos_verify_booking", [booking]),
          /Only a submitted/,
        );
        await call(owner, "pos_collect_balance", [booking, "cash", ""]);
        s = (
          await db.query<{ id: string; paid_cents: number }>(
            "select * from public.pos_sales where booking_id=$1",
            [booking],
          )
        ).rows[0];
        assert.equal(s.paid_cents, 40000);
        assert.equal(
          (
            await db.query(
              "select * from public.pos_payments where sale_id=$1",
              [s.id],
            )
          ).rows.length,
          2,
        );
        await assert.rejects(
          () => call(owner, "pos_collect_balance", [booking, "cash", ""]),
          /no collectible balance/,
        );
        assert.equal(
          Number(
            (
              await db.query<{ paid_amount: string }>(
                "select paid_amount from public.bookings where id=$1",
                [booking],
              )
            ).rows[0].paid_amount,
          ),
          400,
        );
      },
    );
    await t.test(
      "booking and retail share normalized reference protection",
      async () => {
        await assert.rejects(
          () =>
            db.query(
              "insert into public.bookings(user_id,court_id,booking_date,start_hour,duration,total_amount,status,customer_name,customer_phone,payment_reference) values($1,2,current_date+1,18,1,200,'awaiting_verification','Repeat Ref','09171234567','GC123456')",
              [player],
            ),
          /reference is already/,
        );
        await assert.rejects(
          () =>
            call(owner, "pos_checkout", [
              {
                ...request,
                key: randomUUID(),
                items: [
                  { product_id: product, quantity: 1, price_cents: 3000 },
                ],
                method: "gcash",
                reference: "book123456",
              },
            ]),
          /reference is already/,
        );
      },
    );
    await t.test("cash walk-ins post one payment for the final rental quantity; unreferenced GCash walk-ins roll back", async () => {
      const day = (await db.query<{booking_day:string}>("select (current_date+1)::text as booking_day")).rows[0].booking_day;
      await db.exec("update public.venue_settings set open_play_enabled=false,opening_hour=6,closing_hour=22,hourly_rate=100,equipment_rental_price=30");
      const booking = await call<string>(owner,"reserve_staff_equipment_booking",["court",day,"Walk-in Player","09171234567",2,6,1,1,true,false,"cash","","full",2]);
      const ledger = (await db.query(
        "select s.total_cents,s.paid_cents,p.amount_cents,p.method,p.shift_id,b.equipment_quantity from public.pos_sales s join public.pos_payments p on p.sale_id=s.id join public.bookings b on b.id=s.booking_id where b.id=$1",
        [booking],
      )).rows;
      assert.deepEqual(ledger, [{ total_cents: 16000, paid_cents: 16000, amount_cents: 16000, method: "cash", shift_id: shift, equipment_quantity: 2 }]);
      await assert.rejects(()=>call(owner,"reserve_staff_equipment_booking",["court",day,"Missing GCash Ref","09171234567",2,7,1,1,false,false,"gcash","","full",0]),/verified transaction reference/);
      assert.equal((await db.query("select * from public.bookings where customer_name='Missing GCash Ref'")).rows.length,0);
      await assert.rejects(()=>call(owner,"staff_save_booking_finance",[booking,"card","Reclassify"]),/cannot be edited/);
    });
    await t.test(
      "manager refunds preserve original sale, restore stock once and reconcile cash",
      async () => {
        await assert.rejects(
          () =>
            call(cashier, "pos_refund", [
              key,
              "cash",
              "Returned unopened",
              true,
            ]),
          /Manager authorization/,
        );
        await call(owner, "pos_refund", [
          key,
          "cash",
          "Returned unopened",
          true,
        ]);
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "select stock from public.pos_products where id=$1",
              [product],
            )
          ).rows[0].stock,
          4,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.pos_payments where sale_id=$1",
              [key],
            )
          ).rows.length,
          1,
        );
        await assert.rejects(
          () => call(owner, "pos_refund", [key, "cash", "Try duplicate", true]),
          /cannot be refunded again/,
        );
        const summary = await as(owner, () =>
          db.query<{ expected_cents: number }>(
            "select expected_cents from public.pos_shift_summary()",
          ),
        );
        assert.equal(Number(summary.rows[0].expected_cents), 136000);
        await assert.rejects(
          () => call(cashier, "pos_close_shift", [shift, 120000]),
          /Only your active/,
        );
        await call(owner, "pos_close_shift", [shift, 135500]);
        const s = (
          await db.query<{ counted_cents: number; expected_cents: string }>(
            "select * from public.pos_shifts where id=$1",
            [shift],
          )
        ).rows[0];
        assert.equal(s.counted_cents - Number(s.expected_cents), -500);
        await assert.rejects(
          () =>
            call(owner, "pos_checkout", [{ ...request, key: randomUUID() }]),
          /Open your cashier shift/,
        );
      },
    );
    await t.test(
      "stock and audit ledgers remain append-only to authenticated users",
      async () => {
        for (const table of [
          "pos_payments",
          "pos_sale_items",
          "pos_refunds",
          "pos_stock_movements",
          "pos_audit",
        ])
          await assert.rejects(
            () => as(owner, () => db.query(`delete from public.${table}`)),
            /permission denied/,
          );
        assert.ok(
          (await db.query("select * from public.pos_audit")).rows.length > 5,
        );
      },
    );
    await t.test("expense access, retries, monthly totals, and drawer reconciliation", async () => {
      const date = dayKey();
      const month = `${date.slice(0, 7)}-01`;
      const record = async (user: string, args: unknown[]) =>
        (await call<Date>(user, "pos_record_expense", args)).toISOString().slice(0, 10);
      type Report = { row_count: number; total_cents: number; drawer_cents: number; rows: { id: string; void_reason: string | null }[] };
      const report = (user: string, page = 1) => call<Report>(user, "pos_expense_report", [month, page]);
      const drawerShift = await call<string>(cashier, "pos_open_shift", [10000]);
      const drawer = [randomUUID(), null, "supplies", "Court supplies", 1225, "cash", drawerShift];
      const anotherDrawer = [randomUUID(), null, "maintenance", "Court repair", 2000, "cash", drawerShift];
      const bill = [randomUUID(), date, "utilities", "Electricity", 3500, "gcash", null];
      const expected = async () => Number((await as(cashier, () =>
        db.query<{ expected_cents: number }>("select expected_cents from public.pos_shift_summary() where id=$1", [drawerShift]),
      )).rows[0].expected_cents);

      const before = await readCurrentData();
      for (const file of files.filter((f) => f >= "202611130020"))
        await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
      assert.deepEqual(await readCurrentData(), before);

      await assert.rejects(() => report(player), /Authorized staff/);
      await assert.rejects(() => as("", () => db.query("select * from public.pos_expenses"), "anon"), /permission denied/);
      await assert.rejects(() => record(player, drawer), /Authorized staff/);
      await assert.rejects(() => record(cashier, bill), /Manager authorization/);
      await assert.rejects(() => record(owner, drawer), /Open your cashier shift/);
      await assert.rejects(() => record(cashier, [...drawer.slice(0, 5), "gcash", drawerShift]), /valid expense/);
      await assert.rejects(() => record(owner, [randomUUID(), "2100-12-31", ...bill.slice(2)]), /today or an earlier date/);
      assert.equal(await record(cashier, drawer), date);
      assert.equal(await record(cashier, drawer), date);
      await assert.rejects(() => record(cashier, [...drawer.slice(0, 4), 100, ...drawer.slice(5)]), /different expense/);
      assert.equal(await expected(), 8775);
      assert.equal(await record(cashier, anotherDrawer), date);
      await record(owner, bill);
      assert.equal((await report(cashier)).row_count, 2);
      assert.equal((await report(owner)).total_cents, 6725);
      assert.equal((await report(owner)).drawer_cents, 3225);
      assert.equal((await as(player, () => db.query("select id from public.pos_expenses"))).rows.length, 0);
      await assert.rejects(() => as(owner, () => db.query("delete from public.pos_expenses")), /permission denied/);
      await assert.rejects(() => call(cashier, "pos_void_expense", [drawer[0], "Correction"]), /Manager authorization/);

      await call(owner, "pos_void_expense", [anotherDrawer[0], "Duplicate entry"]);
      assert.equal(await expected(), 8775);
      await call(cashier, "pos_close_shift", [drawerShift, 8775]);
      assert.equal(await record(cashier, drawer), date);
      await assert.rejects(() => record(cashier, [randomUUID(), ...drawer.slice(1)]), /Open your cashier shift/);
      await call(owner, "pos_void_expense", [drawer[0], "Entered in error"]);
      await call(owner, "pos_void_expense", [drawer[0], "Retry"]);
      assert.equal(await expected(), 8775);
      assert.equal((await report(owner)).total_cents, 3500);
      assert.equal((await report(owner)).rows.find((row) => row.id === drawer[0])?.void_reason, "Entered in error");
      const audit = await db.query<{ action: string }>("select action from public.pos_audit where entity_id=$1 order by created_at", [drawer[0]]);
      assert.deepEqual(audit.rows.map((row) => row.action), ["expense.record", "expense.void"]);

      for (let i = 0; i < 23; i++) await record(owner, [randomUUID(), ...bill.slice(1)]);
      const firstPage = await report(owner);
      const secondPage = await report(owner, 2);
      assert.equal(firstPage.rows.length, 25);
      assert.equal(secondPage.rows.length, 1);
      assert.equal(secondPage.total_cents, 84000);
      assert.ok(!firstPage.rows.some((row) => row.id === secondPage.rows[0].id));
    });
  } finally {
    await db.close();
  }
});
