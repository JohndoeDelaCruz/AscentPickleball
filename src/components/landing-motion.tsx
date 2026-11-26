"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function LandingMotion({ children }: { children: ReactNode }) {
  const container = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = container.current;
      if (!root) return;

      const media = gsap.matchMedia();
      media.add(
        {
          mobile: "(max-width: 850px)",
          motion: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          if (!context.conditions?.motion) return;

          const mobile = context.conditions.mobile;
          const lenis = new Lenis({
            lerp: 0.095,
            syncTouch: false,
            virtualScroll: ({ deltaX, deltaY, event }) =>
              event.type !== "wheel" ||
              (!event.shiftKey && Math.abs(deltaY) >= Math.abs(deltaX)),
          });
          const tick = (seconds: number) => lenis.raf(seconds * 1000);
          lenis.on("scroll", () => ScrollTrigger.update());
          gsap.ticker.lagSmoothing(0);
          gsap.ticker.add(tick);

          // Let native keyboard scrolling and Next's links take over immediately.
          const stopInertia = () => {
            if (lenis.isSmooth) lenis.scrollTo(window.scrollY, { immediate: true });
          };
          document.addEventListener("click", stopInertia, true);
          document.addEventListener("keydown", stopInertia);
          document.addEventListener("focusin", stopInertia);
          window.addEventListener("popstate", stopInertia);

          const animations = new Map<HTMLElement, gsap.core.Tween>();
          const hero = root.querySelector<HTMLElement>("[data-landing-hero]");
          const heroPhoto = hero?.querySelector<HTMLElement>("[data-hero-photo]");

          if (hero && heroPhoto) {
            gsap.fromTo(heroPhoto, { y: 0 }, {
              y: () => -parseFloat(getComputedStyle(heroPhoto).top),
              ease: "power1.out",
              scrollTrigger: {
                trigger: hero,
                start: "top top",
                end: "bottom 20%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            });
          }

          if (hero && hero.getBoundingClientRect().bottom > 0) {
            const elements = root.querySelectorAll<HTMLElement>("[data-hero]");
            const entrance = gsap.from(elements, {
              y: mobile ? 12 : 20,
              opacity: 0,
              duration: 0.65,
              stagger: 0.1,
              ease: "power2.out",
              clearProps: "opacity,transform",
            });
            elements.forEach((element) => animations.set(element, entrance));

            gsap.from(root.querySelector("[data-hero-image]"), {
              scale: 1.035,
              duration: 1.2,
              ease: "power2.out",
              clearProps: "transform",
            });
          }

          root.querySelectorAll<HTMLElement>("[data-reveal]").forEach(
            (element) => {
              // Preserve restored scroll positions and direct links to sections.
              if (element.getBoundingClientRect().top < window.innerHeight * 0.92)
                return;

              const direction = mobile ? "" : element.dataset.reveal;
              const x = direction === "left" ? -26 : direction === "right" ? 26 : 0;
              const reveal = gsap.from(element, {
                x,
                y: x ? 0 : mobile ? 16 : 30,
                opacity: 0,
                delay: mobile ? 0 : Number(element.dataset.revealDelay ?? 0),
                duration: mobile ? 0.5 : 0.7,
                ease: "power3.out",
                clearProps: "opacity,transform",
                scrollTrigger: {
                  trigger: element,
                  start: "top 92%",
                  once: true,
                  fastScrollEnd: true,
                },
              });
              animations.set(element, reveal);
            },
          );

          // Keyboard navigation should reveal a focused link immediately.
          const revealFocused = (event: FocusEvent) => {
            if (!(event.target instanceof Element)) return;
            const element = event.target.closest<HTMLElement>(
              "[data-reveal], [data-hero]",
            );
            if (element) animations.get(element)?.progress(1);
          };
          root.addEventListener("focusin", revealFocused);
          return () => {
            root.removeEventListener("focusin", revealFocused);
            document.removeEventListener("click", stopInertia, true);
            document.removeEventListener("keydown", stopInertia);
            document.removeEventListener("focusin", stopInertia);
            window.removeEventListener("popstate", stopInertia);
            gsap.ticker.remove(tick);
            gsap.ticker.lagSmoothing(500, 33);
            lenis.destroy();
          };
        },
        container,
      );

      return () => media.revert();
    },
    { scope: container },
  );

  return (
    <main id="main" ref={container}>
      {children}
    </main>
  );
}
