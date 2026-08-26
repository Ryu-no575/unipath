-- Adds INSERT/DELETE policies for watch_subscriptions so a signed-in user
-- can manage their own watch list directly (mute/unmute today is covered by
-- the existing UPDATE policy from 20260826210000_verified_live_data_system.sql;
-- rows are otherwise created/pruned by the applications triggers), matching
-- the product requirement that a user can INSERT/UPDATE/DELETE only their
-- own watch_subscriptions rows. Purely additive: no existing policy or row
-- is touched.

alter table public.watch_subscriptions enable row level security;

drop policy if exists "watch_subscriptions_insert_own" on public.watch_subscriptions;
create policy "watch_subscriptions_insert_own" on public.watch_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "watch_subscriptions_delete_own" on public.watch_subscriptions;
create policy "watch_subscriptions_delete_own" on public.watch_subscriptions
  for delete using (auth.uid() = user_id);
