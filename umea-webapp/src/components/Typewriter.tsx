"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  speed?: number;       // ms per character (default 45)
  delay?: number;       // delay before starting after scroll trigger (ms)
  className?: string;
  cursor?: boolean;
};

export function Typewriter({ text, speed = 45, delay = 0, className = "", cursor = true }: Props) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Start when element enters viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setStarted(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  // Type characters one by one
  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [started, text, speed]);

  return (
    <span ref={ref} className={className}>
      {displayed || <span className="opacity-0">{text[0]}</span>}
      {cursor && !done && (
        <span className="inline-block w-[2px] h-[1em] bg-current ml-0.5 align-middle animate-pulse opacity-80" />
      )}
    </span>
  );
}
