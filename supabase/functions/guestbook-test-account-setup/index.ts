// Resets the password on a known test account so the quick-login buttons on the
// sign-in screen work. Called by app/auth/login.js.
//
// Recovered from the deployed function on the original project -- this source was
// never committed, so a freshly provisioned project had no way to reproduce it.
//
// SECURITY: SETUP_TOKEN below is also hardcoded in app/auth/login.js, which means
// it ships inside every published web/native bundle and is effectively public.
// Anyone holding it can reset these three test accounts to a known password. That
// is tolerable only because these are disposable test accounts. Do not extend this
// pattern to real users, and rotate both copies if the test accounts ever hold
// anything that matters.
import { createClient } from "npm:@supabase/supabase-js@2";

const SETUP_TOKEN = "P0h11qYVK3Ev_wuTUfQxfLjXxj6rtK4vZf4Evq99xaE";
const TEST_PASSWORD = "password123";

const TEST_USERS: Record<string, { id: string; email: string }> = {
  m: { id: "3ca554a2-5d43-4807-abd0-7cd23f8eb83d", email: "manager@test.com" },
  e: { id: "198295b9-47ae-4d5e-982a-b96249ac91ac", email: "explorer@test.com" },
  events: { id: "198295b9-47ae-4d5e-982a-b96249ac91ac", email: "explorer@test.com" },
  e2: { id: "9a79cf27-a315-4f14-b220-39db3a89dd73", email: "explorer2@test.com" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405, headers: corsHeaders,
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid request body" }), {
      status: 400, headers: corsHeaders,
    });
  }

  if (body?.token !== SETUP_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: corsHeaders,
    });
  }

  const alias = String(body?.alias || "").trim().toLowerCase();
  const testUser = TEST_USERS[alias];
  if (!testUser) {
    return new Response(JSON.stringify({ ok: false, error: "Unknown test account" }), {
      status: 400, headers: corsHeaders,
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, error: "Missing server configuration" }), {
      status: 500, headers: corsHeaders,
    });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.updateUserById(testUser.id, {
    password: TEST_PASSWORD,
  });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ ok: true, email: testUser.email }), {
    status: 200, headers: corsHeaders,
  });
});
