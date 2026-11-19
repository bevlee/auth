import { requireSession } from "$lib/require-session";

export const load = ({ url }) => requireSession(url);
