import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { encryptPassword } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, login, password, server, riskMode, riskValue, maxLot } = body;

    if (!email || !login || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user is on free trial and expired
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingUser && existingUser.plan === "ib_free_trial" && existingUser.trial_ends_at) {
      if (new Date(existingUser.trial_ends_at).getTime() <= Date.now()) {
        return NextResponse.json({
          error: "Your 3-Day Free Trial has expired. Please upgrade to Direct Membership ($49/mo) to link an account.",
        }, { status: 403 });
      }
    }

    const encryptedPwd = encryptPassword(password);
    const userId = `USR-${Buffer.from(email).toString("hex").substring(0, 10).toUpperCase()}`;

    // Upsert user into Supabase
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: userId,
          email: email.toLowerCase(),
          name: name || email.split("@")[0],
          mt5_login: parseInt(login, 10),
          mt5_password_encrypted: encryptedPwd,
          mt5_server: server || "Weltrade-Real",
          risk_mode: riskMode || "multiplier",
          risk_value: parseFloat(riskValue) || 1.0,
          max_lot: parseFloat(maxLot) || 5.0,
          status: "connected",
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
    return NextResponse.json({ error: err.message || "Failed to update MT5 info" }, { status: 500 });
  }
}
