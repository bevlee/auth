<script lang="ts">
	import SignupForm from "$lib/components/signup-form.svelte";
	import SignedInPrompt from "$lib/components/signed-in-prompt.svelte";
	import PageShell from "$lib/components/page-shell.svelte";
	import { authClient } from "$lib/client";

	const session = authClient.useSession();
</script>

<PageShell>
	{#if $session.data}
		<SignedInPrompt name={$session.data.user.name || $session.data.user.email} />
	{:else}
		<SignupForm />
	{/if}
</PageShell>
