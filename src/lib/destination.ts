/**
 * Where to send the user once auth finishes.
 *
 * The destination arrives as `?callbackURL=` and is carried in every link and
 * email the auth flow produces. It is also kept in sessionStorage so it
 * survives same-tab navigation that drops the query (reloads, header links).
 */

export const DEFAULT_DESTINATION = "/account";

const STORAGE_KEY = "redirect_to";
const APP_DOMAIN = "bevsoft.com";
const LOCAL_ORIGINS = [
	"http://localhost:5173",
	"http://localhost:5174",
	"http://localhost:5175",
];

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

/**
 * Where a verification link lands. Better Auth sends both success and
 * `?error=` to this URL, so it points at our /verify-email page, which
 * explains failures and forwards successes to the real destination.
 */
export function verificationCallback(destination: string): string {
	return withDestination("/verify-email", destination);
}

/** Display names for an app destination, or null for this site's account pages. */
export function destinationApp(destination: string): { name: string; label: string } | null {
	if (destination.startsWith("/")) return null;
	try {
		const hostname = new URL(destination).hostname;
		const names: Record<string, string> = {
			"ek.bevsoft.com": "Elemental Kingdoms",
			"tax.bevsoft.com": "Tax Time",
		};
		const name = names[hostname] ?? hostname;
		return { name, label: name === hostname ? hostname : `${name} (${hostname})` };
	} catch {
		return null;
	}
}
