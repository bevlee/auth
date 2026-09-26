import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import { env } from "$env/dynamic/private"
import { Resend } from 'resend';

const resend = new Resend(env.RESEND_KEY);

import { getRequestEvent } from "$app/server";
import { sveltekitCookies } from "better-auth/svelte-kit";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: new Database("./sqlite.db"), 
  emailAndPassword: { 
    enabled: true,
    sendResetPassword: async ({user, url, token}) => {
      void resend.emails.send({
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
      console.log(`Password for user ${user.email} has been reset`)
    }
  }, 
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      void resend.emails.send({
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
})