<script lang="ts">
    import { authClient } from "$lib/client";
    import Button from "./ui/button/button.svelte";
    import { goto } from "$app/navigation";
    const { session } = $props();

    const signOut = async () => {
        await authClient.signOut();
        await goto("/");
    };
</script>

<header class="flex items-center gap-4 border-b px-4 py-2">
    <Button variant="ghost" href="/">Bevsoft Auth</Button>
    <div class="ml-auto flex items-center gap-4">
        {#if $session.data}
            <span>
                {$session.data.user.name}
            </span>
            <Button href="/account">Account</Button>
            <Button onclick={signOut}>Sign Out</Button>
        {:else}
            <Button href="/login">Login</Button>
            <Button href="/signup">Register</Button>
        {/if}
    </div>
</header>
