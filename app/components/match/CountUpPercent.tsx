"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export default function CountUpPercent({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const controls = animate(0, value, {
      duration: reduceMotion ? 0 : 1,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return <span className={className}>{display}%</span>;
}
