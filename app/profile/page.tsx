"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { kgToLbs } from "@/lib/units";
import { localISODate } from "@/lib/weight-helpers";
import type { ActivityLevel, BiologicalSex, DailyWeight, ProfileCalorieFields } from "@/types";
import {
  ACTIVITY_LEVEL_OPTIONS,
  activityLevelLabel,
  activityMultiplier,
  ageOnDate,
  computeBmrTdeeForDate,
  heightCmToFtIn,
  heightFtInToCm,
  profileBmrFieldsComplete,
} from "@/lib/calorie-helpers";
import { formatKcal } from "@/lib/food-helpers";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | "">("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("sedentary");
  const [customMultiplier, setCustomMultiplier] = useState("");
  const [weights, setWeights] = useState<DailyWeight[]>([]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        router.replace("/auth/login");
        setLoading(false);
        return;
      }
      setUser(u);

      const { data: profile } = await supabase
        .from("profiles")
        .select("height_cm, date_of_birth, biological_sex, activity_level, custom_activity_multiplier")
        .eq("id", u.id)
        .maybeSingle();

      const p = profile as Partial<ProfileCalorieFields> | null;
      if (p?.height_cm != null && Number(p.height_cm) > 0) {
        const { feet: f, inches: i } = heightCmToFtIn(Number(p.height_cm));
        setFeet(String(f));
        setInches(String(i));
      }
      if (p?.date_of_birth) setDateOfBirth(p.date_of_birth);
      if (p?.biological_sex === "male" || p?.biological_sex === "female") {
        setBiologicalSex(p.biological_sex);
      }
      if (p?.activity_level) setActivityLevel(p.activity_level as ActivityLevel);
      if (p?.custom_activity_multiplier != null) {
        setCustomMultiplier(String(p.custom_activity_multiplier));
      }

      const { data: dw } = await supabase
        .from("daily_weights")
        .select("*")
        .eq("user_id", u.id)
        .order("logged_date", { ascending: false })
        .limit(400);
      setWeights((dw ?? []) as DailyWeight[]);

      setLoading(false);
    })();
  }, [router]);

  const profileDraft: ProfileCalorieFields | null = useMemo(() => {
    if (!user) return null;
    const f = parseInt(feet, 10);
    const inch = parseFloat(inches);
    const cm = Number.isFinite(f) && Number.isFinite(inch) ? heightFtInToCm(f, inch) : 0;
    const custom =
      activityLevel === "custom" && customMultiplier.trim() !== ""
        ? parseFloat(customMultiplier)
        : null;
    return {
      id: user.id,
      height_cm: cm > 0 ? cm : null,
      date_of_birth: dateOfBirth || null,
      biological_sex: biologicalSex === "" ? null : biologicalSex,
      activity_level: activityLevel,
      custom_activity_multiplier: custom,
    };
  }, [user, feet, inches, dateOfBirth, biologicalSex, activityLevel, customMultiplier]);

  const today = localISODate();
  const bmrPreview = useMemo(() => {
    if (!profileDraft || !profileBmrFieldsComplete(profileDraft)) return null;
    return computeBmrTdeeForDate(profileDraft, weights, today);
  }, [profileDraft, weights, today]);

  const ageToday =
    dateOfBirth && today ? ageOnDate(dateOfBirth, today) : null;

  const save = async () => {
    if (!user || !profileDraft) return;
    setErr(null);
    setSavedOk(false);
    const f = parseInt(feet, 10);
    const inch = parseFloat(inches);
    if (!Number.isFinite(f) || f < 0) {
      setErr("Enter a valid height (feet).");
      return;
    }
    if (!Number.isFinite(inch) || inch < 0 || inch >= 12) {
      setErr("Inches must be between 0 and less than 12.");
      return;
    }
    const cm = heightFtInToCm(f, inch);
    if (cm <= 0) {
      setErr("Enter a valid height.");
      return;
    }
    if (!dateOfBirth) {
      setErr("Select your date of birth.");
      return;
    }
    if (biologicalSex !== "male" && biologicalSex !== "female") {
      setErr("Select biological sex for the BMR formula.");
      return;
    }
    if (activityLevel === "custom") {
      const m = parseFloat(customMultiplier);
      if (!Number.isFinite(m) || m <= 0) {
        setErr("Enter a positive custom activity multiplier.");
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("profiles")
      .update({
        height_cm: cm,
        date_of_birth: dateOfBirth,
        biological_sex: biologicalSex,
        activity_level: activityLevel,
        custom_activity_multiplier: activityLevel === "custom" ? parseFloat(customMultiplier) : null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (e) {
      setErr(e.message);
      return;
    }
    setSavedOk(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center text-theme-text-muted">
        Loading…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const mult = profileDraft ? activityMultiplier(profileDraft) : 1.2;
  const multLabel = activityLevelLabel(activityLevel);

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Profile"
          description={`Signed in as ${user.email ?? "—"}`}
        />

        <section
          className="mt-8 rounded-xl border border-theme-border p-5 sm:p-6"
          style={{ backgroundColor: "var(--surface)" }}
        >
          <h2 className="text-lg font-semibold text-theme-text-primary">Energy &amp; BMR</h2>
          <p className="mt-1 text-sm text-theme-text-muted">
            We use the Mifflin–St Jeor equation with your weight from the most recent entry on or before today in your{" "}
            <Link href="/weight" className="font-medium text-theme-accent hover:underline">
              weight log
            </Link>
            .
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-theme-text-muted">Height</label>
              <div className="mt-1 flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
                    style={{ backgroundColor: "var(--input-bg)" }}
                    value={feet}
                    onChange={(e) => setFeet(e.target.value)}
                    placeholder="5"
                  />
                  <span className="mt-0.5 block text-xs text-theme-text-muted">Feet</span>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    max={11.99}
                    step={0.1}
                    className="w-full rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
                    style={{ backgroundColor: "var(--input-bg)" }}
                    value={inches}
                    onChange={(e) => setInches(e.target.value)}
                    placeholder="10"
                  />
                  <span className="mt-0.5 block text-xs text-theme-text-muted">Inches</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-theme-text-muted">Stored in centimeters (1 in = 2.54 cm).</p>
            </div>
            <div>
              <label className="text-sm font-medium text-theme-text-muted">Date of birth</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
                style={{ backgroundColor: "var(--input-bg)" }}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
              {ageToday != null && (
                <p className="mt-1 text-xs text-theme-text-muted">Age used for BMR today: {ageToday} years</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <span className="text-sm font-medium text-theme-text-muted">Biological sex</span>
            <p className="mt-1 text-xs text-theme-text-muted">
              Used only for the BMR formula (male vs female equations). Choose the option that best matches your physiology.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["male", "female"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBiologicalSex(s)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    biologicalSex === s
                      ? "border-theme-accent bg-theme-accent/15 text-theme-text-primary"
                      : "border-theme-border text-theme-text-muted hover:border-theme-accent/50 hover:text-theme-text-primary"
                  }`}
                  style={{ backgroundColor: biologicalSex === s ? undefined : "var(--input-bg)" }}
                >
                  {s === "male" ? "Male" : "Female"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-theme-text-muted">Activity level</label>
            <div className="mt-2 space-y-2">
              {ACTIVITY_LEVEL_OPTIONS.filter((o) => o.id !== "custom").map((o) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    activityLevel === o.id ? "border-theme-accent bg-theme-accent/10" : "border-theme-border hover:border-theme-border/80"
                  }`}
                  style={{ backgroundColor: activityLevel === o.id ? undefined : "var(--input-bg)" }}
                >
                  <input
                    type="radio"
                    name="activity"
                    className="mt-1"
                    checked={activityLevel === o.id}
                    onChange={() => setActivityLevel(o.id)}
                  />
                  <span>
                    <span className="font-medium text-theme-text-primary">{o.label}</span>
                    <span className="text-theme-text-muted"> — {o.description}</span>
                    <span className="block text-xs text-theme-text-muted">Multiplier: {o.multiplier}×</span>
                  </span>
                </label>
              ))}
              <label
                className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition ${
                  activityLevel === "custom" ? "border-theme-accent bg-theme-accent/10" : "border-theme-border hover:border-theme-border/80"
                }`}
                style={{ backgroundColor: activityLevel === "custom" ? undefined : "var(--input-bg)" }}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="activity"
                    className="mt-1"
                    checked={activityLevel === "custom"}
                    onChange={() => setActivityLevel("custom")}
                  />
                  <span className="font-medium text-theme-text-primary">Custom</span>
                </span>
                {activityLevel === "custom" && (
                  <div className="pl-7">
                    <input
                      type="number"
                      min={0.5}
                      max={3}
                      step={0.025}
                      className="w-full max-w-[200px] rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary sm:w-auto"
                      style={{ backgroundColor: "var(--bg)" }}
                      value={customMultiplier}
                      onChange={(e) => setCustomMultiplier(e.target.value)}
                      placeholder="1.55"
                    />
                    <p className="mt-1 text-xs text-theme-text-muted">Your own NEAT multiplier (typical range ~1.2–1.9).</p>
                  </div>
                )}
              </label>
            </div>
            <p className="mt-3 text-sm text-theme-text-muted">
              This is your baseline activity multiplier. You can log specific exercise burns separately for more precise tracking.
            </p>
          </div>

          {err && (
            <p className="mt-4 rounded-lg border border-theme-border bg-theme-danger/10 px-3 py-2 text-sm text-theme-danger">
              {err}
            </p>
          )}
          {savedOk && (
            <p className="mt-4 text-sm text-theme-success">Profile saved.</p>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="mt-6 rounded-lg bg-theme-accent px-5 py-2.5 text-sm font-semibold text-theme-on-accent transition hover:bg-theme-accent-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>

          {bmrPreview && (
            <div
              className="mt-8 rounded-lg border border-theme-border p-4"
              style={{ backgroundColor: "var(--bg)" }}
            >
              <h3 className="text-sm font-semibold text-theme-text-primary">Estimated today</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-theme-text-muted">BMR</dt>
                  <dd className="font-medium tabular-nums text-theme-text-primary">{formatKcal(bmrPreview.bmr)} kcal/day</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-theme-text-muted">Activity multiplier</dt>
                  <dd className="font-medium text-theme-text-primary">
                    {mult}× ({multLabel})
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-theme-text-muted">TDEE (no extra logged burns)</dt>
                  <dd className="font-semibold tabular-nums text-theme-accent">{formatKcal(bmrPreview.tdee)} kcal/day</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-theme-text-muted">
                Weight used: {kgToLbs(bmrPreview.weightKg)?.toFixed(1) ?? "—"} lbs (log date {bmrPreview.weightLoggedDate}).
              </p>
            </div>
          )}

          {profileDraft && profileBmrFieldsComplete(profileDraft) && !bmrPreview && (
            <p className="mt-6 text-sm text-theme-text-muted">
              Add at least one weight entry on or before today to calculate BMR and TDEE.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
