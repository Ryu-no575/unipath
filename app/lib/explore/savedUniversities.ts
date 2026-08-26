"use client";

/**
 * Client-only "Saved" and "Compare" collections for Explore search results.
 * There is no backend table for this (a real bookmark/watchlist feature
 * would need a DB migration, out of scope for this redesign pass -- see
 * AGENTS.md section 21), so both collections live in localStorage, scoped
 * per-browser. Works for both raw ROR search results (no catalog id yet)
 * and catalog universities.
 */
export interface SavedUniversityItem {
  /** Stable key: `ror:<rorId>` or `catalog:<id>`. */
  key: string;
  name: string;
  location: string | null;
  /** Where "View" should go -- external site for ROR results, /universities/[id] for catalog ones. */
  href: string;
  external: boolean;
  savedAt: number;
}

const SAVED_KEY = "unipath:explore:saved";
const COMPARE_KEY = "unipath:explore:compare";
const MAX_COMPARE = 3;

function readList(storageKey: string): SavedUniversityItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(storageKey: string, items: SavedUniversityItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("unipath:explore-collection-change"));
}

export function getSavedUniversities(): SavedUniversityItem[] {
  return readList(SAVED_KEY);
}

export function isSaved(key: string): boolean {
  return getSavedUniversities().some((item) => item.key === key);
}

export function toggleSaved(item: SavedUniversityItem): boolean {
  const current = getSavedUniversities();
  const exists = current.some((entry) => entry.key === item.key);
  const next = exists
    ? current.filter((entry) => entry.key !== item.key)
    : [...current, item];
  writeList(SAVED_KEY, next);
  return !exists;
}

export function getCompareList(): SavedUniversityItem[] {
  return readList(COMPARE_KEY);
}

export function isInCompare(key: string): boolean {
  return getCompareList().some((item) => item.key === key);
}

/** Returns "added" | "removed" | "full" (already at MAX_COMPARE and not present). */
export function toggleCompare(item: SavedUniversityItem): "added" | "removed" | "full" {
  const current = getCompareList();
  const exists = current.some((entry) => entry.key === item.key);
  if (exists) {
    writeList(COMPARE_KEY, current.filter((entry) => entry.key !== item.key));
    return "removed";
  }
  if (current.length >= MAX_COMPARE) return "full";
  writeList(COMPARE_KEY, [...current, item]);
  return "added";
}

export function removeFromCompare(key: string) {
  writeList(COMPARE_KEY, getCompareList().filter((entry) => entry.key !== key));
}

export function removeFromSaved(key: string) {
  writeList(SAVED_KEY, getSavedUniversities().filter((entry) => entry.key !== key));
}

export const EXPLORE_COLLECTION_EVENT = "unipath:explore-collection-change";
export const MAX_COMPARE_ITEMS = MAX_COMPARE;
