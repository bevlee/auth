<script lang="ts">
	import "./layout.css";
	import favicon from "$lib/assets/favicon.svg";
	import Header from "$lib/components/header.svelte";
	import { Toaster } from "$lib/components/ui/sonner";
	import { authClient } from "$lib/client";

	let { children } = $props();

	const session = authClient.useSession();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<Header {session} />
{@render children()}
<Toaster />
