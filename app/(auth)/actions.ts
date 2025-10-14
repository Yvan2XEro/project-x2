"use server";

import { z } from "zod";

import { createUser, getUser } from "@/lib/db/queries";

import { User } from "@/lib/db/schema";
import { signIn } from "./auth";

const registerFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  linkedin: z.string().optional(),
  company_name: z.string().min(2),
  role: z.string().min(2),
  interests: z.array(z.string()).min(3),
});

const loginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = loginFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(JSON.stringify({ status: "invalid_data" }));
    }

    throw new Error(JSON.stringify({ status: "failed" }));
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  let user: User[] | null = null;
  try {
    const validatedData = registerFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      linkedin: formData.get("linkedin") || undefined,
      company_name: formData.get("company_name"),
      role: formData.get("role"),
      interests: formData.getAll("interests") as string[],
    });

    user = await getUser(validatedData.email);
    console.log({user})

    if (user && user.length > 0) {
      throw new Error(JSON.stringify({ status: "user_exists" }));
    }
    await createUser({
      email: validatedData.email,
      password: validatedData.password,
      company_name: validatedData.company_name,
      first_name: validatedData.first_name,
      last_name: validatedData.last_name,
      interests: validatedData.interests,
      role: validatedData.role,
      linkedin: validatedData.linkedin,
    });
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(JSON.stringify({ status: "invalid_data" }));
    }
    if (user && user.length > 0) {
      throw new Error(JSON.stringify({ status: "user_exists" }));
    }

    throw new Error(JSON.stringify({ status: "failed" }));
  }
};
