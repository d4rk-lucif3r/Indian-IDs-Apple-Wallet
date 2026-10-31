// Browser-only: assembles a reading report with the app version and a coarse browser label.
import { browserLabel, buildReport, type ReportInput } from "@/lib/diagnostics";
import { TERMS_VERSION } from "@/lib/terms";

export function makeReport(input: Omit<ReportInput, "appVersion" | "browser">): string {
  return buildReport({ ...input, appVersion: TERMS_VERSION, browser: browserLabel(navigator.userAgent) });
}
