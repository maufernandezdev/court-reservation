"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Reservation = {
  id: string;
  user_id: string;
  court_id: string;
  date: string; // YYYY-MM-DD
  time: string; // "HH:00", franja de inicio en bloques de 1h
  customer_name: string;
  phone: string;
  created_at: string;
};

export type ReservationInput = {
  court_id: string;
  date: string;
  time: string;
  customer_name: string;
  phone: string;
};

const DOUBLE_BOOKING_MESSAGE = "Esa cancha ya está reservada en ese horario";

function byTime(a: Reservation, b: Reservation) {
  return a.time.localeCompare(b.time);
}

function translateError(error: { code?: string; message?: string }): string {
  if (error.code === "23505") {
    return DOUBLE_BOOKING_MESSAGE;
  }
  return "No se pudo guardar la reserva.";
}

export function useReservations(date: string) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("date", date)
      .order("time", { ascending: true });

    if (error) {
      setError("No se pudieron cargar las reservas.");
    } else {
      setReservations((data ?? []) as Reservation[]);
    }
    setIsLoading(false);
  }, [supabase, date]);

  useEffect(() => {
    load();
  }, [load]);

  const createReservation = async (
    input: ReservationInput
  ): Promise<{ success: boolean; error?: string }> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "No hay sesión activa." };
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        court_id: input.court_id,
        date: input.date,
        time: input.time,
        customer_name: input.customer_name.trim(),
        phone: input.phone.trim(),
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: translateError(error) };
    }

    const created = data as Reservation;
    setReservations((prev) =>
      created.date === date ? [...prev, created].sort(byTime) : prev
    );
    return { success: true };
  };

  const updateReservation = async (
    id: string,
    input: ReservationInput
  ): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase
      .from("reservations")
      .update({
        court_id: input.court_id,
        date: input.date,
        time: input.time,
        customer_name: input.customer_name.trim(),
        phone: input.phone.trim(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: translateError(error) };
    }

    const updated = data as Reservation;
    setReservations((prev) =>
      updated.date === date
        ? [...prev.filter((r) => r.id !== id), updated].sort(byTime)
        : prev.filter((r) => r.id !== id)
    );
    return { success: true };
  };

  const deleteReservation = async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.from("reservations").delete().eq("id", id);

    if (error) {
      return { success: false, error: "No se pudo eliminar la reserva." };
    }

    setReservations((prev) => prev.filter((r) => r.id !== id));
    return { success: true };
  };

  return {
    reservations,
    isLoading,
    error,
    refetch: load,
    createReservation,
    updateReservation,
    deleteReservation,
  };
}
