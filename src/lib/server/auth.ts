import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import { env } from "$env/dynamic/private"

import { getRequestEvent } from "$app/server";
import { sveltekitCookies } from "better-auth/svelte-kit";

export const auth = betterAuth({
  database: new Database("./sqlite.db"), 
  emailAndPassword: { 
    enabled: true, 
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