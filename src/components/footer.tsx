import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
export function Footer() {
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
          <Link href="/#faq">Questions & answers</Link>
          <Link href="/admin">Staff access</Link>
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
        <span>© {new Date().getFullYear()} Ascent Pickleball</span>
        <span>
          Made for the love of the game. <span className="tiny-ball">✳</span>
        </span>
        <Link href="/privacy">Privacy policy</Link>
      </div>
    </footer>
  );
}
