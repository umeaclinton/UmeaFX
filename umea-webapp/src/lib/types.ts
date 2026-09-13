export type PlanType = "ib_free_trial" | "monthly_sub" | "lifetime";

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  image?: string;
  plan: PlanType;
  planStatus: "active" | "expired" | "pending";
  trialEndsAt?: string;
  mt5?: {
    login: number;
    password: string;
    server: string;
    riskMode: "multiplier" | "fixed" | "risk_percent";
    riskValue: number;
    maxLot: number;
    lastConnected?: string;
    status: "connected" | "disconnected" | "error";
  };
  createdAt: string;
}

export interface SyncClientPayload {
  clientId: string;
  name: string;
  email: string;
  login: number;
  password: string;
  server: string;
  riskMode: string;
  riskValue: number;
  maxLot: number;
  isActive: boolean;
  plan: PlanType;
}
