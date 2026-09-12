"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const COURT_TYPES = ["futbol", "tenis", "padel"] as const;
export type CourtType = (typeof COURT_TYPES)[number];

export const COURT_TYPE_LABELS: Record<CourtType, string> = {
  futbol: "Fútbol",
  tenis: "Tenis",
  padel: "Pádel",
};

export type Court = {
  id: string;
  user_id: string;
  name: string;
  type: CourtType;
  created_at: string;
};

export function useCourts() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const loadCourts = async () => {
      const { data, error } = await supabase
        .from("courts")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        setError("No se pudieron cargar las canchas.");
      } else {
        setCourts((data ?? []) as Court[]);
      }
      setIsLoading(false);
    };

    loadCourts();
  }, []);

  const createCourt = async (
    name: string,
    type: CourtType
  ): Promise<{ success: boolean; error?: string }> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "No hay sesión activa." };
    }

    const { data, error } = await supabase
      .from("courts")
      .insert({ name: name.trim(), type, user_id: user.id })
      .select()
      .single();

    if (error) {
      return { success: false, error: "No se pudo crear la cancha." };
    }

    setCourts((prev) => [...prev, data as Court]);
    return { success: true };
  };

  return { courts, isLoading, error, createCourt };
}
