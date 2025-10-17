"use server"

import { auth } from "@/app/(auth)/auth"
import { getUser } from "@/lib/db/queries"

export async function getUserProfile() {
    const session = await auth()
    const user = session?.user
    if (!user || !user.email) {
        return null
    }

    const profile = await getUser(user.email)
    return profile
}