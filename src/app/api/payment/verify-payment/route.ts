import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { verifyPaymentSignature, getRazorpaySecret, getRazorpayInstance } from "@/lib/razorpay";
import { processRenderJob } from "@/lib/render-processor";

export const dynamic = "force-dynamic";

/**
 * Verify Razorpay payment
 * POST /api/payment/verify-payment
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    try {
        const body = await request.json();
        const { orderId, paymentId, signature } = body;

        if (!orderId || !paymentId || !signature) {
            return NextResponse.json(
                { error: "orderId, paymentId, and signature are required" },
                { status: 400 }
            );
        }

        // Get Razorpay secret for verification
        const secret = await getRazorpaySecret();

        // Verify signature
        const isValid = verifyPaymentSignature(orderId, paymentId, signature, secret);

        if (!isValid) {
            // Update payment status to failed
            await supabaseAdmin
                .from("payments")
                .update({ status: "failed" })
                .eq("razorpay_order_id", orderId);

            return NextResponse.json(
                { error: "Invalid payment signature" },
                { status: 400 }
            );
        }

        // Update payment record with payment details
        const { data: payment, error: updateError } = await supabaseAdmin
            .from("payments")
            .update({
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
                status: "paid",
                updated_at: new Date().toISOString(),
            })
            .eq("razorpay_order_id", orderId)
            .select()
            .single();

        if (updateError || !payment) {
            console.error("Failed to update payment:", updateError);
            return NextResponse.json(
                { error: "Failed to update payment record" },
                { status: 500 }
            );
        }

        // --- Determine order type from Razorpay notes ---
        const razorpay = await getRazorpayInstance();
        const order = await razorpay.orders.fetch(orderId);

        // Ownership check: ensure this order belongs to the authenticated user
        if (order.notes?.userId !== userId) {
            return NextResponse.json(
                { error: "Forbidden: order does not belong to this user" },
                { status: 403 }
            );
        }

        const projectId = order.notes?.projectId as string;
        const isSinglePay = order.notes?.singlePay === "true";
        const isOneTimePurchase = order.notes?.oneTimePurchase === "true";
        const templateId = payment.template_id;

        // ── One-Time Purchase: create entitlement, NOT a render job ──────
        if (isOneTimePurchase) {
            // Idempotency: check if entitlement already exists for this order
            const { data: existingEntitlement } = await supabaseAdmin
                .from("user_template_entitlements")
                .select("id")
                .eq("razorpay_order_id", orderId)
                .maybeSingle();

            if (existingEntitlement) {
                console.log(`[verify-payment] Entitlement for order ${orderId} already exists (${existingEntitlement.id}). Returning existing.`);
                return NextResponse.json({
                    success: true,
                    paymentId: payment.id,
                    entitlementId: existingEntitlement.id,
                    isOneTimePurchase: true,
                    message: "One-time render already purchased",
                });
            }

            // Fetch template to get credit_cost
            const { data: template } = await supabaseAdmin
                .from("templates")
                .select("credit_cost, is_premium")
                .eq("id", templateId)
                .single();

            // Server-side premium guard (defense in depth)
            if (template?.is_premium) {
                console.error(`[verify-payment] Attempted one-time purchase for premium template ${templateId}. Blocked.`);
                return NextResponse.json(
                    { error: "This template is premium. One-time purchase is not available." },
                    { status: 403 }
                );
            }

            const creditCost = template?.credit_cost || parseInt(order.notes?.creditCost as string) || 20;

            // Create the entitlement row
            const { data: entitlement, error: entitlementError } = await supabaseAdmin
                .from("user_template_entitlements")
                .insert({
                    user_id: userId,
                    template_id: templateId,
                    credits_remaining: creditCost,
                    status: "active",
                    payment_id: payment.id,
                    razorpay_order_id: orderId,
                })
                .select()
                .single();

            if (entitlementError || !entitlement) {
                console.error("[verify-payment] Failed to create entitlement:", entitlementError);
                return NextResponse.json({
                    success: true,
                    paymentId: payment.id,
                    message: "Payment verified but failed to create entitlement. Please contact support.",
                });
            }

            console.log(`[verify-payment] ✅ Entitlement ${entitlement.id} created for user ${userId}, template ${templateId}, credits: ${creditCost}`);

            return NextResponse.json({
                success: true,
                paymentId: payment.id,
                entitlementId: entitlement.id,
                isOneTimePurchase: true,
                message: "One-time render purchased successfully. You can now render this template.",
            });
        }

        // ── Legacy singlePay / subscription flow: create render job ──────
        if (!projectId) {
            console.warn("No projectId found in order notes for order:", orderId);
        }

        // Fetch project data (images/texts) from database
        const { data: project } = await supabaseAdmin
            .from("projects")
            .select("configuration")
            .eq("id", projectId)
            .single();

        console.log(`Fetched project data for ${projectId}:`, project ? "Success" : "Not found");

        // Construct parameters for Plainly
        const parameters: Record<string, string> = {};
        if (project && project.configuration) {
            const config = project.configuration as any;
            if (config.images) {
                for (const [key, url] of Object.entries(config.images)) {
                    if (url && typeof url === 'string' && url.startsWith("http")) {
                        parameters[key] = url;
                    }
                }
            }
            if (config.texts) {
                for (const [key, val] of Object.entries(config.texts)) {
                    if (val && typeof val === 'string') {
                        parameters[key] = val;
                    }
                }
            }
        }

        console.log("Constructed Plainly parameters:", JSON.stringify(parameters));

        // Fetch template source configuration
        const { data: template } = await supabaseAdmin
            .from("templates")
            .select("*")
            .eq("id", templateId)
            .single();

        if (!template) {
            throw new Error("Template not found for rendering");
        }

        // Create render job record
        const renderInsert: Record<string, any> = {
            user_id: userId,
            template_id: templateId,
            status: "processing",
            started_at: new Date().toISOString(),
            parameters,
        };

        // Tag single-pay renders for 90-day retention
        if (isSinglePay) {
            renderInsert.is_single_pay = true;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 90);
            renderInsert.single_pay_expires_at = expiresAt.toISOString();
        }

        const { data: renderJob, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .insert(renderInsert)
            .select()
            .single();

        if (jobError || !renderJob) {
            console.error("Failed to create render job:", jobError);
            return NextResponse.json({
                success: true,
                paymentId: payment.id,
                message: "Payment verified but failed to start render. Please contact support.",
            });
        }

        // Link payment to render job
        await supabaseAdmin
            .from("payments")
            .update({ render_job_id: renderJob.id })
            .eq("id", payment.id);

        // Fire and forget the background processing
        processRenderJob(renderJob.id).catch((err: any) => {
            console.error("Background render processing error:", err);
        });

        return NextResponse.json({
            success: true,
            paymentId: payment.id,
            renderJobId: renderJob.id,
            message: "Payment verified and render started successfully",
        });

    } catch (error) {
        console.error("Verify payment error:", error);
        return NextResponse.json(
            { error: "Failed to verify payment" },
            { status: 500 }
        );
    }
}
