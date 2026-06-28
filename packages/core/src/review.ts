import type { ReviewState } from '@memoris/shared';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Interval (days) for the next review given the grade and the current mastery. */
function intervalDays(grade: ReviewGrade, mastery: number): number {
  const base = 1 + mastery * 20; // mastery 0 → ~1 day, mastery 1 → ~21 days
  switch (grade) {
    case 'again':
      return 0.02; // ~30 min — saw it, got it wrong
    case 'hard':
      return Math.max(1, base * 0.5);
    case 'good':
      return base;
    case 'easy':
      return base * 1.6;
  }
}

function masteryDelta(grade: ReviewGrade): number {
  switch (grade) {
    case 'again':
      return -0.2;
    case 'hard':
      return 0.05;
    case 'good':
      return 0.15;
    case 'easy':
      return 0.25;
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Apply a review grade → new mastery + next-review date. SM-2-flavored, deliberately simple
 * (docs/ROADMAP.md Phase 3).
 */
export function applyReview(state: ReviewState, grade: ReviewGrade, now: Date): ReviewState {
  const mastery = clamp01(state.mastery + masteryDelta(grade));
  const days = intervalDays(grade, mastery);
  return {
    mastery,
    lastReview: now.toISOString(),
    nextReview: new Date(now.getTime() + days * DAY_MS).toISOString(),
  };
}

/**
 * Real-world re-exposure decays review need (docs/ARCHITECTURE.md §10): meeting a concept in the
 * wild bumps mastery slightly and pushes the next review out, so Memoris goes quiet on things the
 * world keeps teaching.
 */
export function applyReExposure(state: ReviewState, now: Date): ReviewState {
  const mastery = clamp01(state.mastery + 0.05);
  const days = intervalDays('good', mastery);
  const candidate = now.getTime() + days * DAY_MS;
  const existing = state.nextReview ? new Date(state.nextReview).getTime() : 0;
  return {
    ...state,
    mastery,
    nextReview: new Date(Math.max(candidate, existing)).toISOString(),
  };
}

/** Is this concept due for review at `now`? */
export function isDue(state: ReviewState, now: Date): boolean {
  if (!state.nextReview) return false;
  return new Date(state.nextReview).getTime() <= now.getTime();
}

/** A fresh review state for a newly-saved concept (first review ~tomorrow). */
export function initialReviewState(now: Date): ReviewState {
  return {
    mastery: 0,
    nextReview: new Date(now.getTime() + DAY_MS).toISOString(),
  };
}
