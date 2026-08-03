export function formatUhrzeit(datum: Date | undefined): string {
  if (!datum) return "–";
  return datum.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
