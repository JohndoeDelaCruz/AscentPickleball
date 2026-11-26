"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Menu, X, LogOut, UserRound } from "lucide-react";
import { Brand } from "./brand";
import { createClient } from "@/lib/supabase/client";
import { isWorkspacePath } from "@/lib/workspace";

export function Header({
  signedIn,
  staff,
}: {
  signedIn: boolean;
  staff: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileNavId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (!isHome) return;

    const updateScroll = () => setScrolled(window.scrollY > 0);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("pageshow", updateScroll);
    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("pageshow", updateScroll);
    };
  }, [isHome]);

  if (pathname === "/login" || (staff && isWorkspacePath(pathname))) return null;
  async function signOut() {
    await createClient().auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }
  const links = [
    { href: "/#courts", label: "The courts" },
    { href: "/membership", label: "Membership" },
    { href: "/#visit", label: "Find us" },
  ];
  return (
    <header
      className={`site-header${isHome ? " site-header--home" : ""}${isAdmin ? " site-header--admin" : ""}`}
      data-scrolled={isHome ? scrolled : undefined}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        menuButton.current?.focus();
        setOpen(false);
      }}
    >
      <div className="container nav-shell">
        {isHome ? (
          <div className="home-brand-slot" data-home-brand-slot>
            <Brand sizes="(min-width: 1101px) and (min-height: 561px) and (prefers-reduced-motion: no-preference) 340px, (max-width: 850px) 58px, 68px" />
          </div>
        ) : <Brand compact={isAdmin} />}
        {!isAdmin && (
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="nav-actions">
          {isAdmin ? (
            <Link
              href="/"
              className="button button-dark button-small admin-site-link"
              onClick={() => setOpen(false)}
            >
              View website <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                href={staff ? "/staff" : signedIn ? "/my-bookings" : "/login"}
                className="nav-account"
              >
                {staff ? "Dashboard" : signedIn ? "My bookings" : "Log in"}
              </Link>
              <Link
                href="/book"
                className="button button-dark button-small nav-book-button"
              >
                Book a court <ArrowUpRight size={16} />
              </Link>
              <Link
                href={signedIn ? (staff ? "/staff" : "/book") : "/login"}
                className="button button-dark button-small nav-mobile-primary"
                onClick={() => setOpen(false)}
              >
                {signedIn
                  ? staff
                    ? "Dashboard"
                    : "Book a court"
                  : "Log in / Sign up"}
                {signedIn && !staff && (
                  <ArrowUpRight size={16} aria-hidden="true" />
                )}
              </Link>
            </>
          )}
          {signedIn && (
            <Link
              href="/account"
              className="icon-button account-settings"
              aria-label="Account settings"
              title="Account settings"
            >
              <UserRound size={18} />
            </Link>
          )}
          {signedIn && (
            <button
              className="icon-button sign-out"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
        <button
          type="button"
          ref={menuButton}
          className="icon-button mobile-menu"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls={mobileNavId}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <nav
        id={mobileNavId}
        className="mobile-nav"
        aria-label="Mobile navigation"
        data-open={open}
        inert={!open}
      >
        <div className="mobile-nav-clip">
          <div className="mobile-nav-links" data-lenis-prevent="">
            {!isAdmin && (
              <>
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link href="/my-bookings" onClick={() => setOpen(false)}>
                  My bookings
                </Link>
                {staff && (
                  <Link href="/staff" onClick={() => setOpen(false)}>
                    Dashboard
                  </Link>
                )}
              </>
            )}
            <Link
              href={signedIn ? "/account" : "/login"}
              onClick={() => setOpen(false)}
            >
              {signedIn
                ? "Account settings / Change password"
                : "Log in / Sign up"}
            </Link>
            {signedIn && <button onClick={signOut}>Sign out</button>}
            <Link
              href="/book"
              className="button button-dark"
              onClick={() => setOpen(false)}
            >
              Book a court <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
