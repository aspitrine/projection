import { Button, buttonVariants } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Schema } from "effect";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

import Loader from "./loader";

const signUpValues = () =>
  Schema.toStandardSchemaV1(
    Schema.Struct({
      name: Schema.String.check(Schema.isMinLength(2, { message: m.auth_name_too_short() })),
      email: Schema.String.check(
        Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: m.auth_invalid_email() }),
      ),
      password: Schema.String.check(
        Schema.isMinLength(8, { message: m.auth_password_too_short() }),
      ),
    }),
  );

const fields = [
  { name: "name", type: "text", label: m.auth_name },
  { name: "email", type: "email", label: m.auth_email },
  { name: "password", type: "password", label: m.auth_password },
] as const;

export default function SignUpForm({ redirectTo }: { redirectTo?: string | undefined }) {
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            // Nouveau compte : rejoindre via l'invitation, sinon créer son organisation.
            window.location.assign(redirectTo ?? "/onboarding");
            toast.success(m.auth_sign_up_success());
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: signUpValues(),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">{m.auth_sign_up_title()}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        {fields.map(({ name, type, label }) => (
          <form.Field key={name} name={name}>
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{label()}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type={type}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        ))}

        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? m.auth_submitting() : m.auth_sign_up()}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <Link
          to="/"
          search={{ redirect: redirectTo }}
          className={buttonVariants({ variant: "link" })}
        >
          {m.auth_to_sign_in()}
        </Link>
      </div>
    </div>
  );
}
