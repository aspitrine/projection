import { Button } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { toast } from "sonner";

import { slugify } from "@/features/identity/slug";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth/onboarding")({
  component: Onboarding,
});

const OrganizationValues = Schema.toStandardSchemaV1(
  Schema.Struct({
    name: Schema.String.check(
      Schema.isMinLength(2, { message: "Le nom doit contenir au moins 2 caractères" }),
    ),
  }),
);

function Onboarding() {
  const form = useForm({
    defaultValues: { name: "" },
    validators: { onSubmit: OrganizationValues },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.organization.create({
        name: value.name.trim(),
        slug: slugify(value.name),
      });
      if (error) {
        toast.error(error.message ?? "Création impossible");
        return;
      }
      window.location.assign("/dashboard");
    },
  });

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-2 text-2xl font-semibold">Créer votre organisation</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Une organisation regroupe vos chants, vos projets et vos écrans. Vous pourrez inviter
        d'autres opérateurs ensuite. Pour rejoindre une organisation existante, ouvrez le lien
        d'invitation reçu.
      </p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Nom de l'organisation</Label>
              <Input
                id={field.name}
                name={field.name}
                placeholder="Église de …"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-red-500">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Création…" : "Créer l'organisation"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
