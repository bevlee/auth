import { redirect } from "@sveltejs/kit";
import { authClient } from "$lib/client";
import { requireSession } from "$lib/require-session";

export const load = async ({ url }) => {
	const session = await requireSession(url);
	// Google-only accounts have no password to change
	const { data: accounts } = await authClient.listAccounts();
	if (accounts && !accounts.some((a) => a.providerId === "credential")) redirect(307, "/account");
	return session;
};
