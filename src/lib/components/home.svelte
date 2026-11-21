<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
</script>

<Card.Root class="text-center">
	<Card.Header>
		<Card.Title class="text-2xl">Your Bevsoft account</Card.Title>
		<Card.Description>One account for EK and every other Bevsoft app.</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-2">
		<Button href="/signup" class="w-full">Create account</Button>
		<Button href="/login" variant="outline" class="w-full">Sign in</Button>
	</Card.Content>
</Card.Root>
