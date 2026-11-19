<script lang="ts">
	import LoginForm from "$lib/components/login-form.svelte";
	import SignedInPrompt from "$lib/components/signed-in-prompt.svelte";
	import { authClient } from "$lib/client";

	const session = authClient.useSession();
</script>

<div class="flex h-screen w-full items-center justify-center px-4">
	{#if $session.data}
		<SignedInPrompt name={$session.data.user.name} />
	{:else}
		<LoginForm />
	{/if}
</div>
