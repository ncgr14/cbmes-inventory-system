// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// This endpoint uses 'publishable' | 'secret' access, apiKey is required.
// Use publishable for Client-facing, key-validated endpoints
// Use secret for Server-to-server, internal calls
export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const { email, name, role } = await req.json();

      if (!email) {
        return Response.json({ error: "Missing required field: email" }, { status: 400 });
      }

      // ctx.supabaseAdmin bypasses RLS — required for auth.admin operations
      const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name, role },
      });

      if (error) {
        console.error("inviteUserByEmail failed:", error);
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({ success: true, data });
    } catch (error) {
      console.error("invite-user function error:", error);
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/invite-user' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"email":"someone@example.com","name":"Someone","role":"staff"}'

*/
