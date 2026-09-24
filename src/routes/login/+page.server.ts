import { auth } from "$lib/server/auth"
import { fail, type Actions } from "@sveltejs/kit"

export const actions = {
    login: async ({request}) => {
        const formData = await request.formData()
        const email = formData.get("email") as string | null
        const password = formData.get("password") as string | null
        if (!email) {
            return fail(400, {email, error: "no email supplied"})
        }
        if (!password) {
            return fail(400, {password, error: "no password supplied"})
        }
        try {
            await auth.api.signInEmail({
                body: { email, password },
                headers: request.headers,
            })
        } catch (error) {
            console.log("errors somewhere", error)
            return fail(400, { email, error: true })
        }
    }
} satisfies Actions