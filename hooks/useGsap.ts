"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/** Stagger-fade a container's direct children in on mount. */
export function useStaggerIn(options?: { delay?: number; y?: number; stagger?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const items = ref.current.children;
    if (!items.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { opacity: 0, y: options?.y ?? 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.42,
          ease: "power2.out",
          stagger: options?.stagger ?? 0.07,
          delay: options?.delay ?? 0,
        }
      );
    }, ref);

    return () => ctx.revert();
  }, [options?.delay, options?.stagger, options?.y]);

  return ref;
}

/** Count a number up from 0 to `target` when the element mounts. */
export function useCountUp(target: number, duration = 0.9) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current || !target) return;
    const el = ref.current;
    const isFloat = !Number.isInteger(target);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        { val: 0 },
        { val: target },
        {
          duration,
          ease: "power2.out",
          onUpdate() {
            const v = (this as { targets: () => { val: number }[] }).targets()[0].val;
            el.textContent = isFloat ? v.toFixed(1) : String(Math.round(v));
          },
        }
      );
    });

    return () => ctx.revert();
  }, [target, duration]);

  return ref;
}

/** Animate a progress bar width from 0 to `value`%. */
export function useProgressAnimate(value: number, delay = 0) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const inner = ref.current.querySelector("div") as HTMLElement | null;
    if (!inner) return;
    inner.style.width = "0%";

    const ctx = gsap.context(() => {
      gsap.to(inner, {
        width: `${Math.min(value, 100)}%`,
        duration: 0.8,
        ease: "power2.out",
        delay,
      });
    });

    return () => ctx.revert();
  }, [value, delay]);

  return ref;
}

/** Slide a single element in from below on mount. */
export function useSlideIn(options?: { y?: number; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: options?.y ?? 24 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", delay: options?.delay ?? 0 }
      );
    }, ref);

    return () => ctx.revert();
  }, [options?.delay, options?.y]);

  return ref;
}
