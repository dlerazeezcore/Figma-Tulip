interface EsimIconProps {
  className?: string;
  strokeWidth?: number;
}

export function EsimIcon({ className = "w-16 h-16", strokeWidth = 2 }: EsimIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* SIM card outline with cut corner */}
      <path d="M16 2H8C6.89543 2 6 2.89543 6 4V20C6 21.1046 6.89543 22 8 22H16C17.1046 22 18 21.1046 18 20V7L16 2Z" />
      <path d="M16 2L18 7H16V2Z" fill="currentColor" opacity="0.3" />
      
      {/* eSIM chip pattern */}
      <rect x="8" y="8" width="8" height="10" rx="1" />
      
      {/* Circuit lines inside chip */}
      <line x1="10" y1="10" x2="10" y2="16" strokeWidth={strokeWidth * 0.6} />
      <line x1="12" y1="10" x2="12" y2="16" strokeWidth={strokeWidth * 0.6} />
      <line x1="14" y1="10" x2="14" y2="16" strokeWidth={strokeWidth * 0.6} />
      
      {/* Horizontal circuit lines */}
      <line x1="8" y1="11" x2="16" y2="11" strokeWidth={strokeWidth * 0.6} opacity="0.6" />
      <line x1="8" y1="13" x2="16" y2="13" strokeWidth={strokeWidth * 0.6} opacity="0.6" />
      <line x1="8" y1="15" x2="16" y2="15" strokeWidth={strokeWidth * 0.6} opacity="0.6" />
    </svg>
  );
}
