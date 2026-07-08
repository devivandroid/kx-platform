"use client";

import type { RatingSummary } from "@/lib/ratings";

type StarDisplayProps = {
  rating: number;
  label?: string;
  size?: "sm" | "md";
};

type StarInputProps = {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
};

type RatingSummaryTextProps = {
  summary: RatingSummary;
};

function starFill(rating: number, star: number): string {
  if (rating >= star) {
    return "text-amber-300";
  }

  if (rating > star - 1) {
    return "text-amber-300/70";
  }

  return "text-slate-700";
}

export function StarDisplay({ rating, label, size = "sm" }: StarDisplayProps) {
  const roundedRating = Math.max(0, Math.min(5, rating));
  const fontSize = size === "md" ? 20 : 14;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      style={{ fontSize, lineHeight: 1 }}
      aria-label={label ?? `${roundedRating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={starFill(roundedRating, star)} aria-hidden="true">
          {"\u2605"}
        </span>
      ))}
    </span>
  );
}

export function StarInput({ value, onChange, disabled = false }: StarInputProps) {
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rate this product">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className="flex size-8 items-center justify-center rounded-md leading-none text-slate-700 transition hover:scale-105 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ fontSize: 22, lineHeight: 1 }}
        >
          <span className={star <= value ? "text-amber-300" : "text-slate-700"}>
            {"\u2605"}
          </span>
        </button>
      ))}
    </div>
  );
}

export function RatingSummaryText({ summary }: RatingSummaryTextProps) {
  if (!summary.count) {
    return <span>No ratings yet</span>;
  }

  return (
    <span>
      {"\u2605"} {summary.average.toFixed(1)} {"\u00b7"} {summary.count} rating
      {summary.count === 1 ? "" : "s"}
    </span>
  );
}
