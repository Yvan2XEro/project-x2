"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import Form from "next/form";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: "idle",
    }
  );

  const { update: updateSession } = useSession();

  // useEffect(() => {
  //   if (state.status === "failed") {
  //     toast({
  //       type: "error",
  //       description: "Invalid credentials!",
  //     });
  //   } else if (state.status === "invalid_data") {
  //     toast({
  //       type: "error",
  //       description: "Failed validating your submission!",
  //     });
  //   } else if (state.status === "success") {
  //     setIsSuccessful(true);
  //     updateSession();
  //     router.refresh();
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [state.status, router.refresh, updateSession]);

  const mutation = useMutation({
    mutationFn: (formData: FormData) => login(state, formData),
    onSuccess: (state) => {
      if (state.status === "success") {
        toast({
          type: "success",
          description: "Account created successfully!",
        });

        setIsSuccessful(true);
        updateSession();
        router.refresh();
      }
    },
    onError: (error) => {
      let status: string | null = null;
      const err = typeof error === "string" ? error : error.message;
      if (err) {
        try {
          const parsed = JSON.parse(err);
          status = parsed.status;
        } catch {
          console.error("Failed to parse error message");
        }
      }

      if (status === "failed") {
        toast({ type: "error", description: "Invalid credentials!" });
      } else if (status === "invalid_data") {
        toast({
          type: "error",
          description: "Failed validating your submission!",
        });
      } else {
        toast({
          type: "error",
          description: "An unexpected error occurred!",
        });
      }
    },
  });

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    mutation.mutate(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            Use your email and password to sign in
          </p>
        </div>
        <Form
          action={handleSubmit}
          className="flex flex-col gap-4 px-4 sm:px-16"
        >
          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="email"
            >
              Email Address
            </Label>

            <Input
              autoComplete="email"
              autoFocus
              className="bg-muted text-md md:text-sm"
              defaultValue={email}
              id="email"
              name="email"
              placeholder="user@acme.com"
              required
              type="email"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="password"
            >
              Password
            </Label>

            <Input
              className="bg-muted text-md md:text-sm"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>

          <SubmitButton isSuccessful={isSuccessful}>Sign in</SubmitButton>
          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            {"Don't have an account? "}
            <Link
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              href="/register"
            >
              Sign up
            </Link>
            {" for free."}
          </p>
        </Form>
      </div>
    </div>
  );
}
