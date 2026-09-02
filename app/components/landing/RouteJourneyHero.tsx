"use client";

import { motion, useReducedMotion } from "framer-motion";

interface JourneyStop {
  label: string;
  flag?: string;
}

export default function RouteJourneyHero({
  origin,
  originFlag,
  destination,
  destinationFlag,
  institution,
}: {
  origin: string;
  originFlag: string;
  destination: string;
  destinationFlag: string;
  institution: string;
}) {
  const reduceMotion = useReducedMotion();
  const stops: JourneyStop[] = [
    { label: origin, flag: originFlag },
    { label: destination, flag: destinationFlag },
    { label: institution },
  ];

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-navy-900 p-6 shadow-elevated sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-transparent" />
      <ol className="relative flex flex-col">
        {stops.map((stop, index) => {
          const isLast = index === stops.length - 1;
          return (
            <li key={stop.label} className="relative flex items-start gap-4 pb-9 last:pb-0">
              {!isLast && (
                <motion.span
                  aria-hidden="true"
                  className="absolute left-[15px] top-8 bottom-0 w-px bg-gradient-to-b from-gold to-white/10"
                  style={{ transformOrigin: "top" }}
                  initial={reduceMotion ? undefined : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.7, delay: 0.25 + index * 0.4, ease: "easeOut" }}
                />
              )}
              <motion.span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${
                  isLast ? "bg-gold text-navy-900" : "bg-white/10 text-white"
                }`}
                initial={reduceMotion ? undefined : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.4 }}
              >
                {stop.flag ?? "🎓"}
              </motion.span>
              <motion.p
                initial={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.12 + index * 0.4 }}
                className={`pt-1 text-base font-semibold ${isLast ? "text-gold-soft" : "text-white"}`}
              >
                {stop.label}
              </motion.p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
