export function ShirubeAvatar({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="しるべさん"
      className="shrink-0 rounded-full bg-forest-soft"
    >
      <circle cx="32" cy="32" r="32" fill="#E3EEE8" />
      <circle cx="32" cy="24" r="12" fill="#F3E6D4" />
      <path
        d="M16 56c2-12 10-18 16-18s14 6 16 18"
        fill="#1F4A3A"
      />
      <path d="M20 56h24v2H20z" fill="#16382C" />
      <circle cx="28" cy="23" r="1.4" fill="#2B2924" />
      <circle cx="36" cy="23" r="1.4" fill="#2B2924" />
      <path
        d="M29 28c1.2 1.2 4.8 1.2 6 0"
        fill="none"
        stroke="#5A554C"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
