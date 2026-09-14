import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Paystack secret key is missing" }, { status: 500 });
    }

    // 1. Verify Paystack HMAC SHA512 signature
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Parse Event
    const event = JSON.parse(rawBody);

    if (event.event === "charge.success") {
      const data = event.data;
      const email = data.customer?.email?.toLowerCase();
      const plan = data.metadata?.plan || "monthly_sub";
      const name = data.metadata?.name || email?.split("@")[0] || "Trader";

      if (email) {
        const userId = `USR-${Buffer.from(email).toString("hex").substring(0, 10).toUpperCase()}`;

        // Upsert user status as active monthly subscriber in Supabase
        const { error } = await supabaseAdmin.from("users").upsert(
          {
            id: userId,
            email,
            name,
            plan,
            plan_status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );

        if (error) {
          console.error("Failed to update user status in Supabase:", error.message);
        } else {
          console.log(`✅ Paystack payment confirmed for ${email}. Plan activated: ${plan}`);
        }
      }
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (err: any) {
    console.error("Paystack webhook error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
