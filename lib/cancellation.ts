/**
 * Resultado de cancelar un turno según la política del club. Replica el
 * cálculo de `cancelReservationAction` (app/dashboard/reservas/actions.ts):
 * si cambia uno, cambiar el otro.
 *
 * - En término: todo lo cobrado se libera como saldo a favor.
 * - Fuera de término: penalidad = % del valor del turno; se retiene de lo
 *   cobrado, lo que sobra se libera y lo que falta queda como deuda.
 */
export type CancellationOutcome = {
  late: boolean;
  penalty: number;
  retained: number;
  released: number;
  debt: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function cancellationOutcome({
  late,
  slotPrice,
  paid,
  penaltyPercent,
}: {
  late: boolean;
  slotPrice: number;
  paid: number;
  penaltyPercent: number;
}): CancellationOutcome {
  if (!late) {
    return { late, penalty: 0, retained: 0, released: round2(paid), debt: 0 };
  }
  const penalty = round2(slotPrice * (penaltyPercent / 100));
  const retained = Math.min(paid, penalty);
  return {
    late,
    penalty,
    retained,
    released: round2(paid - retained),
    debt: round2(Math.max(0, penalty - paid)),
  };
}
