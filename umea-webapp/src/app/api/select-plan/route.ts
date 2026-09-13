import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, upsertUser } from "@/lib/storage";
import { PlanType } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, plan } = body as { email: string; name?: string; plan: PlanType };

    if (!email || !plan) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const existing = getUserByEmail(email);
    let trialEndsAt = existing?.trialEndsAt;
    if (plan === "ib_free_trial" && !trialEndsAt) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      trialEndsAt = d.toISOString();
    }

    const updated = upsertUser({
      ...(existing || {}),
      email,
      name: name || existing?.name || "User",
      plan,
      planStatus: "active",
      trialEndsAt,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update plan" }, { status: 500 });
  }
}
