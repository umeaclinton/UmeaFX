import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PlanType } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, plan } = body as { email: string; name?: string; plan: PlanType };

    if (!email || !plan) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const userId = `USR-${Buffer.from(email).toString("hex").substring(0, 10).toUpperCase()}`;
    let trialEndsAt: string | null = null;

    if (plan === "ib_free_trial") {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      trialEndsAt = d.toISOString();
    }

    // Upsert user plan into Supabase
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: userId,
          email: email.toLowerCase(),
          name: name || email.split("@")[0],
          plan,
          plan_status: "active",
          trial_ends_at: trialEndsAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update plan" }, { status: 500 });
  }
}
