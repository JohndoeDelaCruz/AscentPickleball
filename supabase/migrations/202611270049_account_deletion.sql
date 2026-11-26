begin;

-- Keep ledger rows even when the account that operated the register is gone.
alter table public.pos_shifts
  alter column cashier_id drop not null,
  drop constraint pos_shifts_cashier_id_fkey,
  add foreign key (cashier_id) references auth.users(id) on delete set null,
  add constraint open_shift_requires_cashier check (closed_at is not null or cashier_id is not null);
alter table public.pos_sales
  drop constraint pos_sales_cashier_id_fkey,
  add foreign key (cashier_id) references auth.users(id) on delete set null;
alter table public.pos_payments
  drop constraint pos_payments_actor_id_fkey,
  add foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.pos_refunds
  alter column actor_id drop not null,
  drop constraint pos_refunds_actor_id_fkey,
  add foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.pos_stock_movements
  alter column actor_id drop not null,
  drop constraint pos_stock_movements_actor_id_fkey,
  add foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.pos_audit
  drop constraint pos_audit_actor_id_fkey,
  add foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.pos_expenses
  alter column actor_id drop not null,
  drop constraint pos_expenses_check1,
  drop constraint pos_expenses_actor_id_fkey,
  drop constraint pos_expenses_voided_by_fkey,
  add foreign key (actor_id) references auth.users(id) on delete set null,
  add foreign key (voided_by) references auth.users(id) on delete set null,
  add constraint expense_void_details check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and void_reason is not null and char_length(btrim(void_reason)) between 3 and 200)
  );
alter table private.pos_walk_in_requests
  drop constraint pos_walk_in_requests_actor_id_fkey,
  add foreign key (actor_id) references auth.users(id) on delete cascade;

alter table private.counter_orders
  alter column customer_id drop not null,
  drop constraint counter_orders_customer_id_fkey,
  add foreign key (customer_id) references auth.users(id) on delete set null;

create function private.release_deleted_account_pickup() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.cancelled_at := statement_timestamp();
  return new;
end;
$$;

create trigger release_deleted_account_pickup before update of customer_id on private.counter_orders
  for each row when (old.customer_id is not null and new.customer_id is null and new.sale_id is null
    and new.cancelled_at is null and new.expires_at > statement_timestamp())
  execute function private.release_deleted_account_pickup();

create or replace function public.cancel_counter_order(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o private.counter_orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Pickup: Sign in to continue.'; end if;
  select * into o from private.counter_orders where id = p_order for update;
  if not found or (o.customer_id is distinct from auth.uid() and public.is_club_staff() is not true) then
    raise exception 'Pickup: Order not found.';
  end if;
  if o.cancelled_at is not null then return; end if;
  if o.sale_id is not null or o.expires_at <= clock_timestamp() then raise exception 'Pickup: This order is no longer awaiting pickup.'; end if;
  update private.counter_orders set cancelled_at = clock_timestamp() where id = p_order;
end;
$$;

-- Older closed shifts still appear in register history after an operator leaves.
do $$
declare
  definition text := pg_get_functiondef('public.pos_register_day(date)'::regprocedure);
  operator_label text := 'select case when manager then u.email else split_part(u.email, ''@'', 1) end as operator';
  operator_join text := 'from public.pos_shifts s join auth.users u on u.id = s.cashier_id';
begin
  if strpos(definition, operator_label) = 0 or strpos(definition, operator_join) = 0 then
    raise exception 'Expected register history query was not found.';
  end if;
  execute replace(replace(definition, operator_label,
    'select coalesce(case when manager then u.email else split_part(u.email, ''@'', 1) end, ''Deleted account'') as operator'),
    operator_join, 'from public.pos_shifts s left join auth.users u on u.id = s.cashier_id');
end;
$$;

create policy "Managers read account deletions" on public.pos_audit as restrictive
  for select to authenticated using (action <> 'access.account_deleted' or (select public.is_staff()));

create function public.delete_account(p_user_id uuid, p_confirmation text, p_expected_role text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.club_role();
  target_role text;
  self_deletion boolean := p_user_id = actor;
begin
  if actor is null or not exists (select 1 from auth.sessions s
    where s.id = (select (auth.jwt() ->> 'session_id')::uuid) and s.user_id = actor) then
    raise exception 'Access: Log in again before deleting an account.';
  end if;
  if p_user_id is null or p_confirmation is distinct from 'DELETE' then
    raise exception 'Access: Type DELETE to confirm account deletion.';
  end if;
  if not self_deletion and coalesce(actor_role, 'player') not in ('owner', 'manager') then
    raise exception 'Access: Manager or owner authorization is required.';
  end if;

  -- Use the same lock order as role changes. Keep foreign-key inserts compatible
  -- until the staff row is locked and any in-progress shift opening has finished.
  perform 1 from auth.users where id = p_user_id for no key update;
  if not found then raise exception 'Access: That account is no longer available.'; end if;
  lock table public.staff_members in share row exclusive mode;
  actor_role := coalesce(public.club_role(), 'player');
  select role into target_role from public.staff_members where user_id = p_user_id for update;
  target_role := coalesce(target_role, 'player');

  if not self_deletion then
    if actor_role not in ('owner', 'manager') then raise exception 'Access: Manager or owner authorization is required.'; end if;
    if actor_role = 'manager' and target_role in ('owner', 'manager') then
      raise exception 'Access: Only an owner can delete Manager or Owner accounts.';
    end if;
    if p_expected_role is distinct from target_role then
      raise exception 'Access: This account’s role changed. Refresh Access before deleting it.';
    end if;
  end if;
  if target_role = 'owner' and not exists (
    select 1 from public.staff_members where role = 'owner' and user_id <> p_user_id
  ) then raise exception 'Access: Assign another owner before deleting the last Owner account.'; end if;
  if target_role = 'manager' and not exists (
    select 1 from public.staff_members where role in ('owner', 'manager') and user_id <> p_user_id
  ) then raise exception 'Access: Assign another manager or owner before deleting this account.'; end if;
  if exists (select 1 from public.pos_shifts where cashier_id = p_user_id and closed_at is null) then
    raise exception 'Access: Close this account’s register shift before deleting it.';
  end if;

  -- Venue assets belong to the club. Detach uploader ownership without moving files.
  update storage.objects set owner = null, owner_id = null
    where bucket_id = 'venue-assets' and (owner = p_user_id or owner_id = p_user_id::text);

  delete from auth.users where id = p_user_id;
  insert into public.pos_audit(actor_id, action, entity_id, detail)
    values (case when self_deletion then null else actor end, 'access.account_deleted', p_user_id,
      jsonb_build_object('role', target_role, 'self_service', self_deletion));
end;
$$;

revoke all on function private.release_deleted_account_pickup(), public.delete_account(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.delete_account(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
