<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";

	let { appLabel }: { appLabel: string | null } = $props();
</script>

<!-- Shown while the browser navigates to the destination after sign-in/up -->
<Card.Root class="text-center">
	<Card.Header>
		<div
			class="mx-auto mb-2 size-6 animate-spin rounded-full border-2 border-muted border-t-primary"
			aria-hidden="true"
		></div>
		<Card.Title class="text-xl">You're signed in</Card.Title>
		<Card.Description>Taking you to {appLabel ?? "your account"}…</Card.Description>
	</Card.Header>
</Card.Root>
