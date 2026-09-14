import { NextRequest, NextResponse } from "next/server";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, plan, currency = "NGN", amount = 75000 } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Paystack secret key is not configured" }, { status: 500 });
    }

    // Amount in Paystack is in lowest currency unit (kobo/cents): ₦75,000 * 100 = 7,500,000 kobo
    const amountInSubunit = Math.round(Number(amount) * 100);

    const origin = req.headers.get("origin") || "https://umeafx.vercel.app";
    const callbackUrl = `${origin}/dashboard?payment=success`;

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        amount: amountInSubunit,
        currency,
        callback_url: callbackUrl,
        metadata: {
          name: name || email.split("@")[0],
          plan: plan || "monthly_sub",
          source: "umeafx_portal",
        },
      }),
    });

    const data = await paystackRes.json();

    if (!paystackRes.ok || !data.status) {
      return NextResponse.json({ error: data.message || "Paystack initialization failed" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
