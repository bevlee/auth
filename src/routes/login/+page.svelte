<script lang="ts">
	import LoginForm from "$lib/components/login-form.svelte";
	import SignedInPrompt from "$lib/components/signed-in-prompt.svelte";
	import PageShell from "$lib/components/page-shell.svelte";
	import { authClient } from "$lib/client";

	const session = authClient.useSession();
</script>

<PageShell>
	{#if $session.data}
		<SignedInPrompt name={$session.data.user.name || $session.data.user.email} />
	{:else}
		<LoginForm />
	{/if}
</PageShell>
