"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

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
          desktop: "(min-width: 851px)",
          mobile: "(max-width: 850px)",
          reducedMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (context.conditions?.reducedMotion) return;

          const mobile = context.conditions?.mobile;
          const animations = new Map<HTMLElement, gsap.core.Tween>();
          const hero = root.querySelector<HTMLElement>(".hero");

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

            gsap.from(root.querySelector(".hero-art"), {
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

              const reveal = gsap.from(element, {
                y: mobile ? 12 : 24,
                opacity: 0,
                duration: mobile ? 0.45 : 0.6,
                ease: "power2.out",
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
          return () => root.removeEventListener("focusin", revealFocused);
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
