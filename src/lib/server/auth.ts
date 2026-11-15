import { betterAuth } from "better-auth";
import { passwordOptions } from "./password";
import { trustedOrigins } from "./auth-cors";
import { getRequestEvent } from "$app/server";
import { Pool } from "pg";
import { env } from "$env/dynamic/private";
import { Resend } from "resend";
import { sveltekitCookies } from "better-auth/svelte-kit";

const resend = new Resend(env.RESEND_KEY);

type AuthEmailPurpose = "password_reset" | "email_verification";
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
    onPasswordReset: async ({ user}, request) => {
      console.info({ event: "auth_password_reset_completed", userId: user.id });
    }
  }, 
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendAuthEmail("email_verification", {
        from: env.AUTH_EMAIL,
        to: user.email,
        subject: 'Verify your email address',
        html: `Click <a href="${url}">here</a> to verify your email.`,
      });
    },
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
      trustedProviders: ["google"], // add other providers as we go. Technically i should reuqire email confirmation otherwise you can hijack someone elses email by making an account firsty
    },
  },
  trustedOrigins,
})
