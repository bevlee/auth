<script lang="ts">
	import type { Snippet } from "svelte";

	let { children }: { children: Snippet } = $props();
</script>

<!-- Centred card layout shared by every page (the header is 3.5rem tall) -->
<main class="flex min-h-[calc(100svh-3.5rem)] w-full items-center justify-center p-6">
	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</main>
