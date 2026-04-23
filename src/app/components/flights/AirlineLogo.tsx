import React from "react";
import { Plane } from "lucide-react";

export function AirlineLogo({ code, name }: { code: string; name: string }) {
  const [error, setError] = React.useState(false);

  if (!code || error) {
    return (
      <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden border border-indigo-100 dark:border-indigo-800 shrink-0" title={name}>
        <Plane className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
      </div>
    );
  }

  // We can use a free airline logo API like daonine or similar, but for safety and speed, we'll try a common pattern or a specific CDN, e.g., pics.avs.io
  const logoUrl = `https://pics.avs.io/200/200/${code}.png`;

  return (
    <div className="w-6 h-6 rounded-md bg-white dark:bg-white flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-200 shrink-0 shadow-sm" title={name}>
      <img
        src={logoUrl}
        alt={name}
        className="w-4 h-4 object-contain"
        onError={() => setError(true)}
      />
    </div>
  );
}
