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
  socialProviders: { google: { 
            clientId: env.GOOGLE_CLIENT_ID as string, 
            clientSecret: env.GOOGLE_CLIENT_SECRET as string, 
        }, 
  }, 
	plugins: [sveltekitCookies(getRequestEvent)],
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: ".bevsoft.com"
    }
  }
})