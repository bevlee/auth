<script>
    import ResetPassword from "$lib/components/request-password-reset.svelte";

    let { form } = $props();
</script>


<ResetPassword {form} />