import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "";

function sortObject(obj: any): any {
  return Object.keys(obj)
    .sort()
    .reduce((result: any, key: string) => {
      result[key] =
        obj[key] && typeof obj[key] === "object" ? sortObject(obj[key]) : obj[key];
      return result;
    }, {});
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-nowpayments-sig");

    if (NOWPAYMENTS_IPN_SECRET && signature) {
      // NOWPayments verifies by sorting JSON keys alphabetically then creating HMAC SHA512
      try {
        const parsed = JSON.parse(rawBody);
        const sorted = sortObject(parsed);
        const sortedJson = JSON.stringify(sorted);

        const hmac = crypto.createHmac("sha512", NOWPAYMENTS_IPN_SECRET);
        hmac.update(sortedJson);
        const expectedSig = hmac.digest("hex");

        if (expectedSig !== signature) {
          console.warn("NOWPayments signature mismatch, verifying standard raw body fallback...");
          const hmacRaw = crypto.createHmac("sha512", NOWPAYMENTS_IPN_SECRET);
          hmacRaw.update(rawBody);
          if (hmacRaw.digest("hex") !== signature) {
            console.error("Invalid NOWPayments IPN signature");
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
          }
        }
      } catch (e) {
        console.error("Signature parse error:", e);
      }
    }

    const payload = JSON.parse(rawBody);
    const paymentStatus = payload.payment_status; // "finished", "confirmed", "partially_paid", etc.
    const orderDesc = payload.order_description || "";
    const orderId = payload.order_id || "";

    console.log(`📡 NOWPayments IPN Received: status=${paymentStatus}, orderId=${orderId}, desc=${orderDesc}`);

    // If payment is completed/confirmed
    if (paymentStatus === "finished" || paymentStatus === "confirmed") {
      // Extract email from order description (format: "UmeaFX Monthly Subscription - user@gmail.com")
      let email = "";
      if (orderDesc.includes(" - ")) {
        email = orderDesc.split(" - ").pop()?.trim().toLowerCase() || "";
      }

      if (email) {
        const userId = `USR-${Buffer.from(email).toString("hex").substring(0, 10).toUpperCase()}`;

        const { error } = await supabaseAdmin.from("users").upsert(
          {
            id: userId,
            email,
            plan: "monthly_sub",
            plan_status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );

        if (error) {
          console.error("Failed to update user in Supabase from crypto IPN:", error.message);
        } else {
          console.log(`✅ Crypto subscription activated for ${email} in Supabase!`);
        }
      }
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err: any) {
    console.error("Crypto IPN Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
