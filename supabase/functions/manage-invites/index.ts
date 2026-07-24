// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// IMPORTANT: this must match your project's actual "Email OTP Expiration"
// setting (Supabase Dashboard → Authentication → Sign In / Providers →
// User Signups... or Emails, depending on dashboard version). Supabase's
// own default is 3600 seconds (1 hour). If you've changed that setting,
// update this constant to match — it's only used to *display* an estimated
// countdown here, it does not control the actual expiry itself (Supabase
// enforces that server-side regardless of what this function displays).
const INVITE_EXPIRY_SECONDS = 3600;

export default {
  // auth: 'user' — only signed-in CBMES portal users (with a valid session
  // JWT) may call this. We additionally check for the Admin role below,
  // since listing/deleting accounts is sensitive regardless of login status.
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const callerRole = ctx.jwtClaims?.user_metadata?.role;
    if (callerRole !== "Admin") {
      return Response.json({ error: "Only Admins can manage invitations." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "list") {
      // ctx.supabaseAdmin bypasses RLS and has access to the Auth Admin API —
      // required to list all users, which the browser's publishable key
      // cannot do under any circumstances.
      const { data, error } = await ctx.supabaseAdmin.auth.admin.listUsers();
      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      const now = Date.now();
      const invites = (data.users || [])
        .filter((u) => !!u.invited_at) // only users created via an invite
        .map((u) => {
          const invitedAtMs = new Date(u.invited_at).getTime();
          const expiresAtMs = invitedAtMs + INVITE_EXPIRY_SECONDS * 1000;
          const secondsRemaining = Math.round((expiresAtMs - now) / 1000);
          // Heuristic: if they've ever actually signed in (not just been
          // auto-authenticated by clicking the link), treat the invite as
          // accepted rather than still-pending.
          const accepted = !!u.last_sign_in_at;

          return {
            id: u.id,
            name: u.user_metadata?.full_name || "—",
            email: u.email,
            role: u.user_metadata?.role || "—",
            invited_at: u.invited_at,
            expires_at: new Date(expiresAtMs).toISOString(),
            seconds_remaining: secondsRemaining,
            accepted,
          };
        })
        .sort((a, b) => new Date(b.invited_at).getTime() - new Date(a.invited_at).getTime());

      return Response.json({ invites });
    }

    if (action === "cancel") {
      const userId = body.user_id;
      if (!userId) {
        return Response.json({ error: "user_id is required to cancel an invite." }, { status: 400 });
      }
      const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({ message: "Invite cancelled." });
    }

    return Response.json({ error: "Unknown action. Use 'list' or 'cancel'." }, { status: 400 });
  }),
};