import type { CourtInput } from "@/lib/courts";

/** Defaults del formulario de cancha. */
export const COURT_FORM_DEFAULTS: CourtInput = {
  name: "",
  type: undefined as unknown as CourtInput["type"],
};
