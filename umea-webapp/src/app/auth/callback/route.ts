import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    // Exchange auth code for session
    const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const email = data.user.email?.toLowerCase();
      const name = data.user.user_metadata?.full_name || data.user.user_metadata?.name || email?.split("@")[0] || "Trader";

      if (email) {
        // Ensure user exists in users table with 7-day trial by default
        const userId = `USR-${Buffer.from(email).toString("hex").substring(0, 10).toUpperCase()}`;
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);

        await supabaseAdmin.from("users").upsert(
          {
            id: userId,
            email,
            name,
            plan: "ib_free_trial",
            plan_status: "active",
            trial_ends_at: trialEnd.toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email", ignoreDuplicates: true }
        );
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
