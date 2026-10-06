"use client";

import { useMemo, useState } from "react";
import AuthGuard from "@/components/auth-guard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MEMBERS } from "@/lib/mocks/data";
import { PageHeader } from "@/components/shell/page-header";

export default function MembersPage() {
  const [search, setSearch] = useState("");

  const filteredMembers = useMemo(() => {
    const term = search.toLowerCase();
    return MEMBERS.filter((member) =>
      member.name.toLowerCase().includes(term)
    );
  }, [search]);

  return (
    <AuthGuard>
      <div className="space-y-4">
        <PageHeader title="Socios" description="Listado de socios del club." />

        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado de cuota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.dni}</TableCell>
                  <TableCell>{member.phone}</TableCell>
                  <TableCell>
                    <Badge
                      variant={member.feeStatus === "paid" ? "default" : "destructive"}
                    >
                      {member.feeStatus === "paid" ? "Al día" : "Pendiente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No se encontraron socios.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AuthGuard>
  );
}
