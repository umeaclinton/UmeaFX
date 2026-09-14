import { NextRequest, NextResponse } from "next/server";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, plan = "monthly_sub", amount = 49.0 } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!NOWPAYMENTS_API_KEY) {
      return NextResponse.json({ error: "NOWPayments API key is missing" }, { status: 500 });
    }

    const origin = req.headers.get("origin") || "https://umeafx.vercel.app";
    const userId = `USR-${Buffer.from(email).toString("hex").substring(0, 10).toUpperCase()}`;

    // Create Invoice with NOWPayments API
    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: Number(amount),
        price_currency: "usd",
        order_id: `${userId}-${Date.now()}`,
        order_description: `UmeaFX Monthly Subscription - ${email}`,
        ipn_callback_url: `${origin}/api/crypto/webhook`,
        success_url: `${origin}/dashboard?payment=success`,
        cancel_url: `${origin}/dashboard`,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.invoice_url) {
      return NextResponse.json({ error: data.message || "Failed to create crypto invoice" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      invoiceUrl: data.invoice_url,
      invoiceId: data.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
