"use client";

import { useState } from "react";
import AuthGuard from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ANNOUNCEMENTS } from "@/lib/mocks/data";
import { CloudRain, Megaphone, AlertTriangle, Calendar } from "lucide-react";

const TEMPLATES = [
  {
    id: "rain",
    label: "Cancelación por lluvia",
    icon: CloudRain,
    title: "Cancelación por lluvia",
    body: "Se suspenden las actividades al aire libre para el turno de la tarde. Disculpen las molestias.",
  },
  {
    id: "maintenance",
    label: "Mantenimiento",
    icon: AlertTriangle,
    title: "Mantenimiento de cancha",
    body: "La cancha estará fuera de servicio por mantenimiento. Les avisaremos cuando vuelva a estar disponible.",
  },
  {
    id: "general",
    label: "Aviso general",
    icon: Megaphone,
    title: "Aviso importante",
    body: "",
  },
];

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [announcements, setAnnouncements] = useState(ANNOUNCEMENTS);

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setTitle(template.title);
      setBody(template.body);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    setAnnouncements((prev) => [
      {
        id: `a-${Date.now()}`,
        title: title.trim(),
        body: body.trim(),
        createdAt: formatted,
      },
      ...prev,
    ]);

    setTitle("");
    setBody("");
  };

  return (
    <AuthGuard>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-muted-foreground">
            Enviá avisos a socios y guardá un historial de comunicaciones.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo aviso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((template) => {
                const Icon = template.icon;
                return (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(template.id)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {template.label}
                  </Button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Cancelación por lluvia"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Mensaje</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Escribí el contenido del aviso..."
                  rows={4}
                  required
                />
              </div>
              <Button type="submit">Publicar aviso</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avisos recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="rounded-md border p-4"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">{announcement.title}</span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {announcement.createdAt}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{announcement.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
