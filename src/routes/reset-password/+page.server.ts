
import { auth } from "$lib/server/auth"
import { fail } from "@sveltejs/kit"
import { isAPIError } from 'better-auth/api';

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

        try {
            const response = await auth.api.resetPassword({
                body : {    
                    newPassword: password,
                    token: token
                }
            })
            return { success: true}
        } catch(error) {
            if (isAPIError(error)) {
                return fail(400, {error: error.message})
            }
        }

        return fail(500, {error: 'Something went wrong, please try a new password reset request'})
    }
}