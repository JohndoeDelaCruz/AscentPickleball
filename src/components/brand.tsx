import Link from "next/link";
import Image from "next/image";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="Ascent Pickleball home"
    >
      <Image
        src="/ascent-logo.png"
        width={144}
        height={144}
        alt="Ascent Pickleball Courts"
        sizes={light ? "144px" : "(max-width: 850px) 72px, 96px"}
        loading={light ? "lazy" : "eager"}
        className="brand-image"
      />
    </Link>
  );
}
