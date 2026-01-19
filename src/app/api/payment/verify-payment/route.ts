import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPaymentSignature, getRazorpaySecret, getRazorpayInstance } from "@/lib/razorpay";
import { processRenderJob } from "@/lib/render-processor";

export const dynamic = "force-dynamic";

/**
 * Verify Razorpay payment
 * POST /api/payment/verify-payment
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

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

        // --- Server-side Render Job Creation ---
        // 1. Get Razorpay order to retrieve projectId from notes
        const razorpay = await getRazorpayInstance();
        const order = await razorpay.orders.fetch(orderId);
        const projectId = order.notes?.projectId as string;
        const templateId = payment.template_id;
        const userId = payment.user_id;

        if (!projectId) {
            // If no projectId, we might have to fallback or error
            // But with our changes, it should be there
            console.warn("No projectId found in order notes for order:", orderId);
        }

        // 2. Fetch project data (images/texts) from database - using the correct 'configuration' column
        const { data: project } = await supabaseAdmin
            .from("projects")
            .select("configuration")
            .eq("id", projectId)
            .single();

        console.log(`Fetched project data for ${projectId}:`, project ? "Success" : "Not found");

        // 3. Construct parameters for Plainly
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

        // 4. Fetch template source configuration
        const { data: template } = await supabaseAdmin
            .from("templates")
            .select("*")
            .eq("id", templateId)
            .single();

        if (!template) {
            throw new Error("Template not found for rendering");
        }

        // 5. Create render job record
        const { data: renderJob, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .insert({
                user_id: userId,
                template_id: templateId,
                status: "processing",
                started_at: new Date().toISOString(),
                parameters,
            })
            .select()
            .single();

        if (jobError || !renderJob) {
            console.error("Failed to create render job:", jobError);
            // Even if render job fails, payment was successful
            return NextResponse.json({
                success: true,
                paymentId: payment.id,
                message: "Payment verified but failed to start render. Please contact support.",
            });
        }

        // 6. Link payment to render job
        await supabaseAdmin
            .from("payments")
            .update({ render_job_id: renderJob.id })
            .eq("id", payment.id);

        // 7. Fire and forget the background processing
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
            { error: "Failed to verify payment", details: String(error) },
            { status: 500 }
        );
    }
}
