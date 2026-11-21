import { betterAuth } from "better-auth";
import { passwordOptions } from "./password";
import { trustedOrigins } from "./auth-cors";
import { getRequestEvent } from "$app/server";
import { Pool } from "pg";
import { env } from "$env/dynamic/private";
import { Resend } from "resend";
import { sveltekitCookies } from "better-auth/svelte-kit";

const resend = new Resend(env.RESEND_KEY);

type AuthEmailPurpose = "password_reset";
type AuthEmailOptions = Parameters<typeof resend.emails.send>[0];

function sendAuthEmail(purpose: AuthEmailPurpose, email: AuthEmailOptions): void {
  void Promise.resolve()
    .then(() => resend.emails.send(email))
    .then(({ error }) => {
      if (error) {
        console.error({
          event: "auth_email_send_failed",
          purpose,
          failure: "provider_error",
        });
      }
    })
    .catch(() => {
      console.error({
        event: "auth_email_send_failed",
        purpose,
        failure: "request_rejected",
      });
    });
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: new Pool({
    host: env.PGHOST,
    port: Number(env.PGPORT ?? 5432),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
  }),
  emailAndPassword: { 
    enabled: true,
    password: passwordOptions,
    sendResetPassword: async ({user, url, token}) => {
      sendAuthEmail("password_reset", {
        from: env.AUTH_EMAIL,
        to: user.email,
        subject: "Reset your password",
        html: ` <p>
            Click the link to reset your password:
            <a href="${url}">${url}</a>
          </p>`
      });
    },
    onPasswordReset: async ({ user }) => {
      console.info({ event: "auth_password_reset_completed", userId: user.id });
      // There is no email verification step. Finishing a reset proves the user
      // owns the inbox, so mark the email verified; that lets them later link
      // Google to this account (see requireLocalEmailVerified below).
      if (!user.emailVerified) {
        const ctx = await auth.$context;
        await ctx.internalAdapter.updateUser(user.id, { emailVerified: true });
      }
    }
  }, 
  socialProviders: { google: { 
            clientId: env.GOOGLE_CLIENT_ID as string, 
            clientSecret: env.GOOGLE_CLIENT_SECRET as string, 
        }, 
  }, 
	plugins: [sveltekitCookies(getRequestEvent)],
  advanced: {
    crossSubDomainCookies: { // Make sure to add Cookie domain for prod and leave it undefined in .env in dev
      enabled: !!env.COOKIE_DOMAIN,
      domain: env.COOKIE_DOMAIN
    }
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"], // add other providers as we go
      // Better Auth's default, stated explicitly: never link a provider to an
      // account whose email is unverified, so nobody can pre-register someone
      // else's email and inherit their Google sign-in. Password accounts become
      // verified by completing a password reset (onPasswordReset above).
      requireLocalEmailVerified: true,
    },
  },
  trustedOrigins,
})
