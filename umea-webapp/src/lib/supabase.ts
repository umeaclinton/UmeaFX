import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zqixgbisbiltlgkdscwt.supabase.co";
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_azU7gaJdlaqVMviRbyONHw_zhnGnlKF";

// Server-side admin client (full DB access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Public client for frontend
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
