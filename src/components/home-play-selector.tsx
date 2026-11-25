"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, UsersRound } from "lucide-react";
import styles from "@/app/home.module.css";

const choices = {
  court: {
    label: "Private court",
    title: "A court for your group.",
    description: "Choose a court and reserve up to four consecutive hours, subject to availability.",
    action: "Book a court",
    href: "/book",
    Icon: CalendarDays,
  },
  open: {
    label: "Open play",
    title: "Join a shared session.",
    description: "Get one pass per player and rotate between games for the session.",
    action: "Join open play",
    href: "/book?play=open",
    Icon: UsersRound,
  },
};
type Choice = keyof typeof choices;

export function HomePlaySelector({ showOpenPlay }: { showOpenPlay: boolean }) {
  const id = useId();
  const [selected, setSelected] = useState<Choice>("court");
  const choice = showOpenPlay ? selected : "court";
  const detail = choices[choice];

  return (
    <section className={`container ${styles.play}`} id="play" aria-labelledby="ways-to-play-title" data-reveal="">
      <div>
        <h2 id="ways-to-play-title">Ways to play.</h2>
        {showOpenPlay && (
          <div className={styles.playTabs} role="tablist" aria-label="Ways to play">
            {(["court", "open"] as const).map((key) => {
              const { label, Icon } = choices[key];
              return (
                <button key={key} id={`${id}-${key}`} type="button" role="tab"
                  aria-selected={choice === key} aria-controls={`${id}-panel`} tabIndex={choice === key ? 0 : -1}
                  onClick={() => setSelected(key)}
                  onKeyDown={(event) => {
                    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const next = event.key === "Home" ? "court" : event.key === "End" ? "open" : key === "court" ? "open" : "court";
                    setSelected(next);
                    document.getElementById(`${id}-${next}`)?.focus();
                  }}>
                  <Icon size={20} aria-hidden="true" /> {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div id={`${id}-panel`} className={styles.playPanel} role={showOpenPlay ? "tabpanel" : undefined}
        aria-labelledby={showOpenPlay ? `${id}-${choice}` : undefined}>
        <h3>{detail.title}</h3>
        <p>{detail.description}</p>
        <Link href={detail.href} className="button button-lime">
          {detail.action} <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
