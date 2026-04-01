"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MET_ACTIVITIES,
  MET_ACTIVITY_CATEGORY_ORDER,
  type MetActivity,
} from "@/lib/met-activities";

const RECENTLY_USED_LABEL = "Recently Used";

export type RecentActivityItem = {
  name: string;
  metActivity: MetActivity | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Distinct recent activity names (newest first); MET matches carry canonical row */
  recentItems?: RecentActivityItem[];
};

type FlatRow =
  | { kind: "recent"; selectName: string; label: string }
  | { kind: "met"; activity: MetActivity };

function filterRecent(items: RecentActivityItem[], query: string): RecentActivityItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((r) => {
    const label = (r.metActivity?.name ?? r.name).toLowerCase();
    return label.includes(q);
  });
}

function metNamesToExcludeFromCategories(recent: RecentActivityItem[]): Set<string> {
  const s = new Set<string>();
  for (const r of recent) {
    if (r.metActivity) s.add(r.metActivity.name.toLowerCase());
  }
  return s;
}

function groupedFiltered(query: string, excludeNameLower: Set<string>): { category: string; items: MetActivity[] }[] {
  const q = query.trim().toLowerCase();
  const base = MET_ACTIVITIES.filter((a) => !excludeNameLower.has(a.name.toLowerCase()));
  const filtered = !q ? base : base.filter((a) => a.name.toLowerCase().includes(q));
  const byCat: Record<string, MetActivity[]> = {};
  for (const a of filtered) {
    if (!byCat[a.category]) byCat[a.category] = [];
    byCat[a.category].push(a);
  }
  return MET_ACTIVITY_CATEGORY_ORDER.map((category) => ({
    category,
    items: byCat[category] ?? [],
  })).filter((g) => g.items.length > 0);
}

export function MetActivityCombobox({ value, onChange, disabled, recentItems = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasRecentSection = recentItems.length > 0;

  const excludeLower = useMemo(
    () => (hasRecentSection ? metNamesToExcludeFromCategories(recentItems) : new Set<string>()),
    [hasRecentSection, recentItems]
  );

  const recentFiltered = useMemo(
    () => (hasRecentSection ? filterRecent(recentItems, value) : []),
    [hasRecentSection, recentItems, value]
  );

  const grouped = useMemo(() => groupedFiltered(value, excludeLower), [value, excludeLower]);

  const flatRows = useMemo((): FlatRow[] => {
    const recentRows: FlatRow[] = recentFiltered.map((r) => ({
      kind: "recent" as const,
      selectName: r.metActivity?.name ?? r.name,
      label: r.metActivity?.name ?? r.name,
    }));
    const metRows: FlatRow[] = grouped.flatMap((g) =>
      g.items.map((activity) => ({ kind: "met" as const, activity }))
    );
    return [...recentRows, ...metRows];
  }, [recentFiltered, grouped]);

  /** Flat list index for each MET row (for highlight / keyboard), after recent rows */
  const metHighlightIndexByName = useMemo(() => {
    const m = new Map<string, number>();
    let i = recentFiltered.length;
    for (const g of grouped) {
      for (const act of g.items) {
        m.set(act.name, i++);
      }
    }
    return m;
  }, [recentFiltered.length, grouped]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selectActivity = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      setHighlight(-1);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      setHighlight(0);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (flatRows.length === 0 ? -1 : (h + 1) % flatRows.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) =>
        flatRows.length === 0 ? -1 : (h - 1 + flatRows.length) % flatRows.length
      );
    } else if (e.key === "Enter" && highlight >= 0 && highlight < flatRows.length) {
      e.preventDefault();
      const row = flatRows[highlight];
      if (row.kind === "recent") selectActivity(row.selectName);
      else selectActivity(row.activity.name);
    }
  };

  const showEmpty = flatRows.length === 0;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-1">
        <input
          ref={inputRef}
          disabled={disabled}
          className="mt-1 min-w-0 flex-1 rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
          style={{ backgroundColor: "var(--input-bg)" }}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => {
            setOpen(true);
            setHighlight(-1);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search or type a custom activity"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="met-activity-listbox"
          aria-autocomplete="list"
        />
        <button
          type="button"
          disabled={disabled}
          className="mt-1 shrink-0 rounded-lg border border-theme-border px-2 py-2 text-theme-text-muted transition hover:border-theme-accent/60 hover:text-theme-text-primary"
          style={{ backgroundColor: "var(--input-bg)" }}
          aria-label="Toggle activity list"
          onClick={() => {
            setOpen((o) => !o);
            setHighlight(-1);
            if (!open) inputRef.current?.focus();
          }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {open && !disabled && (
        <ul
          id="met-activity-listbox"
          role="listbox"
          className="absolute z-[60] mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-theme-border py-1 shadow-lg"
          style={{ backgroundColor: "var(--surface)" }}
        >
          {showEmpty ? (
            <li className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
              No matches
            </li>
          ) : (
            <>
              {recentFiltered.length > 0 && (
                <li className="list-none">
                  <div
                    className="sticky top-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)", backgroundColor: "var(--surface)" }}
                  >
                    {RECENTLY_USED_LABEL}
                  </div>
                  <ul className="pb-1">
                    {recentFiltered.map((r, flatIdx) => {
                      const label = r.metActivity?.name ?? r.name;
                      const selectName = r.metActivity?.name ?? r.name;
                      const isHi = highlight === flatIdx;
                      return (
                        <li key={`recent:${flatIdx}:${selectName}`} className="list-none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={isHi}
                            className="w-full px-3 py-2 text-left text-sm text-theme-text-primary"
                            style={{
                              backgroundColor: isHi ? "var(--input-bg)" : undefined,
                            }}
                            onMouseEnter={() => setHighlight(flatIdx)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectActivity(selectName)}
                          >
                            {label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              )}
              {grouped.map(({ category, items }) => (
                <li key={category} className="list-none">
                  <div
                    className="sticky top-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)", backgroundColor: "var(--surface)" }}
                  >
                    {category}
                  </div>
                  <ul className="pb-1">
                    {items.map((act) => {
                      const idx = metHighlightIndexByName.get(act.name) ?? -1;
                      const isHi = highlight === idx;
                      return (
                        <li key={act.name} className="list-none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={isHi}
                            className="w-full px-3 py-2 text-left text-sm text-theme-text-primary"
                            style={{
                              backgroundColor: isHi ? "var(--input-bg)" : undefined,
                            }}
                            onMouseEnter={() => setHighlight(idx)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectActivity(act.name)}
                          >
                            {act.name}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
