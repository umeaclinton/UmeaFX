import { NextRequest, NextResponse } from "next/server";
import { getUsers } from "@/lib/storage";
import { SyncClientPayload } from "@/lib/types";

// Master Copier Secret Key (used by local engine to authenticate)
const API_SECRET = process.env.COPIER_API_SECRET || "umea-fx60-secret-bridge-key";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader ? authHeader.replace("Bearer ", "") : req.nextUrl.searchParams.get("key");

  if (token !== API_SECRET) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const users = getUsers();
  const now = new Date();

  // Filter clients who have valid MT5 credentials and active subscriptions/trials
  const activeClients: SyncClientPayload[] = [];

  for (const u of users) {
    if (!u.mt5 || !u.mt5.login || !u.mt5.password) {
      continue;
    }

    let isActive = false;

    if (u.plan === "monthly_sub" || u.plan === "lifetime") {
      isActive = u.planStatus === "active";
    } else if (u.plan === "ib_free_trial") {
      if (u.trialEndsAt) {
        const trialEnd = new Date(u.trialEndsAt);
        isActive = trialEnd > now && u.planStatus === "active";
      }
    }

    if (isActive) {
      activeClients.push({
        clientId: u.id,
        name: u.name,
        email: u.email,
        login: u.mt5.login,
        password: u.mt5.password,
        server: u.mt5.server || "Weltrade-Real",
        riskMode: u.mt5.riskMode || "multiplier",
        riskValue: u.mt5.riskValue || 1.0,
        maxLot: u.mt5.maxLot || 5.0,
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
