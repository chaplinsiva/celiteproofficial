-- =====================================================
-- Migration: One-Time Render Purchase System
-- Date: 2026-06-27
-- Description:
--   1. Add one_time_price and is_premium columns to templates
--   2. Create user_template_entitlements table
--   3. Create atomic decrement_entitlement_credits RPC
--   4. RLS policies
-- =====================================================

-- 1. Add columns to templates (backfills all existing rows)
ALTER TABLE templates 
  ADD COLUMN IF NOT EXISTS one_time_price INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;

-- 2. Create entitlements table
CREATE TABLE IF NOT EXISTS user_template_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    credits_remaining INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'exhausted', 'refunded')),
    payment_id UUID,
    razorpay_order_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ute_user_template 
    ON user_template_entitlements(user_id, template_id);
CREATE INDEX IF NOT EXISTS idx_ute_status 
    ON user_template_entitlements(status);
CREATE INDEX IF NOT EXISTS idx_ute_razorpay_order 
    ON user_template_entitlements(razorpay_order_id);

-- 4. RLS
ALTER TABLE user_template_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entitlements" 
    ON user_template_entitlements FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage entitlements" 
    ON user_template_entitlements FOR ALL 
    USING (true);

-- 5. Atomic credit decrement RPC
CREATE OR REPLACE FUNCTION decrement_entitlement_credits(
    p_entitlement_id UUID,
    p_cost INTEGER
) RETURNS void AS $$
BEGIN
    UPDATE user_template_entitlements
    SET credits_remaining = credits_remaining - p_cost,
        status = CASE 
            WHEN credits_remaining - p_cost <= 0 THEN 'exhausted'
            ELSE 'active'
        END,
        updated_at = NOW()
    WHERE id = p_entitlement_id
      AND status = 'active'
      AND credits_remaining >= p_cost;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient entitlement credits or entitlement not active';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Add entitlement_id to render_jobs (links a job to its one-time purchase)
ALTER TABLE render_jobs 
  ADD COLUMN IF NOT EXISTS entitlement_id UUID REFERENCES user_template_entitlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_render_jobs_entitlement_id 
    ON render_jobs(entitlement_id) WHERE entitlement_id IS NOT NULL;
