function formatNumber(value: number): string {
  const abs = Math.abs(value);
  const maxFractionDigits = abs >= 10 ? 1 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

export function formatDataAmount(dataGb: number): string {
  const normalized = Number.isFinite(dataGb) ? Math.max(0, dataGb) : 0;

  if (normalized >= 1) {
    return `${formatNumber(normalized)} GB`;
  }

  const mb = Math.max(1, Math.round(normalized * 1000));
  return `${new Intl.NumberFormat("en-US").format(mb)} MB`;
}

export function formatDataAllowance(
  dataGb: number,
  options?: {
    unlimited?: boolean;
    perDay?: boolean;
  },
): string {
  const unlimited = Boolean(options?.unlimited);
  const perDay = Boolean(options?.perDay);

  if (unlimited) {
    return "Unlimited";
  }

  const amount = formatDataAmount(dataGb);
  return perDay ? `${amount} / day` : amount;
}