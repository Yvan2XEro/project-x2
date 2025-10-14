"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { register as registerAction } from "@/app/(auth)/actions";
import { toast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const registerSchema = z
  .object({
    first_name: z.string().min(2, "First name must be at least 2 characters long"),
    last_name: z.string().min(2, "Last name must be at least 2 characters long"),
    email: z.string().email("Invalid email address"),
    linkedin: z.string().optional(),
    company_name: z.string().min(2, "Company name must be at least 2 characters long"),
    role: z.string().min(2, "Role must be at least 2 characters long"),
    interests: z.array(z.string()).min(3, "Please select at least 3 areas of interest"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirm_password: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const researchTypes = [
  "Market Entry & Expansion",
  "Competitive Landscape Analysis",
  "M&A & Deal Sourcing",
  "Industry / Sector Research",
  "Company Deep Dives",
  "Macroeconomic & Trend Analysis",
  "Benchmarking & KPI Analysis",
  "Customer & Persona Insights",
  "Investment Memo & IC Preparation",
  "Strategy Formulation / Business Design",
];

export default function Page() {
  const [open, setOpen] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { update: updateSession } = useSession();
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
    watch,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      interests: [],
      linkedin: "",
    },
  });

  const mutation = useMutation({
  mutationFn: async (data: RegisterForm) => {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (key === "interests" && Array.isArray(value)) {
        value.forEach((item) => formData.append("interests", item));
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    return registerAction({ status: "idle" }, formData);
  },
    onSuccess: (state) => {
      if (state.status === "success") {
        toast({
          type: "success",
          description: "Account created successfully!",
        });

        setIsSuccessful(true);
        updateSession();
        router.refresh();
        router.push("/");
      }
    },
    onError: (error: Error) => {
      let status: string | null = null;
      const err = error.message;
      
      if (err) {
        try {
          const parsed = JSON.parse(err);
          status = parsed.status;
        } catch {
          console.error("Failed to parse error message");
        }
      }

      if (status === "user_exists") {
        setError("email", {
          type: "custom",
          message: "This email is already in use",
        });
        toast({ type: "error", description: "Email already registered!" });
      } else if (status === "failed") {
        toast({ type: "error", description: "Registration failed!" });
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

  const onSubmit = async (data: RegisterForm) => {
    try {
      setIsLoading(true);
      
      // Clean up the data before submission
      const cleanedData = {
        ...data,
        linkedin: data.linkedin || "", // Ensure linkedin is always a string
      };
      
      await mutation.mutateAsync(cleanedData);
    } catch (error) {
      // Error handling is done in onError callback
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) => {
      const updated = prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest];

      setValue("interests", updated, { shouldValidate: true });
      return updated;
    });
  };

  const removeInterest = (interest: string) => {
    setSelectedInterests((prev) => {
      const updated = prev.filter((item) => item !== interest);
      setValue("interests", updated, { shouldValidate: true });
      return updated;
    });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-balance font-semibold text-4xl tracking-tight">
            Create Your Account
          </h1>
          <p className="mt-2 text-balance text-muted-foreground text-sm">
            Join us to access premium research and insights
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 rounded-2xl border bg-card p-8 shadow-lg"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                placeholder="John"
                className="h-11"
                {...register("first_name")}
              />
              {errors.first_name && (
                <p className="text-red-500 text-xs">{errors.first_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                placeholder="Doe"
                className="h-11"
                {...register("last_name")}
              />
              {errors.last_name && (
                <p className="text-red-500 text-xs">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="john.doe@company.com"
              className="h-11"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-red-500 text-xs">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin">
              LinkedIn Profile <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="linkedin"
              placeholder="https://linkedin.com/in/username"
              type="url"
              className="h-11"
              {...register("linkedin")}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                placeholder="Acme Inc."
                className="h-11"
                {...register("company_name")}
              />
              {errors.company_name && (
                <p className="text-red-500 text-xs">{errors.company_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role / Department</Label>
              <Input
                id="role"
                placeholder="Product Manager"
                className="h-11"
                {...register("role")}
              />
              {errors.role && (
                <p className="text-red-500 text-xs">{errors.role.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Areas of Interest</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="h-auto min-h-11 w-full justify-between font-normal bg-transparent"
                >
                  <span className="truncate">
                    {selectedInterests.length > 0
                      ? `${selectedInterests.length} area${
                          selectedInterests.length > 1 ? "s" : ""
                        } selected`
                      : "Select research areas..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                <Command>
                  <CommandInput placeholder="Search research areas..." />
                  <CommandList>
                    <CommandEmpty>No research area found.</CommandEmpty>
                    <CommandGroup>
                      {researchTypes.map((type, index) => (
                        <CommandItem
                          key={type}
                          value={type}
                          onSelect={() => toggleInterest(type)}
                        >
                          <span className="border w-6 flex justify-center items-center p-1">
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedInterests.includes(type)
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                          </span>
                          <span className="text-sm ml-2">
                            {index + 1}. {type}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {errors.interests && (
              <p className="text-red-500 text-xs">{errors.interests.message}</p>
            )}

            {selectedInterests.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedInterests.map((interest) => (
                  <Badge key={interest} variant="secondary" className="gap-1 pr-1">
                    <span className="text-xs">{interest}</span>
                    <button
                      type="button"
                      onClick={() => removeInterest(interest)}
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="h-11"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-red-500 text-xs">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                type="password"
                className="h-11"
                {...register("confirm_password")}
              />
              {errors.confirm_password && (
                <p className="text-red-500 text-xs">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full font-medium text-base"
            disabled={isSuccessful || isLoading}
          >
            {isLoading ? "Creating Account..." : isSuccessful ? "Account Created!" : "Create Account"}
          </Button>

          <p className="text-center text-muted-foreground text-sm">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}