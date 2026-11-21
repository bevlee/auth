<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { authClient } from "$lib/client";
	import { withDestination } from "$lib/destination";

	let {
		destination,
		errorMessage = $bindable(""),
	}: { destination: string; errorMessage?: string } = $props();

	const continueWithGoogle = async () => {
		errorMessage = "";
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: destination,
			// Cancelled or refused sign-ins come back to /login with ?error=
			errorCallbackURL: withDestination("/login", destination),
		});
		if (error) errorMessage = "We couldn't start Google sign-in. Please try again.";
	};
</script>

<!-- type="button" so it never submits the surrounding email form -->
<Button variant="outline" type="button" class="w-full" onclick={continueWithGoogle}>
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
		<path
			d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
			fill="currentColor"
		/>
	</svg>
	Continue with Google
</Button>
