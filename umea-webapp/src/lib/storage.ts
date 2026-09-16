import fs from "fs";
import path from "path";
import { UserAccount } from "./types";

const DB_FILE = path.join(process.cwd(), "data", "users.json");

function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2), "utf-8");
  }
}

export function getUsers(): UserAccount[] {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const data = JSON.parse(raw);
    return data.users || [];
  } catch {
    return [];
  }
}

export function saveUsers(users: UserAccount[]) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify({ users }, null, 2), "utf-8");
}

export function getUserByEmail(email: string): UserAccount | undefined {
  const users = getUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function upsertUser(user: Partial<UserAccount> & { email: string; name: string }): UserAccount {
  const users = getUsers();
  const index = users.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());

  if (index >= 0) {
    const updated = {
      ...users[index],
      ...user,
    };
    users[index] = updated;
    saveUsers(users);
    return updated;
  } else {
    // New User - default to 3-Day IB Free Trial
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 3);

    const newUser: UserAccount = {
      id: `USR-${Date.now().toString(36).toUpperCase()}`,
      email: user.email,
      name: user.name,
      image: user.image,
      plan: user.plan || "ib_free_trial",
      planStatus: user.planStatus || "active",
      trialEndsAt: user.trialEndsAt || trialEnd.toISOString(),
      createdAt: new Date().toISOString(),
      mt5: user.mt5,
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
  }
}
