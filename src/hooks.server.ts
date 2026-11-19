import { auth } from "$lib/server/auth";
import { withAuthCors } from "$lib/server/auth-cors";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  return withAuthCors(event.request, async () => {
    const session = await auth.api.getSession({
      headers: event.request.headers,
    });

    if (session) {
      event.locals.session = session.session;
      event.locals.user = session.user;
    }
    return svelteKitHandler({ event, resolve, auth, building });
  });
};
