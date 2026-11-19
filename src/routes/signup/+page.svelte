<script>
	import SignupForm from "$lib/components/signup-form.svelte";
	import SignedInPrompt from "$lib/components/signed-in-prompt.svelte";
	import { authClient } from "$lib/client";

	const session = authClient.useSession();
</script>

<div class="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
	<div class="w-full max-w-sm">
		{#if $session.data}
			<SignedInPrompt name={$session.data.user.name} />
		{:else}
			<SignupForm />
		{/if}
	</div>
</div>
