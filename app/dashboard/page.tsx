"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/auth-guard";

export default function DashboardIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/reservas");
  }, [router]);

  return (
    <AuthGuard>
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </AuthGuard>
  );
}
