export function AppLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="al-bg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#060d18"/><stop offset="100%" stopColor="#0d1f35"/>
        </linearGradient>
        <linearGradient id="al-tL" x1="28" y1="28" x2="40" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#dbeafe"/>
        </linearGradient>
        <linearGradient id="al-tR" x1="52" y1="28" x2="40" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e0f7f6"/><stop offset="100%" stopColor="#00B5AD" stopOpacity="0.7"/>
        </linearGradient>
        <linearGradient id="al-pr" x1="0" y1="0" x2="80" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#818cf8" stopOpacity="0.5"/>
          <stop offset="33%"  stopColor="#00B5AD" stopOpacity="0.4"/>
          <stop offset="66%"  stopColor="#34d399" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.2"/>
        </linearGradient>
        <linearGradient id="al-st" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1A365D"/><stop offset="100%" stopColor="#234e7a"/>
        </linearGradient>
        <filter id="al-ng">
          <feGaussianBlur stdDeviation="1.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="al-gw">
          <feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="80" height="80" rx="18" fill="url(#al-bg)"/>
      <rect x="1.5" y="1.5" width="77" height="77" rx="16.5" stroke="#00B5AD" strokeOpacity="0.2" strokeWidth="1" fill="none"/>
      {/* Star facets */}
      <polygon points="40,4 23,23 40,24 57,23" fill="url(#al-st)" opacity="0.9"/>
      <polygon points="65,15 57,23 51,29 66,40" fill="url(#al-pr)"/>
      <polygon points="76,40 66,40 56,40 57,57" fill="url(#al-st)" opacity="0.8"/>
      <polygon points="65,65 57,57 51,51 40,66" fill="url(#al-pr)" opacity="0.8"/>
      <polygon points="40,76 40,66 40,56 23,57" fill="url(#al-st)" opacity="0.9"/>
      <polygon points="15,65 23,57 29,51 14,40" fill="url(#al-pr)" opacity="0.6"/>
      <polygon points="4,40 14,40 24,40 23,23" fill="url(#al-st)" opacity="0.85"/>
      <polygon points="15,15 23,23 29,29 14,40" fill="url(#al-pr)" opacity="0.5"/>
      {/* Girdle highlights */}
      <polygon points="23,23 40,24 29,29" fill="white" opacity="0.12"/>
      <polygon points="57,23 40,24 51,29" fill="white" opacity="0.08"/>
      <polygon points="66,40 56,40 51,29" fill="white" opacity="0.1"/>
      <polygon points="66,40 56,40 57,57" fill="white" opacity="0.06"/>
      <polygon points="57,57 40,56 51,51" fill="white" opacity="0.1"/>
      <polygon points="23,57 40,56 29,51" fill="white" opacity="0.07"/>
      <polygon points="14,40 24,40 29,51" fill="white" opacity="0.1"/>
      <polygon points="14,40 24,40 23,23" fill="white" opacity="0.08"/>
      {/* Book pages in table */}
      <polygon points="40,24 29,29 24,40 29,51 40,56 40,40" fill="url(#al-tL)"/>
      <polygon points="40,24 51,29 56,40 51,51 40,56 40,40" fill="url(#al-tR)"/>
      <line x1="40" y1="24" x2="40" y2="56" stroke="white" strokeWidth="1.2" strokeOpacity="0.8"/>
      <polyline points="29,29 40,24 51,29" fill="none" stroke="white" strokeWidth="0.9" strokeOpacity="0.6"/>
      <line x1="28" y1="35" x2="39" y2="33" stroke="#1A365D" strokeWidth="0.7" strokeOpacity="0.4"/>
      <line x1="27" y1="39" x2="39" y2="37" stroke="#1A365D" strokeWidth="0.7" strokeOpacity="0.3"/>
      <line x1="41" y1="33" x2="52" y2="35" stroke="#00897B" strokeWidth="0.7" strokeOpacity="0.3"/>
      <line x1="41" y1="37" x2="53" y2="39" stroke="#00897B" strokeWidth="0.7" strokeOpacity="0.22"/>
      {/* Outline */}
      <polygon points="40,4 65,15 76,40 65,65 40,76 15,65 4,40 15,15" fill="none" stroke="#00B5AD" strokeWidth="0.9" strokeOpacity="0.4"/>
      <polygon points="23,23 57,23 66,40 57,57 40,66 23,57 14,40 23,23" fill="none" stroke="#00B5AD" strokeWidth="0.7" strokeOpacity="0.3"/>
      <polygon points="40,24 51,29 56,40 51,51 40,56 29,51 24,40 29,29" fill="none" stroke="white" strokeWidth="0.9" strokeOpacity="0.5"/>
      <line x1="40" y1="4"  x2="40" y2="24" stroke="#00B5AD" strokeWidth="0.7" strokeOpacity="0.4"/>
      <line x1="65" y1="15" x2="51" y2="29" stroke="#00B5AD" strokeWidth="0.7" strokeOpacity="0.35"/>
      <line x1="76" y1="40" x2="56" y2="40" stroke="#00B5AD" strokeWidth="0.7" strokeOpacity="0.35"/>
      <line x1="65" y1="65" x2="51" y2="51" stroke="#00B5AD" strokeWidth="0.7" strokeOpacity="0.35"/>
      <line x1="40" y1="76" x2="40" y2="56" stroke="#00B5AD" strokeWidth="0.7" strokeOpacity="0.4"/>
      <line x1="15" y1="65" x2="29" y2="51" stroke="#00B5AD" strokeWidth="0.7" strokeOpacity="0.35"/>
      <line x1="4"  y1="40" x2="24" y2="40" stroke="#00B5AD" strokeWidth="0.7" strokeOpacity="0.35"/>
      <line x1="15" y1="15" x2="29" y2="29" stroke="#00B5AD" strokeWidth="0.7" strokeOpacity="0.35"/>
      {/* Node dots */}
      <g filter="url(#al-ng)">
        <circle cx="40" cy="4"  r="1.8" fill="#00B5AD" opacity="0.9"/>
        <circle cx="65" cy="15" r="1.5" fill="#00B5AD" opacity="0.7"/>
        <circle cx="76" cy="40" r="1.8" fill="#00B5AD" opacity="0.9"/>
        <circle cx="65" cy="65" r="1.5" fill="#00B5AD" opacity="0.7"/>
        <circle cx="40" cy="76" r="1.8" fill="#00B5AD" opacity="0.9"/>
        <circle cx="15" cy="65" r="1.5" fill="#00B5AD" opacity="0.7"/>
        <circle cx="4"  cy="40" r="1.8" fill="#00B5AD" opacity="0.9"/>
        <circle cx="15" cy="15" r="1.5" fill="#00B5AD" opacity="0.7"/>
        <circle cx="40" cy="24" r="1"   fill="white" opacity="0.85"/>
        <circle cx="51" cy="29" r="0.9" fill="white" opacity="0.7"/>
        <circle cx="56" cy="40" r="1"   fill="white" opacity="0.85"/>
        <circle cx="51" cy="51" r="0.9" fill="white" opacity="0.7"/>
        <circle cx="40" cy="56" r="1"   fill="white" opacity="0.85"/>
        <circle cx="29" cy="51" r="0.9" fill="white" opacity="0.7"/>
        <circle cx="24" cy="40" r="1"   fill="white" opacity="0.85"/>
        <circle cx="29" cy="29" r="0.9" fill="white" opacity="0.7"/>
      </g>
      {/* Sparkle */}
      <g filter="url(#al-gw)">
        <path d="M40,4 L40.8,7 L44,7.5 L40.8,8 L40,11 L39.2,8 L36,7.5 L39.2,7 Z" fill="white" opacity="0.95"/>
      </g>
    </svg>
  );
}
