import type { CourtInput } from "@/lib/courts";

/** Defaults del formulario de cancha. */
export const COURT_FORM_DEFAULTS: CourtInput = {
  name: "",
  type: undefined as unknown as CourtInput["type"],
  price_per_hour: "" as unknown as number,
  slot_duration: 60,
  open_time: "09:00",
  close_time: "22:00",
  deposit_enabled: false,
  deposit_type: "percent",
  deposit_value: 30,
};
