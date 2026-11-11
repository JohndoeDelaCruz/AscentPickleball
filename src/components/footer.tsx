"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import { Starburst } from "./starburst";
import { isWorkspacePath } from "@/lib/workspace";
export function Footer({ staff, year }: { staff: boolean; year: number }) {
  const path = usePathname();
  if (path === "/login" || (staff && isWorkspacePath(path))) return null;
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Brand light />
          <p>
            Good games. Great company.
            <br />
            Higher together.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/book">
            Book a court <ArrowUpRight size={15} />
          </Link>
          <Link href="/my-bookings">My bookings</Link>
          <Link href="/membership">Membership</Link>
          <Link href="/court-rules">Court rules</Link>
          <Link href="/#faq">Questions & answers</Link>
          <Link href="/staff">Staff access</Link>
        </div>
        <div className="footer-note">
          <span className="eyebrow">SEE YOU ON COURT</span>
          <p>
            Come for the game.
            <br />
            Stay for the people.
          </p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {year} Ascent Pickleball</span>
        <span>
          Made for the love of the game. <Starburst className="tiny-ball" />
        </span>
        <Link href="/privacy">Privacy policy</Link>
      </div>
    </footer>
  );
}
