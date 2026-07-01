-- Fix overly permissive RLS policy on user_subscriptions
-- The old policy "Service role can manage subscriptions" used USING (true)
-- which allowed ANY user (including anon key) to read/write/delete all subscriptions.
-- The service role already bypasses RLS entirely, so this policy only served to
-- open the table to all non-service-role users.
--
-- Fix: Drop the dangerous policy. The service role doesn't need a policy,
-- and regular users already have the SELECT policy scoped to their own user_id.

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON user_subscriptions;

-- Also ensure users can only insert/update their own subscriptions via the anon key
-- (in practice the API uses the service role, but this is defense-in-depth)
CREATE POLICY "Users can manage own subscriptions" ON user_subscriptions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
