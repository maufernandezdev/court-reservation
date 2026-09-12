"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, LandPlot } from "lucide-react";
import { useCourts, COURT_TYPES, COURT_TYPE_LABELS, type CourtType } from "@/hooks/use-courts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const courtSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre para la cancha"),
  type: z.enum(COURT_TYPES, {
    message: "Seleccioná un tipo de cancha",
  }),
});

type CourtValues = z.infer<typeof courtSchema>;

export default function CanchasPage() {
  const { courts, isLoading, error, createCourt } = useCourts();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CourtValues>({
    resolver: zodResolver(courtSchema),
    defaultValues: { name: "", type: undefined },
  });

  const openDialog = () => {
    setFormError("");
    form.reset();
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: CourtValues) => {
    setFormError("");
    setIsSubmitting(true);

    const { success, error } = await createCourt(values.name, values.type);

    if (success) {
      setIsDialogOpen(false);
    } else {
      setFormError(error ?? "No se pudo crear la cancha.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Canchas</h1>
          <p className="text-sm text-muted-foreground">
            Gestioná las canchas de tu club
          </p>
        </div>
        <Button onClick={openDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva cancha
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : courts.length === 0 ? (
        <Card className="flex min-h-[30vh] flex-col items-center justify-center text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <LandPlot className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Todavía no tenés canchas</CardTitle>
            <CardDescription>
              Creá tu primera cancha para empezar a gestionar las reservas de
              tu club.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Crear tu primera cancha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((court) => (
            <Card key={court.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{court.name}</CardTitle>
                  <Badge variant="secondary">
                    {COURT_TYPE_LABELS[court.type as CourtType]}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva cancha</DialogTitle>
            <DialogDescription>
              Agregá una cancha a tu club. Podés crear todas las que necesites.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Cancha 1"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Controller
                control={form.control}
                name="type"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccioná un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COURT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {COURT_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && (
                      <FormMessage>{fieldState.error.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : "Guardar cancha"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
