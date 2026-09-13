import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptPassword } from "@/lib/encryption";
import { SyncClientPayload } from "@/lib/types";

// Master Copier Secret Key (used by local engine to authenticate)
const API_SECRET = process.env.COPIER_API_SECRET || "umea-fx60-secret-bridge-key";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader ? authHeader.replace("Bearer ", "") : req.nextUrl.searchParams.get("key");

  if (token !== API_SECRET) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  // Fetch all users with registered MT5 accounts from Supabase
  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .not("mt5_login", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const activeClients: SyncClientPayload[] = [];

  for (const u of (users || [])) {
    if (!u.mt5_login || !u.mt5_password_encrypted) {
      continue;
    }

    let isActive = false;

    if (u.plan === "monthly_sub" || u.plan === "lifetime") {
      isActive = u.plan_status === "active";
    } else if (u.plan === "ib_free_trial") {
      if (u.trial_ends_at) {
        const trialEnd = new Date(u.trial_ends_at);
        isActive = trialEnd > now && u.plan_status === "active";
      } else {
        isActive = true;
      }
    }

    if (isActive) {
      const decryptedPwd = decryptPassword(u.mt5_password_encrypted);

      activeClients.push({
        clientId: u.id,
        name: u.name,
        email: u.email,
        login: Number(u.mt5_login),
        password: decryptedPwd,
        server: u.mt5_server || "Weltrade-Real",
        riskMode: u.risk_mode || "multiplier",
        riskValue: Number(u.risk_value) || 1.0,
        maxLot: Number(u.max_lot) || 5.0,
        isActive: true,
        plan: u.plan,
      });
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    totalActive: activeClients.length,
    clients: activeClients,
  });
}
