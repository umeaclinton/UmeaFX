import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email query parameter" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const now = new Date();

    // 1. Fetch user from users table
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. If user not in users table, attempt recovery from profiles or create fresh 3-day trial
    if (!user) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      const userId = profile?.id || `USR-${Buffer.from(cleanEmail).toString("hex").substring(0, 10).toUpperCase()}`;
      const name = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : cleanEmail.split("@")[0];
      const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from("users")
        .upsert({
          id: userId,
          email: cleanEmail,
          name: name || cleanEmail.split("@")[0],
          plan: profile?.plan || "ib_free_trial",
          plan_status: "active",
          trial_ends_at: trialEndsAt,
          updated_at: now.toISOString(),
        }, { onConflict: "email" })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        user: {
          email: newUser.email,
          name: newUser.name,
          plan: newUser.plan,
          plan_status: newUser.plan_status,
          trial_ends_at: newUser.trial_ends_at,
          isTrialExpired: false,
          mt5_login: newUser.mt5_login,
          mt5_server: newUser.mt5_server,
          risk_mode: newUser.risk_mode,
          risk_value: newUser.risk_value,
          max_lot: newUser.max_lot,
          status: newUser.status,
        },
      });
    }

    // 3. User exists: evaluate 3-day trial status
    let isTrialExpired = false;
    let effectiveTrialEnd = user.trial_ends_at;

    if (user.plan === "ib_free_trial") {
      if (!effectiveTrialEnd) {
        // Fallback: 3 days from created_at or now
        const baseDate = user.created_at ? new Date(user.created_at) : now;
        effectiveTrialEnd = new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from("users")
          .update({ trial_ends_at: effectiveTrialEnd, updated_at: now.toISOString() })
          .eq("id", user.id);
      }

      const trialEndDate = new Date(effectiveTrialEnd);
      if (trialEndDate.getTime() <= now.getTime()) {
        isTrialExpired = true;

        // Auto-disconnect MT5 account if trial expired
        if (user.mt5_login !== null || user.status === "connected" || user.plan_status !== "expired") {
          await supabaseAdmin
            .from("users")
            .update({
              status: "disconnected",
              mt5_login: null,
              mt5_password_encrypted: null,
              plan_status: "expired",
              updated_at: now.toISOString(),
            })
            .eq("id", user.id);

          user.status = "disconnected";
          user.mt5_login = null;
          user.plan_status = "expired";
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        plan: user.plan,
        plan_status: user.plan_status,
        trial_ends_at: effectiveTrialEnd,
        isTrialExpired,
        mt5_login: isTrialExpired ? null : user.mt5_login,
        mt5_server: user.mt5_server,
        risk_mode: user.risk_mode,
        risk_value: user.risk_value,
        max_lot: user.max_lot,
        status: isTrialExpired ? "disconnected" : user.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch user status" }, { status: 500 });
  }
}
