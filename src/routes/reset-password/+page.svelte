<script>
    import ForgotPassword from "$lib/components/forgot-password.svelte"

    let { data, form } = $props();
</script>


<ForgotPassword {form} linkError={data.error} />