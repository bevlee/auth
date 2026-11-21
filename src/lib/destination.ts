/**
 * Where to send the user once auth finishes.
 *
 * The destination arrives as `?callbackURL=` and is carried in every link and
 * email the auth flow produces. It is also kept in sessionStorage so it
 * survives same-tab navigation that drops the query (reloads, header links).
 */

import { dev } from "$app/environment";

export const DEFAULT_DESTINATION = "/account";

const STORAGE_KEY = "redirect_to";
const APP_DOMAIN = "bevsoft.com";
/** Apps on this machine (e.g. EK on 127.0.0.1), only trusted while developing. */
const LOCAL_ORIGINS = dev
	? [5173, 5174, 5175].flatMap((port) => [
			`http://localhost:${port}`,
			`http://127.0.0.1:${port}`,
		])
	: [];

/** Display names for apps that send users here; others show their hostname. */
const APP_NAMES: Record<string, string> = {
	"ek.bevsoft.com": "EK",
	"ek-dev.bevsoft.com": "EK",
};

/** Same-site paths, https bevsoft.com apps, and local dev apps. */
export function isSafeDestination(value: string): boolean {
	if (value.startsWith("/")) {
		return !value.startsWith("//") && !value.startsWith("/\\");
	}
	try {
		const url = new URL(value);
		if (LOCAL_ORIGINS.includes(url.origin)) return true;
		return (
			url.protocol === "https:" &&
			url.port === "" &&
			(url.hostname === APP_DOMAIN || url.hostname.endsWith(`.${APP_DOMAIN}`))
		);
	} catch {
		return false;
	}
}

/** Read the destination from the URL (remembering it), else storage, else Account. */
export function resolveDestination(url: URL): string {
	const requested = url.searchParams.get("callbackURL");
	if (requested !== null) {
		if (!isSafeDestination(requested)) return DEFAULT_DESTINATION;
		sessionStorage.setItem(STORAGE_KEY, requested);
		return requested;
	}
	const stored = sessionStorage.getItem(STORAGE_KEY);
	return stored && isSafeDestination(stored) ? stored : DEFAULT_DESTINATION;
}

/** Like resolveDestination, but read-only (for the header, which shows it on every page). */
export function peekDestination(url: URL): string {
	const requested = url.searchParams.get("callbackURL");
	if (requested !== null) return isSafeDestination(requested) ? requested : DEFAULT_DESTINATION;
	const stored = sessionStorage.getItem(STORAGE_KEY);
	return stored && isSafeDestination(stored) ? stored : DEFAULT_DESTINATION;
}

/** Call once the destination has been handed to Better Auth successfully. */
export function clearDestination(): void {
	sessionStorage.removeItem(STORAGE_KEY);
}

/** `path` with the destination (and any extra params) appended to its query. */
export function withDestination(
	path: string,
	destination: string,
	extra: Record<string, string> = {},
): string {
	const params = [
		`callbackURL=${encodeURIComponent(destination)}`,
		...Object.entries(extra).map(([k, v]) => `${k}=${encodeURIComponent(v)}`),
	];
	return `${path}${path.includes("?") ? "&" : "?"}${params.join("&")}`;
}

/** The app's name (or hostname) for "continue to …" copy, or null for this site. */
export function destinationLabel(destination: string): string | null {
	if (destination.startsWith("/")) return null;
	try {
		const { hostname } = new URL(destination);
		return APP_NAMES[hostname] ?? hostname;
	} catch {
		return null;
	}
}
