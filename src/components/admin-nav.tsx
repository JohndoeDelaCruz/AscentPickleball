"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Settings2,
  ChartNoAxesCombined,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  KeyRound,
} from "lucide-react";

const items = [
  { href: "/admin", label: "Court calendar", icon: CalendarDays },
  { href: "/admin/finance", label: "Finance", icon: ChartNoAxesCombined },
  { href: "/admin/settings", label: "Venue settings", icon: Settings2 },
  { href: "/account", label: "Change password", icon: KeyRound },
];

export function AdminNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const current = items.find((item) => item.href === path) ?? items[0];
  return (
    <nav
      className={`admin-nav${open ? " is-open" : ""}${collapsed ? " is-collapsed" : ""}`}
      aria-label="Staff dashboard"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="admin-nav-heading">
        <span className="admin-nav-label">Administration</span>
        <button
          type="button"
          className="admin-collapse-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="admin-nav-links"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      <button
        ref={menuButton}
        type="button"
        className="admin-menu-toggle"
        aria-label={`Admin menu: ${current.label}`}
        aria-expanded={open}
        aria-controls="admin-nav-links"
        onClick={() => setOpen(!open)}
      >
        <PanelLeft size={18} aria-hidden="true" />
        <span>{current.label}</span>
        <ChevronDown size={16} className="admin-menu-chevron" aria-hidden="true" />
      </button>
      <div id="admin-nav-links" className="admin-nav-links">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={path === href ? "active" : ""}
            aria-label={label}
            aria-current={path === href ? "page" : undefined}
            title={collapsed ? label : undefined}
            onNavigate={() => setOpen(false)}
          >
            <Icon size={18} aria-hidden="true" />
            <span className="admin-link-label">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
