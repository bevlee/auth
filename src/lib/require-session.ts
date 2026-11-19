import { redirect } from "@sveltejs/kit";
import { authClient } from "$lib/client";
import { withDestination } from "$lib/destination";

/** For `+page.ts` loads: send signed-out visitors to sign-in, returning here after. */
export async function requireSession(url: URL) {
	const { data } = await authClient.getSession();
	if (!data) redirect(307, withDestination("/login", url.pathname + url.search));
	return { user: data.user };
}
