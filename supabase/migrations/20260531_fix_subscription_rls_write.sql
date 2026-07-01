-- Fix: Restrict user_subscriptions RLS to SELECT only.
--
-- Two dangerous policies existed:
-- 1. "Service role can manage subscriptions" — FOR ALL USING (true)
--    This granted ALL operations (INSERT, UPDATE, DELETE) to EVERY role,
--    not just the service role. The service role already bypasses RLS entirely.
-- 2. "Users can manage own subscriptions" — FOR ALL USING (auth.uid() = user_id)
--    This allowed any authenticated user to UPDATE/DELETE their own subscription
--    row via the public anon key — enabling credit resets, expiry extension, etc.
--
-- Fix: Drop both. Only the existing SELECT policy remains.
-- All subscription mutations are handled by server-side Service Role calls.

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON user_subscriptions;

-- Ensure the SELECT-only policy exists (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_subscriptions'
        AND policyname = 'Users can view own subscriptions'
    ) THEN
        EXECUTE 'CREATE POLICY "Users can view own subscriptions" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id)';
    END IF;
END $$;
