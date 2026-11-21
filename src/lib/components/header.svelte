<script lang="ts">
	import { authClient } from "$lib/client";
	import Button from "./ui/button/button.svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { toast } from "svelte-sonner";
	import { destinationLabel, peekDestination, withDestination } from "$lib/destination";

	const { session } = $props();

	const destination = $derived(peekDestination(page.url));
	const appLabel = $derived(destinationLabel(destination));
	const user = $derived($session.data?.user);

	const signOut = async () => {
		const { error } = await authClient.signOut();
		if (error) {
			toast.error("We couldn't sign you out. Please try again.");
			return;
		}
		await goto("/");
	};
</script>

<header class="flex h-14 items-center gap-3 border-b px-4">
	<a href="/" class="flex items-baseline gap-1.5">
		<span class="font-semibold">Bevsoft Account</span>
		{#if appLabel}
			<span class="text-sm text-muted-foreground">· for {appLabel}</span>
		{/if}
	</a>
	<div class="ml-auto flex items-center gap-2">
		{#if user}
			<span class="hidden text-sm text-muted-foreground sm:inline">{user.name || user.email}</span>
			<Button variant="ghost" href="/account">Account</Button>
			<Button variant="outline" onclick={signOut}>Sign out</Button>
		{:else if page.url.pathname === "/login"}
			<Button variant="ghost" href={withDestination("/signup", destination)}>Create account</Button>
		{:else}
			<Button variant="ghost" href={withDestination("/login", destination)}>Sign in</Button>
		{/if}
	</div>
</header>
