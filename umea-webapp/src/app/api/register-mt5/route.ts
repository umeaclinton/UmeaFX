import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, upsertUser } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, login, password, server, riskMode, riskValue, maxLot } = body;

    if (!email || !login || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = getUserByEmail(email) || {
      email,
      name: name || "User",
    };

    const updated = upsertUser({
      ...user,
      mt5: {
        login: parseInt(login, 10),
        password,
        server: server || "Weltrade-Real",
        riskMode: riskMode || "multiplier",
        riskValue: parseFloat(riskValue) || 1.0,
        maxLot: parseFloat(maxLot) || 5.0,
        lastConnected: new Date().toISOString(),
        status: "connected",
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update MT5 info" }, { status: 500 });
  }
}
