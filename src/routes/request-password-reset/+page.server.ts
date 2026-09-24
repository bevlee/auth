
import { auth } from "$lib/server/auth"
import { env } from "$env/dynamic/private"

export const actions = {
    resetPassword: async ({ request }) => {
        const formData = await request.formData()
        const email = formData.get('email') as string;

        const data = await auth.api.requestPasswordReset({
            body: {
                email: email,
                redirectTo: env.BETTER_AUTH_URL
            }
        })
    }
}