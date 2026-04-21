import type { MyEsimItem } from "../wiring/my-esims-page-service";

export function formatDataAmountGb(value: number): string {
  const rounded = Math.round(Math.max(0, value) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatLongDate(value: string): string {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(value: string): string {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatSupportTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function getMyEsimStatusVariant(
  status: MyEsimItem["status"],
): "default" | "secondary" | "destructive" {
  if (status === "active") {
    return "default";
  }
  if (status === "expired") {
    return "destructive";
  }
  return "secondary";
}

export function getMyEsimStatusLabel(status: MyEsimItem["status"]): string {
  if (status === "pending") {
    return "pending";
  }
  if (status === "inactive") {
    return "inactive";
  }
  return status;
}
