-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    price_monthly INT NOT NULL,
    price_total INT NOT NULL,
    render_limit INT,
    storage_limit_gb INT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    autopay_status TEXT DEFAULT 'active' CHECK (autopay_status IN ('active', 'cancelled_by_user', 'cancelled_by_bank')),
    renders_used INT DEFAULT 0,
    storage_used_bytes BIGINT DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    razorpay_payment_id TEXT,
    razorpay_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick user subscription lookup
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Seed Subscription Plans Data
-- Monthly Plans (prices in paise)
INSERT INTO subscription_plans (name, billing_cycle, price_monthly, price_total, render_limit, storage_limit_gb) VALUES
    ('Basic', 'monthly', 89900, 89900, 10, 10),
    ('Business', 'monthly', 149900, 149900, 20, 50),
    ('Enterprise', 'monthly', 549900, 549900, NULL, 100);

-- Yearly Plans (prices in paise)
INSERT INTO subscription_plans (name, billing_cycle, price_monthly, price_total, render_limit, storage_limit_gb) VALUES
    ('Basic', 'yearly', 69900, 838800, 120, 10),
    ('Business', 'yearly', 119900, 1438800, 240, 50),
    ('Enterprise', 'yearly', 449900, 5398800, NULL, 100);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view active plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions
    FOR ALL USING (true);
