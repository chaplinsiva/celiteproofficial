import Razorpay from 'razorpay';
import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';

/**
 * Get Razorpay instance with credentials from database
 */
export async function getRazorpayInstance(): Promise<Razorpay> {
    const { data, error } = await supabaseAdmin
        .from('razorpay_config')
        .select('*')
        .single();

    if (error || !data) {
        throw new Error('Razorpay configuration not found');
    }

    return new Razorpay({
        key_id: data.key_id,
        key_secret: data.key_secret,
    });
}

/**
 * Get Razorpay Key ID for frontend
 */
export async function getRazorpayKeyId(): Promise<string> {
    const { data, error } = await supabaseAdmin
        .from('razorpay_config')
        .select('key_id')
        .single();

    if (error || !data) {
        throw new Error('Razorpay configuration not found');
    }

    return data.key_id;
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
    secret: string
): boolean {
    const text = `${orderId}|${paymentId}`;
    const generated = crypto
        .createHmac('sha256', secret)
        .update(text)
        .digest('hex');

    return generated === signature;
}

/**
 * Get Razorpay secret for verification
 */
export async function getRazorpaySecret(): Promise<string> {
    const { data, error } = await supabaseAdmin
        .from('razorpay_config')
        .select('key_secret')
        .single();

    if (error || !data) {
        throw new Error('Razorpay configuration not found');
    }

    return data.key_secret;
}

/**
 * Get Razorpay webhook secret for webhook verification
 */
export async function getWebhookSecret(): Promise<string> {
    const { data, error } = await supabaseAdmin
        .from('razorpay_config')
        .select('webhook_secret')
        .single();

    if (error || !data || !data.webhook_secret) {
        throw new Error('Razorpay webhook secret not found');
    }

    return data.webhook_secret;
}
