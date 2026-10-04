<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { authClient } from "$lib/client";
    import type { ComponentProps } from "svelte";
    import { toast } from "svelte-sonner";

    let { ...restProps }: ComponentProps<typeof Card.Root> = $props();

    let currentPassword: string = $state("");
    let newPassword: string = $state("");
    let confirmPassword: string = $state("");

    let validCurrentPassword = $derived(newPassword.length >= 8);
    let validNewPassword = $derived(newPassword.length >= 8);
    let passwordsMatch = $derived(
        newPassword.length >= 8 &&
            confirmPassword.length >= 8 &&
            newPassword === confirmPassword,
    );
    let hasError = $derived(
        !passwordsMatch || !validNewPassword || !validCurrentPassword,
    );

    import { page } from "$app/state";
    let callbackURL = page.url.searchParams.get("callbackURL");

    if (!callbackURL) {
        if (sessionStorage.getItem("redirect_to")) {
            callbackURL = sessionStorage.getItem("redirect_to");
        }
    } else {
        sessionStorage.setItem("redirect_to", callbackURL);
    }
    const changePassword = async (e: SubmitEvent) => {
        e.preventDefault();

        const { data, error } = await authClient.changePassword({
            currentPassword: currentPassword,
            newPassword: newPassword,
            revokeOtherSessions: false,
        });
        if (data) {
            toast("password changed successfully!");
            currentPassword = "";
            newPassword = "";
            confirmPassword = "";
        }

        if (error) {
            toast(error?.message ?? "an error occurred, please try again");
        }
    };
</script>

<Card.Root {...restProps}>
    <Card.Header>
        <Card.Title>Change Password</Card.Title>
        <Card.Description
            >Enter your current and new desired password</Card.Description
        >
    </Card.Header>
    <Card.Content>
        <form onsubmit={changePassword}>
            <Field.Group>
                <Field.Field>
                    <Field.Label for="password">Current Password</Field.Label>
                    <Input
                        id="password"
                        bind:value={currentPassword}
                        name="password"
                        type="password"
                        required
                        aria-invalid={confirmPassword.length > 0 &&
                            currentPassword.length === 0}
                    />
                    <Field.Description
                        class={validCurrentPassword
                            ? "text-green-600 dark:text-green-500"
                            : undefined}
                    ></Field.Description>
                </Field.Field>
                <Field.Field>
                    <Field.Label for="password">New Password</Field.Label>
                    <Input
                        id="password"
                        bind:value={newPassword}
                        name="password"
                        type="password"
                        required
                        aria-invalid={(confirmPassword.length > 0 &&
                            newPassword.length === 0) ||
                            (confirmPassword.length > 0 &&
                                newPassword.length > 0 &&
                                !passwordsMatch)}
                    />
                    <Field.Description
                        class={validNewPassword
                            ? "text-green-600 dark:text-green-500"
                            : undefined}
                    >
                        Must be at least 8 characters long. {validNewPassword
                            ? "correct"
                            : ""}
                    </Field.Description>
                </Field.Field>
                <Field.Field>
                    <Field.Label for="confirm-password"
                        >Confirm New Password</Field.Label
                    >
                    <Input
                        id="confirm-password"
                        bind:value={confirmPassword}
                        name="confirm-password"
                        type="password"
                        required
                        aria-invalid={(confirmPassword.length > 0 &&
                            newPassword.length === 0) ||
                            (confirmPassword.length > 0 &&
                                newPassword.length > 0 &&
                                !passwordsMatch)}
                    />
                    <Field.Description
                        class={passwordsMatch
                            ? "text-green-600 dark:text-green-500"
                            : undefined}
                    >
                        Please confirm your password. {passwordsMatch
                            ? "correct"
                            : ""}
                    </Field.Description>
                </Field.Field>
                <Field.Group>
                    <Field.Field>
                        <Button type="submit" disabled={hasError}
                            >Change Password</Button
                        >
                    </Field.Field>
                </Field.Group>
            </Field.Group>
        </form>
    </Card.Content>
</Card.Root>
