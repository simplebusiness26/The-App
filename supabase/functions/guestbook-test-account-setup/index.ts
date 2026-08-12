// Retired. This function used to reset three test accounts to a known
// password, guarded by a token that was hardcoded in app/auth/login.js and
// therefore shipped inside every published web and Android bundle. Anyone who
// looked at a build could call it.
//
// The quick-login buttons are gone from the app and this endpoint now refuses
// every request. It is left deployed as a tombstone rather than deleted so an
// old build calling it gets a clear answer instead of a confusing 404, and so
// this note is visible to whoever finds the function in the dashboard.
//
// The three accounts still exist and still hold the password that shipped.
// Rotate or retire them.
//
// Delete this function entirely once no old build is in anyone's hands.

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  return new Response(
    JSON.stringify({
      ok: false,
      error: "This endpoint has been retired. Test account setup no longer exists.",
    }),
    { status: 410, headers },
  );
});
