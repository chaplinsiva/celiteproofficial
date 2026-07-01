import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Strip leading/trailing whitespaces from environment variables
const SMTP_HOST = (process.env.SMTP_HOST || "smtp.hostinger.com").trim();
const SMTP_PORT = parseInt((process.env.SMTP_PORT || "587").trim(), 10);
const SMTP_SECURE = (process.env.SMTP_SECURE || "false").trim() === "true";
const SMTP_USER = (process.env.SMTP_USER || "celiteprocontact@celite.in").trim();
const SMTP_PASSWORD = (process.env.SMTP_PASSWORD || "3p^mr;EoQ|").trim();
const EMAIL_FROM = (process.env.EMAIL_FROM || "celiteprocontact@celite.in").trim();
const EMAIL_FROM_NAME = (process.env.EMAIL_FROM_NAME || "CelitePro").trim();
const NEXT_PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://celitepro.in").trim();
const NEXT_PUBLIC_S3_URL = (process.env.NEXT_PUBLIC_S3_URL || "https://files.celitepro.in").trim();

// Create nodemailer transport reusing connections
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
    },
});

/**
 * Sends a notification email when a render job completes.
 * Uses atomic concurrency lock on render_jobs table to guarantee that exactly one email is sent.
 */
export async function sendRenderCompletionEmail(jobId: string) {
    console.log(`[Mailer] Attempting to send render completion email for job ${jobId}...`);
    try {
        // 1. Concurrency guard: update email_sent only if it is false (atomic lock)
        const { data: updatedJob, error: updateError } = await supabaseAdmin
            .from("render_jobs")
            .update({ email_sent: true })
            .eq("id", jobId)
            .eq("email_sent", false)
            .select("id")
            .maybeSingle();

        if (updateError) {
            console.error(`[Mailer] Error trying to acquire email lock for job ${jobId}:`, updateError);
            return;
        }

        if (!updatedJob) {
            console.log(`[Mailer] Lock not acquired for job ${jobId}. Email already sent or job not found. Skipping.`);
            return;
        }

        console.log(`[Mailer] Email lock acquired for job ${jobId}. Fetching details...`);

        // 2. Fetch full render job details and user email
        const { data: job, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .select("*, templates(*)")
            .eq("id", jobId)
            .single();

        if (jobError || !job) {
            console.error(`[Mailer] Failed to retrieve details for job ${jobId}:`, jobError);
            return;
        }

        // Skip email notifications for sample/preview renders
        if (job.is_sample === true) {
            console.log(`[Mailer] Skipping email notification for sample/preview render. Job ID: ${jobId}`);
            return;
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("id", job.user_id)
            .single();

        if (profileError || !profile || !profile.email) {
            console.error(`[Mailer] Failed to find profile or email for user ${job.user_id}:`, profileError);
            return;
        }

        const template = job.templates;
        const templateTitle = template?.title || "Your Custom Video";
        const thumbnailUrl = job.thumbnail_urls?.[0] || template?.thumbnail_url || "";

        // Check if user has an active subscription to render a premium resubscribe call-to-action
        const nowStr = new Date().toISOString();
        const { data: sub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id")
            .eq("user_id", job.user_id)
            .eq("status", "active")
            .gte("valid_until", nowStr)
            .limit(1)
            .maybeSingle();

        const hasActiveSub = !!sub;

        const viewLink = `${NEXT_PUBLIC_SITE_URL}/render/${jobId}`;
        const subject = `Your HD video render is ready! - CelitePro`;

        // 3. Construct email body HTML with solid inline styles for client compatibility
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0B;">
    <!-- Main wrapper to force background color in email clients -->
    <div style="background-color: #0A0A0B; color: #E4E4E7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; min-height: 100%;">
        
        <div style="text-align: center; margin-bottom: 40px;">
            <img src="${NEXT_PUBLIC_S3_URL}/logos/02.png" alt="CelitePro Logo" style="width: 48px; height: 48px; vertical-align: middle;">
            <span style="display: inline-block; font-size: 24px; font-weight: 800; color: #FFFFFF; margin-left: 10px; vertical-align: middle; letter-spacing: -0.5px;">CelitePro</span>
        </div>
        
        <div style="background-color: #121214; border: 1px solid #1C1C1F; border-radius: 16px; padding: 32px; text-align: center; max-width: 560px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
            <h1 style="font-size: 28px; font-weight: 800; color: #FFFFFF; margin-top: 0; margin-bottom: 16px;">Your Video is Ready!</h1>
            <p style="font-size: 15px; line-height: 1.6; color: #A1A1AA; margin-bottom: 24px;">
                Great news! Your video render has completed successfully. You can view and download it directly from your dashboard.
            </p>
            
            <div style="display: inline-block; background-color: #1C1C1F; border: 1px solid #27272A; border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: 600; color: #E4E4E7; margin-bottom: 24px;">
                Template: ${templateTitle} <span style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-left: 6px; vertical-align: middle;">HD</span>
            </div>
            
            ${thumbnailUrl ? `
            <div style="width: 100%; max-width: 480px; margin: 0 auto 32px; border-radius: 12px; overflow: hidden; border: 1px solid #1C1C1F; background-color: #000000;">
                <img src="${thumbnailUrl}" alt="${templateTitle}" style="width: 100%; height: auto; display: block;">
            </div>
            ` : ""}
            
            <div style="margin-bottom: 24px;">
                <a href="${viewLink}" style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); background-color: #4F46E5; color: #FFFFFF !important; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);">Download Now</a>
            </div>
            
            <p style="font-size: 13px; color: #71717A; margin-top: 10px; margin-bottom: 0;">
                Click the button above to open the video page on CelitePro and download it.
            </p>

            ${!hasActiveSub ? `
            <div style="margin-top: 32px; padding: 20px; background-color: rgba(79, 70, 229, 0.03); border: 1px dashed rgba(79, 70, 229, 0.15); border-radius: 12px; text-align: center;">
                <p style="font-size: 14px; font-weight: bold; color: #FFFFFF; margin: 0 0 8px 0;">✨ Unlock Unlimited Background Removals & More!</p>
                <p style="font-size: 12px; color: #A1A1AA; margin: 0 0 16px 0;">Get unlimited daily background removals, keep projects indefinitely, and access priority HD render engines.</p>
                <a href="${NEXT_PUBLIC_SITE_URL}/pricing" style="display: inline-block; background-color: #4F46E5; color: #FFFFFF !important; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 12px;">Subscribe to CelitePro Premium</a>
            </div>
            ` : ""}
        </div>
        
        <div style="text-align: center; margin-top: 40px; font-size: 12px; color: #52525B; line-height: 1.5;">
            <p style="margin: 0 0 8px 0;">
                Sent by <a href="${NEXT_PUBLIC_SITE_URL}" style="color: #71717A; text-decoration: none;">CelitePro</a> · Professional Video Automation
            </p>
            <p style="margin: 0;">
                This is an automated notification. If you did not request this video, please ignore this email.
            </p>
        </div>
    </div>
</body>
</html>
        `;

        // 4. Deliver email without video attachments
        const info = await transporter.sendMail({
            from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
            to: profile.email,
            subject: subject,
            html: html
        });

        console.log(`[Mailer] Email sent successfully to ${profile.email}. Message ID: ${info.messageId}`);
    } catch (err) {
        console.error(`[Mailer] Error running sendRenderCompletionEmail for job ${jobId}:`, err);
    }
}

/**
 * Sends a welcome email when a user starts a new subscription.
 */
export async function sendSubscriptionWelcomeEmail(
    to: string,
    planName: string,
    validUntil: string,
    renderLimit: number | null,
    storageLimitGb: number
) {
    console.log(`[Mailer] Sending subscription welcome email to ${to} for plan ${planName}...`);
    try {
        const formattedDate = new Date(validUntil).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
        });

        const subject = `Welcome to CelitePro Premium! 🎉`;
        const dashboardLink = `${NEXT_PUBLIC_SITE_URL}/dashboard`;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0B;">
    <div style="background-color: #0A0A0B; color: #E4E4E7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; min-height: 100%;">
        
        <div style="text-align: center; margin-bottom: 40px;">
            <img src="${NEXT_PUBLIC_S3_URL}/logos/02.png" alt="CelitePro Logo" style="width: 48px; height: 48px; vertical-align: middle;">
            <span style="display: inline-block; font-size: 24px; font-weight: 800; color: #FFFFFF; margin-left: 10px; vertical-align: middle; letter-spacing: -0.5px;">CelitePro</span>
        </div>
        
        <div style="background-color: #121214; border: 1px solid #1C1C1F; border-radius: 16px; padding: 32px; text-align: center; max-width: 560px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
            <div style="display: inline-block; background-color: rgba(79, 70, 229, 0.1); border: 1px solid rgba(79, 70, 229, 0.2); border-radius: 50%; padding: 16px; margin-bottom: 24px;">
                <span style="font-size: 32px; line-height: 1;">👑</span>
            </div>
            
            <h1 style="font-size: 28px; font-weight: 800; color: #FFFFFF; margin-top: 0; margin-bottom: 16px;">Subscription Activated!</h1>
            <p style="font-size: 15px; line-height: 1.6; color: #A1A1AA; margin-bottom: 24px;">
                Thank you for upgrading! Your subscription is active, and your account has been upgraded to the Premium plan.
            </p>
            
            <div style="background-color: #1C1C1F; border: 1px solid #27272A; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 28px;">
                <h3 style="font-size: 16px; font-weight: 700; color: #FFFFFF; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #27272A; padding-bottom: 8px;">Plan Benefits:</h3>
                <div style="font-size: 14px; color: #E4E4E7; margin-bottom: 8px;">
                    <strong style="color: #A1A1AA;">Active Plan:</strong> ${planName} Plan
                </div>
                <div style="font-size: 14px; color: #E4E4E7; margin-bottom: 8px;">
                    <strong style="color: #A1A1AA;">Render Credits:</strong> ${renderLimit ? `${renderLimit} renders` : "Unlimited"}
                </div>
                <div style="font-size: 14px; color: #E4E4E7; margin-bottom: 8px;">
                    <strong style="color: #A1A1AA;">Cloud Storage:</strong> ${storageLimitGb} GB
                </div>
                <div style="font-size: 14px; color: #E4E4E7;">
                    <strong style="color: #A1A1AA;">Valid Until:</strong> ${formattedDate}
                </div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <a href="${dashboardLink}" style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); background-color: #4F46E5; color: #FFFFFF !important; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);">Go to Dashboard</a>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px; font-size: 12px; color: #52525B; line-height: 1.5;">
            <p style="margin: 0 0 8px 0;">
                Sent by <a href="${NEXT_PUBLIC_SITE_URL}" style="color: #71717A; text-decoration: none;">CelitePro</a> · Professional Video Automation
            </p>
        </div>
    </div>
</body>
</html>
        `;

        await transporter.sendMail({
            from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
            to,
            subject,
            html,
        });

        console.log(`[Mailer] Welcome email sent successfully to ${to}`);
    } catch (err) {
        console.error(`[Mailer] Error running sendSubscriptionWelcomeEmail:`, err);
    }
}

/**
 * Sends a file retention warning email to free or expired tier users.
 */
export async function sendRetentionWarningEmail(to: string, daysRemaining: number) {
    console.log(`[Mailer] Sending file retention warning email to ${to} (${daysRemaining} days remaining)...`);
    try {
        const subject = `Action Required: Your CelitePro files will be deleted in ${daysRemaining} days ⚠️`;
        const pricingLink = `${NEXT_PUBLIC_SITE_URL}/pricing`;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0B;">
    <div style="background-color: #0A0A0B; color: #E4E4E7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; min-height: 100%;">
        
        <div style="text-align: center; margin-bottom: 40px;">
            <img src="${NEXT_PUBLIC_S3_URL}/logos/02.png" alt="CelitePro Logo" style="width: 48px; height: 48px; vertical-align: middle;">
            <span style="display: inline-block; font-size: 24px; font-weight: 800; color: #FFFFFF; margin-left: 10px; vertical-align: middle; letter-spacing: -0.5px;">CelitePro</span>
        </div>
        
        <div style="background-color: #121214; border: 1px solid #1C1C1F; border-radius: 16px; padding: 32px; text-align: center; max-width: 560px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
            <div style="display: inline-block; background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 50%; padding: 16px; margin-bottom: 24px;">
                <span style="font-size: 32px; line-height: 1;">⚠️</span>
            </div>
            
            <h1 style="font-size: 28px; font-weight: 800; color: #FFFFFF; margin-top: 0; margin-bottom: 16px;">Files Expiring Soon!</h1>
            <p style="font-size: 15px; line-height: 1.6; color: #A1A1AA; margin-bottom: 24px;">
                Your generated videos, project configurations, and media uploads are scheduled for deletion in <strong style="color: #F59E0B;">${daysRemaining} days</strong> under the Free Plan retention policy.
            </p>
            
            <div style="background-color: #1C1C1F; border: 1px solid #27272A; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 28px;">
                <h3 style="font-size: 15px; font-weight: 700; color: #FFFFFF; margin-top: 0; margin-bottom: 8px;">Free Plan Storage Policy:</h3>
                <p style="font-size: 13px; line-height: 1.5; color: #A1A1AA; margin: 0;">
                    To keep our platform fast and free for everyone, free previews and assets are unconditionally deleted 7 days after creation. Upgrade to a Premium plan to secure your files permanently.
                </p>
            </div>
            
            <div style="margin-bottom: 12px;">
                <a href="${pricingLink}" style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); background-color: #4F46E5; color: #FFFFFF !important; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);">Upgrade to Premium</a>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px; font-size: 12px; color: #52525B; line-height: 1.5;">
            <p style="margin: 0 0 8px 0;">
                Sent by <a href="${NEXT_PUBLIC_SITE_URL}" style="color: #71717A; text-decoration: none;">CelitePro</a> · Professional Video Automation
            </p>
        </div>
    </div>
</body>
</html>
        `;

        await transporter.sendMail({
            from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
            to,
            subject,
            html,
        });

        console.log(`[Mailer] Retention warning email sent successfully to ${to}`);
    } catch (err) {
        console.error(`[Mailer] Error running sendRetentionWarningEmail:`, err);
    }
}
