import { Globe } from "lucide-react";
import { useState } from "react";

interface CountryFlagProps {
  code?: string;
  emoji?: string;
  className?: string;
  alt?: string;
}

function normalizeCountryCode(value: string): string {
  const code = String(value || "").trim().toUpperCase();
  return code.length === 2 ? code : "";
}

function isBrokenEmoji(value: string): boolean {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return true;
  }
  return trimmed.includes("\uFFFD") || /^[?]+$/.test(trimmed);
}

export function CountryFlag({ code, emoji, className = "", alt = "flag" }: CountryFlagProps) {
  const countryCode = normalizeCountryCode(String(code || ""));
  const displayEmoji = String(emoji || "").trim();
  const [imageFailed, setImageFailed] = useState(false);

  // Regional entries don't have ISO country codes; always use a stable world icon.
  if (!countryCode) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm bg-muted text-muted-foreground ${className}`}
        aria-label="regional destination"
      >
        <Globe className="h-4 w-4" />
      </span>
    );
  }

  if (countryCode && !imageFailed) {
    return (
      <img
        src={`https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`}
        alt={`${countryCode} ${alt}`}
        loading="lazy"
        className={className}
        onError={() => setImageFailed(true)}
      />
    );
  }

  if (!isBrokenEmoji(displayEmoji)) {
    return <span className={`emoji-flag inline-flex items-center justify-center ${className}`}>{displayEmoji}</span>;
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-sm bg-muted text-muted-foreground ${className}`}
      aria-label={alt}
    >
      <Globe className="h-4 w-4" />
    </span>
  );
}
