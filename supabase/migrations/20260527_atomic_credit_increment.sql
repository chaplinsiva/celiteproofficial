-- Migration: Add atomic increment_renders_used RPC to prevent TOCTOU credit race condition
-- This function is called by render-processor.ts after confirmed render success.
-- Using a single UPDATE ensures concurrent renders don't double-deduct or under-deduct credits.

CREATE OR REPLACE FUNCTION increment_renders_used(
  p_subscription_id uuid,
  p_cost integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_subscriptions
  SET
    renders_used = renders_used + p_cost,
    updated_at = now()
  WHERE id = p_subscription_id;
END;
$$;

-- Also add credits_deducted flag to render_jobs if it doesn't exist
-- This flag lets stall recovery skip re-deducting credits if render-processor already did it
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS credits_deducted boolean DEFAULT false;
