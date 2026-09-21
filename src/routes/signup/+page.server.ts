import { auth } from "$lib/server/auth"
import { fail } from "@sveltejs/kit"
import type { Actions } from "./$types"


export const actions = {
    signup: async ({cookies, request}) => {
        const formData = await request.formData()
        const name = formData.get('name') as string | null
        const email = formData.get('email') as string | null
        const password = formData.get('password') as string | null
        const confirmPassword = formData.get('confirm-password') as string | null

        if (!name) {
            return fail(400, { name, missing: true})
        }
        if (!email) {
            return fail(400, { email, missing: true})
        }
        if (!password) {
            return fail(400, { password, missing: true})
        }
        if (confirmPassword && password !== confirmPassword) {
            
            return fail(400, { password,  passwordMismatch: true}) 
        }
        try {
            const data = await auth.api.signUpEmail({
                body: { name, email, password },
                headers: request.headers,
            })
            console.log(data)
        } catch (error) {
            console.log("errors somewhere", error)
            return fail(400, { email, name, error: true })
        }
    }
} satisfies Actions