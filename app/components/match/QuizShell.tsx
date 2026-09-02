"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Shared visual shell for both the guest and logged-in Match quizzes: same
 * progress bar, step-change animation, and footer nav, so the two wizards
 * (which intentionally keep separate answer models/submit logic) stay
 * visually identical. Never touches quiz answers -- purely presentational.
 */
export default function QuizShell({
  heading,
  tagline,
  timeEstimate,
  stepLabel,
  stepTitle,
  stepIndex,
  totalSteps,
  narrowingPath,
  backLabel,
  nextLabel,
  onBack,
  onNext,
  backDisabled,
  nextDisabled = false,
  children,
}: {
  heading: string;
  tagline: string;
  timeEstimate: string;
  stepLabel: string;
  stepTitle: string;
  stepIndex: number;
  totalSteps: number;
  narrowingPath?: string[];
  backLabel: string;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
  backDisabled: boolean;
  nextDisabled?: boolean;
  children: ReactNode;
}) {
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{heading}</h1>
        <p className="text-sm text-zinc-500">{tagline}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
          <span>{stepLabel}</span>
          <span>{timeEstimate}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <motion.div
            className="h-1.5 rounded-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
        <p className="text-sm font-medium text-navy-900">{stepTitle}</p>
      </div>

      {narrowingPath && narrowingPath.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-medium text-primary"
          aria-live="polite"
        >
          {narrowingPath.map((item, index) => (
            <span key={`${item}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true" className="text-primary/40">→</span>}
              {item}
            </span>
          ))}
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-soft sm:p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={backDisabled}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-0"
        >
          {backLabel}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white shadow-soft transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
