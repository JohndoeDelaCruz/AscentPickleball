"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

function animateHeroBrand(root: HTMLElement, compact: boolean) {
  const header = document.querySelector<HTMLElement>(".site-header--home");
  const headerSlot = header?.querySelector<HTMLElement>("[data-home-brand-slot]");
  const brand = headerSlot?.querySelector<HTMLAnchorElement>(".brand");
  const hero = root.querySelector<HTMLElement>("[data-landing-hero]");
  const brands = hero?.querySelector<HTMLElement>("[data-hero-brands]");
  const heroSlot = brands?.querySelector<HTMLElement>("[data-hero-brand-slot]");
  const partner = brands?.querySelector<HTMLElement>("[data-hero-partner]");
  if (!header || !headerSlot || !brand || !hero || !brands || !heroSlot || !partner) return;
  const menu = compact ? header.querySelector<HTMLElement>(".mobile-nav") : null;

  let previousScroll = Math.max(0, window.scrollY);
  let destination = previousScroll === 0 ? 1 : 0;
  const position = { progress: destination, reveal: 0 };
  const originalTransform = brand.style.transform;

  const render = (
    end = heroSlot.getBoundingClientRect(),
    headerBottom = header.getBoundingClientRect().bottom,
  ) => {
    const start = headerSlot.getBoundingClientRect();
    const { progress, reveal } = position;
    const centeredSize = Math.min(340, end.width * 1.35);
    const size = gsap.utils.interpolate(centeredSize, end.width, reveal);
    const left = end.left + (brands.clientWidth - centeredSize) / 2 * (1 - reveal);
    const top = end.top + (end.width - size) / 2;
    const x = (left - start.left) * progress;
    const y = (Math.max(top, headerBottom + 12) - start.top) * progress;
    const scale = gsap.utils.interpolate(1, size / start.width, progress);
    brand.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

    const opacity = Math.max(0, (Math.min(progress, reveal) - 0.25) / 0.75);
    partner.style.opacity = String(opacity);
    partner.style.visibility = opacity > 0 ? "visible" : "hidden";
  };

  const move = gsap.quickTo(position, "progress", {
    duration: compact ? 0.46 : 0.65,
    ease: "power3.inOut",
    onUpdate: render,
  });
  const revealPartner = gsap.to(position, {
    reveal: 1,
    paused: true,
    delay: 0.2,
    duration: compact ? 0.66 : 0.9,
    ease: "power2.inOut",
    onUpdate: render,
  });

  const update = () => {
    const scroll = Math.max(0, window.scrollY);
    const atTop = scroll === 0;
    const delta = scroll - previousScroll;
    const hasDirection = Math.abs(delta) >= (compact ? 12 : 6);
    if (hasDirection || atTop) previousScroll = scroll;

    const headerBottom = header.getBoundingClientRect().bottom;
    const slot = heroSlot.getBoundingClientRect();
    const menuOpen = menu?.dataset.open === "true" && menu.getClientRects().length > 0;
    let next = destination;
    if (menuOpen) next = 0;
    else if (atTop) next = 1;
    else if (slot.top < headerBottom + 12) next = 0;
    else if (hasDirection) next = delta > 0 ? 1 : 0;

    if (next !== destination) {
      destination = next;
      move(next);
      if (next) revealPartner.play();
    }
    // A jump to a section below the hero should leave the logo in the header.
    if (hero.getBoundingClientRect().bottom <= headerBottom && position.progress > 0) {
      move.tween.progress(1);
    }
    render(slot, headerBottom);
  };

  if (destination) revealPartner.play();
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  const menuObserver = menu ? new MutationObserver(update) : null;
  if (menu && menuObserver) menuObserver.observe(menu, { attributeFilter: ["data-open"] });
  return () => {
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    menuObserver?.disconnect();
    move.tween.kill();
    revealPartner.kill();
    brand.style.transform = originalTransform;
    partner.style.removeProperty("opacity");
    partner.style.removeProperty("visibility");
  };
}

export function LandingMotion({ children }: { children: ReactNode }) {
  const container = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = container.current;
      if (!root) return;

      const media = gsap.matchMedia();
      media.add(
        {
          showBrands: "(prefers-reduced-motion: no-preference) and ((min-height: 561px) or (orientation: portrait))",
          compact: "(max-width: 1100px)",
        },
        ({ conditions }) => {
          if (conditions?.showBrands) return animateHeroBrand(root, Boolean(conditions.compact));
        },
      );
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
