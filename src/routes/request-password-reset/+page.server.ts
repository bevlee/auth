
import { auth } from "$lib/server/auth"
import { env } from "$env/dynamic/private"

export const actions = {
    requestResetPassword: async ({ request }) => {
        const formData = await request.formData()
        const email = formData.get('email') as string;

        const data = await auth.api.requestPasswordReset({
            body: {
                email: email,
                redirectTo: `/reset-password`
            }
        })

        return { success: true}
    }
}