// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// The invite link's redirect target — must be a real https:// URL that opens
// in the recipient's browser (not the admin's local machine).
const SITE_URL = "https://cbmes-inventory-system.vercel.app/";

export default {
  // auth: 'user' — only signed-in CBMES portal users (with a valid session JWT)
  // may call this. ctx.userClaims/ctx.jwtClaims lets us confirm they're an Admin
  // before we let them invite anyone.
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Confirm the caller is an Admin. user_metadata.role is set at signup/invite
    // time in this app ('Admin' or 'Student') — check your own function logs
    // (console.log(ctx.jwtClaims)) if this path doesn't match your token shape.
    const callerRole = ctx.jwtClaims?.user_metadata?.role;
    if (callerRole !== "Admin") {
      return Response.json({ error: "Only Admins can invite users." }, { status: 403 });
    }

    const { email, first_name, last_name, student_num, role } = await req.json();
    if (!email || !first_name || !last_name || !student_num || !role) {
      return Response.json({ error: "email, first_name, last_name, student_num, and role are required." }, { status: 400 });
    }

    // ctx.supabaseAdmin bypasses RLS and has access to the Auth Admin API.
    // This creates the user in a pending/invited state and, because Brevo is
    // configured as the project's SMTP provider, Supabase sends the actual
    // invite email through Brevo automatically.
    const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: `${first_name} ${last_name}`,
        first_name,
        last_name,
        student_number: student_num,
        role,
      },
      redirectTo: SITE_URL,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ message: `Invitation sent to ${email}`, user_id: data.user?.id });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request (must include a valid user session JWT for auth: 'user'):

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/invite-user' \
    --header 'Authorization: Bearer <a real user access_token>' \
    --header 'Content-Type: application/json' \
    --data '{"email":"newperson@example.com","first_name":"New","last_name":"Person","student_num":"2023-00000-MN-0","role":"Student"}'

  To deploy for real:

  supabase functions deploy invite-user

*/
