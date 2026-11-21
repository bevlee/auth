import { authClient } from "$lib/client";
import { requireSession } from "$lib/require-session";

export const load = async ({ url }) => {
	const session = await requireSession(url);
	const { data: accounts } = await authClient.listAccounts();
	return {
		...session,
		hasPassword: accounts?.some((a) => a.providerId === "credential") ?? false,
		hasGoogle: accounts?.some((a) => a.providerId === "google") ?? false,
	};
};
