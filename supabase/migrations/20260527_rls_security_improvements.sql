-- Migration: Database RLS Security Improvements and Profile Privacy Leak Fix
-- Enables RLS on razorpay_config, user_logs, and site_seo tables, and restricts email access on profiles.

-- 1. Secure razorpay_config
ALTER TABLE public.razorpay_config ENABLE ROW LEVEL SECURITY;
-- By enabling RLS on razorpay_config with no policies, standard anon/authenticated users cannot read or write to it.
-- Backend queries using the Service Role client (supabaseAdmin) bypass RLS and will continue to work perfectly.

-- 2. Secure user_logs
ALTER TABLE public.user_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own logs" ON public.user_logs;
CREATE POLICY "Users can view their own logs" ON public.user_logs
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all logs" ON public.user_logs;
CREATE POLICY "Admins can view all logs" ON public.user_logs
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()));

-- 3. Secure site_seo
ALTER TABLE public.site_seo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active site SEO" ON public.site_seo;
CREATE POLICY "Anyone can view active site SEO" ON public.site_seo
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage site SEO" ON public.site_seo;
CREATE POLICY "Admins can manage site SEO" ON public.site_seo
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()));

-- 4. Fix profile email privacy leak
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view their own profile." ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles." ON public.profiles;
CREATE POLICY "Admins can view all profiles." ON public.profiles
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()));
