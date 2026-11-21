<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import PageShell from "$lib/components/page-shell.svelte";
	import { authClient } from "$lib/client";
	import { destinationApp, peekDestination } from "$lib/destination";
	import { page } from "$app/state";
	import { toast } from "svelte-sonner";

	let { data } = $props();

	// The session store updates after edits; fall back to what the load fetched
	const session = authClient.useSession();
	const user = $derived($session.data?.user ?? data.user);

	// "Back to EK" only when an app sent the user here
	const destination = peekDestination(page.url);
	const backTo = destination.startsWith("/") ? null : destination;
	const backLabel = destinationApp(destination)?.name;

	let editingName = $state(false);
	let name = $state("");
	let saving = $state(false);

	const startEditing = () => {
		name = user.name ?? "";
		editingName = true;
	};

	const saveName = async (e: SubmitEvent) => {
		e.preventDefault();
		if (saving) return;
		saving = true;
		const { error } = await authClient.updateUser({ name: name.trim() });
		saving = false;
		if (error) {
			toast.error(error.message ?? "We couldn't update your name. Please try again.");
			return;
		}
		editingName = false;
		toast.success("Name updated");
	};
</script>

<PageShell>
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Your account</Card.Title>
			<Card.Description>Used to sign in to all Bevsoft apps.</Card.Description>
		</Card.Header>
		<Card.Content>
			<dl class="divide-y text-sm">
				<div class="flex min-h-12 items-center justify-between gap-4 py-2">
					<dt class="text-muted-foreground">Name</dt>
					<dd class="flex items-center gap-2">
						{#if editingName}
							<form class="flex items-center gap-2" onsubmit={saveName}>
								<Input bind:value={name} aria-label="Name" class="h-8 w-36" required />
								<Button type="submit" size="sm" disabled={saving || !name.trim()}>Save</Button>
								<Button type="button" size="sm" variant="ghost" onclick={() => (editingName = false)}
									>Cancel</Button
								>
							</form>
						{:else if user.name}
							{user.name}
							<Button size="sm" variant="ghost" onclick={startEditing}>Edit</Button>
						{:else}
							<span class="text-muted-foreground">Not set</span>
							<Button size="sm" variant="outline" onclick={startEditing}>Add</Button>
						{/if}
					</dd>
				</div>
				<div class="flex min-h-12 items-center justify-between gap-4 py-2">
					<dt class="text-muted-foreground">Email</dt>
					<dd class="truncate">{user.email}</dd>
				</div>
				<div class="flex min-h-12 items-center justify-between gap-4 py-2">
					<dt class="text-muted-foreground">Google</dt>
					<dd>{data.hasGoogle ? "Linked" : "Not linked"}</dd>
				</div>
				{#if data.hasPassword}
					<div class="flex min-h-12 items-center justify-between gap-4 py-2">
						<dt class="text-muted-foreground">Password</dt>
						<dd><Button size="sm" variant="outline" href="/change-password">Change</Button></dd>
					</div>
				{/if}
			</dl>
			{#if backTo}
				<Button href={backTo} class="mt-4 w-full">Back to {backLabel}</Button>
			{/if}
		</Card.Content>
	</Card.Root>
</PageShell>
