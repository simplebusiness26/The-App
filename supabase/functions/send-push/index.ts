import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Drains public.push_queue and sends what is in it through Expo.
//
// WHY A FUNCTION AND NOT A TRIGGER
//
// This project has no pg_net, no pg_cron and no http extension, so Postgres
// cannot call out on its own. The trigger in 20260814030000 decides WHETHER a
// notification should become a push -- category on, master switch on, a device
// registered -- and writes a row. This sends it.
//
// WHAT STILL HAS TO BE DECIDED
//
// What invokes this. A Supabase scheduled function, a GitHub Actions cron, or
// enabling pg_net so the trigger can call it directly. Enabling an extension is
// a decision about the project's infrastructure and was not one to make quietly
// inside a migration. Until then this runs when it is called and does the right
// thing when it does.
//
// SERVICE ROLE, DELIBERATELY. push_queue has no policy for anon or
// authenticated at all -- a queue of everybody's notifications is not something
// a phone should be able to ask for. Reading it needs the key that bypasses RLS.

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// Expo's own limit. More than this in one request is rejected outright.
const BATCH = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Not configured" }, 500);

  const supabase = createClient(url, key);

  const { data: queued, error } = await supabase
    .from("push_queue")
    .select("id,user_id,title,body,deep_link")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) return json({ error: error.message }, 500);
  if (!queued?.length) return json({ sent: 0, failed: 0 });

  // Every device belonging to every recipient in this batch, in one read.
  const recipients = [...new Set(queued.map((row) => row.user_id))];
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("user_id,token")
    .in("user_id", recipients);

  const devicesFor = new Map<string, string[]>();
  for (const row of tokens ?? []) {
    devicesFor.set(row.user_id, [...(devicesFor.get(row.user_id) ?? []), row.token]);
  }

  const messages: Array<Record<string, unknown>> = [];
  const carried: string[] = [];
  const withNoDevice: string[] = [];

  for (const row of queued) {
    const devices = devicesFor.get(row.user_id) ?? [];

    // Registered when it was queued, gone by the time it was sent. Marked
    // rather than left in the queue for ever.
    if (!devices.length) { withNoDevice.push(row.id); continue; }

    for (const token of devices) {
      messages.push({
        to: token,
        title: row.title,
        body: row.body,
        // What to open. The app reads this and routes to it.
        data: row.deep_link ? { deep_link: row.deep_link } : {},
      });
    }
    carried.push(row.id);
  }

  let failed = "";
  if (messages.length) {
    try {
      const answer = await fetch(EXPO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate" },
        body: JSON.stringify(messages),
      });
      if (!answer.ok) failed = `Expo returned ${answer.status}`;
    } catch (problem) {
      failed = problem instanceof Error ? problem.message : "Expo could not be reached";
    }
  }

  const stamp = new Date().toISOString();

  // Marked either way. A row that cannot be sent and is not marked is a row
  // this function retries for ever, which is a loop rather than a queue.
  if (carried.length) {
    await supabase
      .from("push_queue")
      .update(failed ? { sent_at: stamp, failed_reason: failed } : { sent_at: stamp })
      .in("id", carried);
  }
  if (withNoDevice.length) {
    await supabase
      .from("push_queue")
      .update({ sent_at: stamp, failed_reason: "No device registered when it was sent" })
      .in("id", withNoDevice);
  }

  return json({
    sent: failed ? 0 : carried.length,
    failed: failed ? carried.length : 0,
    skipped: withNoDevice.length,
    reason: failed,
  });
});
