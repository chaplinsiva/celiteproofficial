-- Add email_sent column to render_jobs to prevent duplicate emails from race conditions
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;
