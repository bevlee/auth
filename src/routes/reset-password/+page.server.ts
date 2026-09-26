
import { auth } from "$lib/server/auth"
import { fail } from "@sveltejs/kit"

export const load = async ({ url }) => {
    return {
        token: url.searchParams.get("token"),
        error: url.searchParams.get("error")
    }
}

export const actions = {
    resetPassword: async ({ request, url }) => {
        const formData = await request.formData()

        const token = url.searchParams.get("token")
        if (!token) {
            return fail(400, {error: "missing password reset token"})
        }
        const password = formData.get('password') as string;

        await auth.api.resetPassword({
            body : {    
                newPassword: password,
                token: token
            }
        })

        return { success: true}
    }
}