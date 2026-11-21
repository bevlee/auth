<script lang="ts">
	import type { Snippet } from "svelte";

	let { tone = "error", children }: { tone?: "error" | "success"; children: Snippet } = $props();
</script>

<div
	role={tone === "error" ? "alert" : "status"}
	class={tone === "error"
		? "rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
		: "rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400"}
>
	{@render children()}
</div>
