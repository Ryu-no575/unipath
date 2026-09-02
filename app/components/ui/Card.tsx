import type { ComponentPropsWithoutRef, ElementType } from "react";

type Padding = "none" | "sm" | "md" | "lg";

const PADDING_CLASSES: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

interface CardOwnProps<T extends ElementType> {
  padding?: Padding;
  /** Adds the hover lift used for clickable cards (links to a detail page). */
  interactive?: boolean;
  as?: T;
  className?: string;
}

export type CardProps<T extends ElementType = "div"> = CardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps<T>>;

export default function Card<T extends ElementType = "div">({
  padding = "md",
  interactive = false,
  as,
  className = "",
  ...props
}: CardProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={`rounded-xl border border-zinc-200 bg-white ${PADDING_CLASSES[padding]} ${
        interactive
          ? "transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
          : ""
      } ${className}`}
      {...props}
    />
  );
}
