import Link from "next/link";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="Ascent Pickleball home"
    >
      <svg
        width="38"
        height="38"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <path d="m5 51 23-39h8l23 39H43L32 32 21 51Z" fill="currentColor" />
        <path
          d="m36 12 23 39H43L32 32 40 19"
          fill="currentColor"
          opacity=".45"
        />
      </svg>
      <span>
        <strong>ASCENT</strong>
        <small>PICKLEBALL</small>
      </span>
    </Link>
  );
}
