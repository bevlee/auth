import { redirect } from "@sveltejs/kit";
import { authClient } from "$lib/client";

// Signed-in visitors have nothing to do here; show their account instead.
export const load = async () => {
	const { data } = await authClient.getSession();
	if (data) redirect(307, "/account");
};
