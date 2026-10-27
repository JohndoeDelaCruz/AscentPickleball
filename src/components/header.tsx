"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Menu, X, LogOut, UserRound } from "lucide-react";
import { Brand } from "./brand";
import { createClient } from "@/lib/supabase/client";

export function Header({
  signedIn,
  staff,
}: {
  signedIn: boolean;
  staff: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  async function signOut() {
    await createClient().auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }
  const links = [
    { href: "/#courts", label: "The courts" },
    { href: "/membership", label: "Membership" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/#visit", label: "Find us" },
  ];
  return (
    <header className={`site-header${isAdmin ? " site-header--admin" : ""}`}>
      <div className="container nav-shell">
        <Brand compact={isAdmin} />
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
                href={staff ? "/admin" : signedIn ? "/my-bookings" : "/login"}
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
                href={signedIn ? (staff ? "/admin" : "/book") : "/login"}
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
          className="icon-button mobile-menu"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
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
                <Link href="/admin" onClick={() => setOpen(false)}>
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
        </nav>
      )}
    </header>
  );
}
