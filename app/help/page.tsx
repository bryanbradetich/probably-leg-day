"use client";

/* eslint-disable react/no-unescaped-entities */

import { useEffect, useId, useMemo, useRef, useState } from "react";

type HelpItem = {
  id: string;
  title: string;
  content: React.ReactNode;
  searchText: string;
};

type HelpSection = {
  id: string;
  title: string;
  intro?: React.ReactNode;
  items: HelpItem[];
  searchText: string;
};

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function HelpPage() {
  const reactId = useId();
  const [query, setQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string>("section-1");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const sections: HelpSection[] = useMemo(() => {
    const appIntroTitle = "Help & User Guide";
    const appIntroWelcome = "Welcome to Probably Leg Day";
    const appIntroBody =
      "Probably Leg Day is an all-in-one health and fitness app designed to help you track your workouts, monitor your nutrition, manage your weight, and analyze your progress over time. Everything is connected — your weight goal drives your calorie target, your workouts feed your progress charts, and your mesocycles tie it all together into a structured training program.";

    const section1: HelpSection = {
      id: "section-1",
      title: "Section 1 — Getting Started",
      searchText: [
        "Section 1 — Getting Started",
        "Creating Your Account",
        "Setting Up Your Profile",
        "How Everything Connects",
      ].join(" "),
      items: [
        {
          id: "section-1-creating-your-account",
          title: "Creating Your Account",
          searchText:
            "Creating Your Account Sign up with your email and password at the Sign Up page. Choose a unique username — this cannot be changed later. Once signed up you'll be taken to your Dashboard which is your home base for the app.",
          content: (
            <p className="leading-7">
              Sign up with your email and password at the Sign Up page. Choose a unique username — this
              cannot be changed later. Once signed up you'll be taken to your Dashboard which is your
              home base for the app.
            </p>
          ),
        },
        {
          id: "section-1-setting-up-your-profile",
          title: "Setting Up Your Profile",
          searchText:
            "Setting Up Your Profile Before getting the most out of the app, head to your Profile page and fill in Height Date of birth Biological sex Activity level Sedentary Lightly Active Moderately Active Very Active Custom These fields power your TDEE (Total Daily Energy Expenditure) calculation which determines your dynamic daily calorie target.",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                Before getting the most out of the app, head to your Profile page and fill in:
              </p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Height — used to calculate your BMR (Basal Metabolic Rate)</li>
                <li>Date of birth — used to calculate your age for BMR</li>
                <li>Biological sex — used in the Mifflin-St Jeor BMR formula</li>
                <li>
                  Activity level — your baseline daily activity outside of logged exercise. Choose from
                  Sedentary, Lightly Active, Moderately Active, Very Active, or set a Custom multiplier if
                  you want full control.
                </li>
              </ul>
              <p className="leading-7">
                These fields power your TDEE (Total Daily Energy Expenditure) calculation which determines
                your dynamic daily calorie target.
              </p>
            </div>
          ),
        },
        {
          id: "section-1-how-everything-connects",
          title: "How Everything Connects",
          searchText:
            "How Everything Connects Here's the big picture of how the app works together Your weight goal sets a weekly loss/gain rate which calculates a daily calorie deficit or surplus Your TDEE (from your profile) + any extra burns you log = your total daily burn Your calorie target = total daily burn + your deficit/surplus from your weight goal This means on days you burn more (like a heavy tennis session) your calorie target automatically goes up so you don't under-eat Your workout logs feed your progress charts and personal records Grouping workouts into mesocycles lets you see how your strength and volume trended over a training block",
          content: (
            <div className="space-y-3">
              <p className="leading-7">Here's the big picture of how the app works together:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>
                  Your weight goal sets a weekly loss/gain rate which calculates a daily calorie deficit or
                  surplus
                </li>
                <li>Your TDEE (from your profile) + any extra burns you log = your total daily burn</li>
                <li>
                  Your calorie target = total daily burn + your deficit/surplus from your weight goal
                </li>
                <li>
                  This means on days you burn more (like a heavy tennis session) your calorie target
                  automatically goes up so you don't under-eat
                </li>
                <li>Your workout logs feed your progress charts and personal records</li>
                <li>
                  Grouping workouts into mesocycles lets you see how your strength and volume trended over a
                  training block
                </li>
              </ul>
            </div>
          ),
        },
      ],
    };

    const section2: HelpSection = {
      id: "section-2",
      title: "Section 2 — Workouts",
      searchText: [
        "Section 2 — Workouts",
        "The Exercise Library",
        "Creating Workout Templates",
        "Logging a Workout",
        "Removing an Exercise During Logging",
        "Logging Sets Per Side",
        "Editing and Deleting Workouts",
        "Comparing Workouts",
      ].join(" "),
      items: [
        {
          id: "section-2-the-exercise-library",
          title: "The Exercise Library",
          searchText:
            "The Exercise Library contains hundreds of exercises organized by equipment type and muscle group. filter by equipment barbell dumbbell cable machine smith machine bodyweight resistance band kettlebell muscle group exercise type reps/sets timed search bar quickly find any exercise by name Click View see full details View Progress link progress chart Add Exercise custom exercises private public",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                The Exercise Library contains hundreds of exercises organized by equipment type and muscle
                group. You can filter by equipment (barbell, dumbbell, cable, machine, smith machine,
                bodyweight, resistance band, kettlebell), muscle group, and exercise type (reps/sets or
                timed).
              </p>
              <p className="leading-7">
                Use the search bar to quickly find any exercise by name. Click View on any exercise to see
                full details. If you've logged that exercise before, you'll see a "View Progress" link that
                takes you directly to your progress chart for that exercise.
              </p>
              <p className="leading-7">
                You can also add your own custom exercises using the "Add Exercise" button. Custom exercises
                can be kept private or shared publicly with all users.
              </p>
            </div>
          ),
        },
        {
          id: "section-2-creating-workout-templates",
          title: "Creating Workout Templates",
          searchText:
            "Creating Workout Templates Templates are reusable workout plans set up templates Push Day Leg Day A Upper Body To create a template Go to Workouts → Templates → New Template Give it a name optional description Optionally assign it to a day of the week Use the exercise picker search add exercises For each exercise set target sets reps duration rest time Drag reorder Save Templates can be assigned to a mesocycle",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                Templates are reusable workout plans. Before logging workouts it helps to set up templates
                for your regular sessions (e.g. "Push Day", "Leg Day A", "Upper Body").
              </p>
              <p className="leading-7">To create a template:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Go to Workouts → Templates → New Template</li>
                <li>Give it a name and optional description</li>
                <li>Optionally assign it to a day of the week</li>
                <li>Use the exercise picker to search and add exercises</li>
                <li>
                  For each exercise set your target sets, reps (or duration for timed exercises), and rest
                  time
                </li>
                <li>Drag to reorder exercises</li>
                <li>Save the template</li>
              </ul>
              <p className="leading-7">Templates can be assigned to a mesocycle to keep your training organized.</p>
            </div>
          ),
        },
        {
          id: "section-2-logging-a-workout",
          title: "Logging a Workout",
          searchText:
            "Logging a Workout Go to Workouts → Log Workout to start a session Starting a workout Choose Start from template pre-load planned exercises and targets Or Start empty workout build freely Optionally link the workout to an active mesocycle During the workout target from the template last 2-3 sessions reps and weight lbs duration timed exercises optional RPE Rate of Perceived Exertion 1-10 dumbbell cable log per side left right timer rest timer auto-saves draft navigate away browser crashes saved Finishing a workout Tap Finish Workout checks new personal records max weight max reps max volume max duration post-workout summary total duration sets volume new PRs",
          content: (
            <div className="space-y-3">
              <p className="leading-7">Go to Workouts → Log Workout to start a session.</p>
              <p className="leading-7">Starting a workout:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Choose "Start from template" to pre-load your planned exercises and targets</li>
                <li>Or choose "Start empty workout" to build freely as you go</li>
                <li>Optionally link the workout to an active mesocycle</li>
              </ul>
              <p className="leading-7">During the workout:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Each exercise shows your target from the template (e.g. "3 sets × 8 reps")</li>
                <li>
                  Below each exercise name you'll see your last 2-3 sessions for that exercise so you can
                  track progress at a glance
                </li>
                <li>Log each set with reps and weight (in lbs) or duration for timed exercises</li>
                <li>Add an optional RPE (Rate of Perceived Exertion, 1-10) per set</li>
                <li>
                  For dumbbell and cable exercises you can use &quot;Log per side&quot; for separate left and
                  right weights — see Logging Sets Per Side below
                </li>
                <li>A running timer shows how long your workout has been going</li>
                <li>A rest timer appears after each set based on your template's rest target</li>
                <li>
                  Your workout auto-saves as a draft as you go — if you navigate away or your browser crashes
                  your workout is saved and you can pick right up where you left off
                </li>
              </ul>
              <p className="leading-7">Finishing a workout:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Tap "Finish Workout" when done</li>
                <li>
                  The app automatically checks for new personal records (max weight, max reps, max volume,
                  max duration)
                </li>
                <li>A post-workout summary shows your total duration, sets, volume, and any new PRs</li>
              </ul>
            </div>
          ),
        },
        {
          id: "section-2-removing-an-exercise-during-logging",
          title: "Removing an Exercise During Logging",
          searchText:
            "Removing an Exercise During Logging wrong exercise trash icon exercise header confirmation prompt remove exercise deletes all sets current workout",
          content: (
            <p className="leading-7">
              If you accidentally add the wrong exercise during a workout, tap the trash icon in the exercise
              header to remove it. A confirmation prompt will appear. Removing an exercise deletes all its sets
              from the current workout.
            </p>
          ),
        },
        {
          id: "section-2-logging-sets-per-side",
          title: "Logging Sets Per Side (Dumbbell & Cable Exercises)",
          searchText:
            "Logging Sets Per Side dumbbell cable Log per side toggle Left Right weight strength imbalances PR detection higher side workout history L R badge",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                For dumbbell and cable exercises, a &quot;Log per side&quot; toggle appears below the exercise
                name. When enabled, each set shows separate Left and Right weight inputs so you can track any
                strength imbalances between sides. The higher of the two sides is used for PR detection. In
                workout history, sets logged per side show an L or R badge next to the weight.
              </p>
            </div>
          ),
        },
        {
          id: "section-2-editing-and-deleting-workouts",
          title: "Editing and Deleting Workouts",
          searchText:
            "Editing and Deleting Workouts edit completed workout Workouts → History click workout Edit Workout re-opens full logger logged data pre-filled Changes saved completion PRs re-evaluated delete workout History Delete Workout cannot be undone",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                You can edit any completed workout by going to Workouts → History, clicking the workout, and
                tapping "Edit Workout." This re-opens the full logger with your logged data pre-filled.
                Changes are saved on completion and PRs are re-evaluated.
              </p>
              <p className="leading-7">
                To delete a workout, open it from History and tap "Delete Workout." This cannot be undone.
              </p>
            </div>
          ),
        },
        {
          id: "section-2-comparing-workouts",
          title: "Comparing Workouts",
          searchText:
            "Comparing Workouts Workouts → Compare select any two completed workouts side by side comparison shows each exercise sets reps weight difference highlighted green improvements red regressions",
          content: (
            <p className="leading-7">
              Go to Workouts → Compare to select any two completed workouts and see them side by side. The
              comparison shows each exercise, your sets/reps/weight for each session, and the difference —
              highlighted green for improvements and red for regressions.
            </p>
          ),
        },
      ],
    };

    const section3: HelpSection = {
      id: "section-3",
      title: "Section 3 — Mesocycles",
      searchText: [
        "Section 3 — Mesocycles",
        "What is a Mesocycle?",
        "Creating a Mesocycle",
        "Assigning Templates to a Mesocycle",
        "Mesocycle Report",
      ].join(" "),
      items: [
        {
          id: "section-3-what-is-a-mesocycle",
          title: "What is a Mesocycle?",
          searchText:
            "What is a Mesocycle? mesocycle structured training block typically 4-8 weeks start date end date set of workouts training program track progress within a specific block full recap at the end",
          content: (
            <p className="leading-7">
              A mesocycle is a structured training block — typically 4-8 weeks — with a defined start date,
              end date, and set of workouts. Think of it as a training program. Using mesocycles lets you
              track your progress within a specific block and see a full recap at the end.
            </p>
          ),
        },
        {
          id: "section-3-creating-a-mesocycle",
          title: "Creating a Mesocycle",
          searchText:
            "Creating a Mesocycle Go to Mesocycles → New Mesocycle Name Description Start and end dates Status Planned Active Completed Only one mesocycle can be active at a time",
          content: (
            <div className="space-y-3">
              <p className="leading-7">Go to Mesocycles → New Mesocycle and fill in:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Name (e.g. "Summer Strength Block")</li>
                <li>Description (optional)</li>
                <li>Start and end dates</li>
                <li>Status: Planned, Active, or Completed</li>
              </ul>
              <p className="leading-7">Only one mesocycle can be active at a time.</p>
            </div>
          ),
        },
        {
          id: "section-3-assigning-templates-to-a-mesocycle",
          title: "Assigning Templates to a Mesocycle",
          searchText:
            "Assigning Templates to a Mesocycle From the Mesocycle detail page assign existing workout templates create new ones defined weekly structure",
          content: (
            <p className="leading-7">
              From the Mesocycle detail page you can assign existing workout templates to the mesocycle or
              create new ones directly. This gives your mesocycle a defined weekly structure.
            </p>
          ),
        },
        {
          id: "section-3-mesocycle-report",
          title: "Mesocycle Report",
          searchText:
            "Mesocycle Report Once a mesocycle is active or completed tap View Full Report Total workouts volume time trained PRs achieved Weekly volume progression chart progressive overload Per-exercise progression charts estimated 1RM max duration Side-by-side comparison first vs last session % improvement All personal records set during the block",
          content: (
            <div className="space-y-3">
              <p className="leading-7">Once a mesocycle is active or completed, tap "View Full Report" to see:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Total workouts, volume, time trained, and PRs achieved during the block</li>
                <li>Weekly volume progression chart showing if you achieved progressive overload</li>
                <li>Per-exercise progression charts (estimated 1RM or max duration over time)</li>
                <li>
                  Side-by-side comparison of your first vs last session of each template showing % improvement
                </li>
                <li>All personal records set during the block</li>
              </ul>
            </div>
          ),
        },
      ],
    };

    const section4: HelpSection = {
      id: "section-4",
      title: "Section 4 — Food & Nutrition",
      searchText: [
        "Section 4 — Food & Nutrition",
        "Setting Up Your Nutrition Goal",
        "The Food Library",
        "Logging Food",
        "Macro Percentages Per Meal",
        "Default Quantities When Adding Food",
        "Meal Templates",
        "Creating a Meal Template from a Past Log",
        "Weekly Nutrition Summary",
      ].join(" "),
      items: [
        {
          id: "section-4-setting-up-your-nutrition-goal",
          title: "Setting Up Your Nutrition Goal",
          searchText:
            "Setting Up Your Nutrition Goal Food → Today's Log nutrition goal Dynamic mode recommended adjusts automatically based on what you burn that day plus your weight goal deficit high burn days eat more rest days eat less Static mode fixed calorie target macro split protein carbs fat percentage sliders must total 100 grams macro based on calorie target",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                Go to Food → Today's Log and set your nutrition goal. Choose between:
              </p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>
                  Dynamic mode (recommended) — your daily calorie target adjusts automatically based on what
                  you burn that day plus your weight goal deficit. On high burn days you eat more; on rest
                  days you eat less.
                </li>
                <li>Static mode — a fixed calorie target regardless of activity.</li>
              </ul>
              <p className="leading-7">
                Set your macro split using the protein/carbs/fat percentage sliders (must total 100%). The
                app shows you how many grams of each macro that translates to based on your calorie target.
              </p>
            </div>
          ),
        },
        {
          id: "section-4-the-food-library",
          title: "The Food Library",
          searchText:
            "The Food Library personal and public foods Food → Food Library browse search add foods Add Food Enter name brand serving size unit g oz calories protein carbs fat Toggle Public share Save",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                The Food Library contains your personal and public foods. Go to Food → Food Library to browse,
                search, and add foods.
              </p>
              <p className="leading-7">To add a custom food:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Click "Add Food"</li>
                <li>
                  Enter the name, brand (optional), serving size and unit (g or oz), calories, protein, carbs,
                  and fat
                </li>
                <li>Toggle "Public" to share with all users</li>
                <li>Save</li>
              </ul>
            </div>
          ),
        },
        {
          id: "section-4-logging-food",
          title: "Logging Food",
          searchText:
            "Logging Food Food → Today's Log log daily meals organized into 6 meal slots Meal 1 Meal 2 Meal 3 Meal 4 Meal 5 Snacks Add Food button food picker search library Quick Add search bar fast inline adding Add Meal Template log all foods from saved template at once defaults last amount daily summary bar calories consumed vs target remaining calories macro progress bars protein blue carbs yellow fat orange",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                Go to Food → Today's Log to log your daily meals. The page is organized into 6 meal slots: Meal
                1 through Meal 5, plus Snacks.
              </p>
              <p className="leading-7">To add food to a meal:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Use the "Add Food" button to open the food picker and search the library</li>
                <li>Use the Quick Add search bar for fast inline adding</li>
                <li>Use "Add Meal Template" to log all foods from a saved template at once</li>
              </ul>
              <p className="leading-7">
                The daily summary bar at the top shows your calories consumed vs target, remaining calories, and
                macro progress bars (protein in blue, carbs in yellow, fat in orange).
              </p>
            </div>
          ),
        },
        {
          id: "section-4-macro-percentages-per-meal",
          title: "Macro Percentages Per Meal",
          searchText:
            "Macro Percentages Per Meal meal section header grams percentages protein carb fat kcal protein-heavy carb-heavy fat-heavy",
          content: (
            <p className="leading-7">
              Each meal section header shows the macro breakdown in both grams and percentages — for example
              &quot;586 kcal · P 21g (14%) · C 21g (14%) · F 50g (77%)&quot;. This helps you see at a glance
              whether a meal is protein-heavy, carb-heavy, or fat-heavy without doing any math.
            </p>
          ),
        },
        {
          id: "section-4-default-quantities-when-adding-food",
          title: "Default Quantities When Adding Food",
          searchText:
            "Default Quantities When Adding Food quantity field pre-fills last amount logged before daily staples portions consistent",
          content: (
            <p className="leading-7">
              When you add a food you&apos;ve logged before, the quantity field automatically pre-fills with the
              last amount you used for that food. This saves time on daily staples where your portions are
              consistent.
            </p>
          ),
        },
        {
          id: "section-4-meal-templates",
          title: "Meal Templates",
          searchText:
            "Meal Templates Save frequently eaten meals as templates log quickly create template Food → Meal Templates → New Template build manually",
          content: (
            <div className="space-y-3">
              <p className="leading-7">Save frequently eaten meals as templates to log them quickly.</p>
              <p className="leading-7">To create a template manually:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Go to Food → Meal Templates → New Template and build it item by item</li>
              </ul>
              <p className="leading-7">
                You can also turn a past log into a template — see Creating a Meal Template from a Past Log
                below.
              </p>
            </div>
          ),
        },
        {
          id: "section-4-creating-meal-template-from-log",
          title: "Creating a Meal Template from a Past Log",
          searchText:
            "Creating a Meal Template from a Past Log Meal Templates Create from Log date meal slot name save foods quantities template",
          content: (
            <p className="leading-7">
              On the Meal Templates page, click &quot;Create from Log&quot; to turn any past meal into a reusable
              template. Select the date and meal slot, give it a name, and save. All foods and quantities from
              that meal are saved to the template automatically.
            </p>
          ),
        },
        {
          id: "section-4-weekly-nutrition-summary",
          title: "Weekly Nutrition Summary",
          searchText:
            "Weekly Nutrition Summary Food → Weekly Summary daily calories and macros for the week table and chart Days hit calorie target highlighted green over target red",
          content: (
            <p className="leading-7">
              Go to Food → Weekly Summary to see your daily calories and macros for the week in a table and
              chart. Days where you hit your calorie target are highlighted green; days over target are red.
            </p>
          ),
        },
      ],
    };

    const section5: HelpSection = {
      id: "section-5",
      title: "Section 5 — Weight Tracking",
      searchText: [
        "Section 5 — Weight Tracking",
        "Logging Your Weight",
        "Setting a Weight Goal",
        "Weekly Averages",
      ].join(" "),
      items: [
        {
          id: "section-5-logging-your-weight",
          title: "Logging Your Weight",
          searchText:
            "Logging Your Weight Progress → Weight log daily morning weight lbs Save stores internally in kg displays in lbs weigh same time each morning ideally before eating consistent data",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                Go to Progress → Weight to log your daily morning weight. Enter your weight in lbs and tap Save.
                The app stores it internally in kg for future international support but always displays in lbs.
              </p>
              <p className="leading-7">
                Try to weigh yourself at the same time each morning (ideally before eating) for the most
                consistent data.
              </p>
            </div>
          ),
        },
        {
          id: "section-5-setting-a-weight-goal",
          title: "Setting a Weight Goal",
          searchText:
            "Setting a Weight Goal Weight page Set Your Goal Current weight pre-filled Target date Goal weight OR lbs to lose Weekly loss method % of body weight per week fixed lbs per week suggested rate calculates automatically weekly targets running projection on track",
          content: (
            <div className="space-y-3">
              <p className="leading-7">On the Weight page, tap "Set Your Goal" and fill in:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Current weight — pre-filled from your most recent log but editable</li>
                <li>Target date — when you want to reach your goal</li>
                <li>Goal weight OR lbs to lose — enter either one and the other calculates automatically</li>
                <li>
                  Weekly loss method — choose % of body weight per week or fixed lbs per week. The suggested
                  rate calculates automatically from your goal weight and target date.
                </li>
              </ul>
              <p className="leading-7">
                Once set, the app shows your weekly targets, running projection, and whether you're on track.
              </p>
            </div>
          ),
        },
        {
          id: "section-5-weekly-averages",
          title: "Weekly Averages",
          searchText:
            "Weekly Averages weekly summary table spreadsheet week by week averages daily weights Mon-Sun change from previous week target for each week smooths out daily fluctuations",
          content: (
            <p className="leading-7">
              The weight tracking page shows a weekly summary table similar to a spreadsheet — week by week
              averages, daily weights Mon-Sun, change from previous week, and your target for each week. This
              smooths out daily fluctuations so you're not chasing the scale day to day.
            </p>
          ),
        },
      ],
    };

    const section6: HelpSection = {
      id: "section-6",
      title: "Section 6 — Calorie Burn & TDEE",
      searchText: [
        "Section 6 — Calorie Burn & TDEE",
        "Understanding BMR and TDEE",
        "Logging Extra Burns",
        "Editing Calorie Burns",
        "Calorie Burn Estimator",
        "How Dynamic Calorie Targets Work",
      ].join(" "),
      items: [
        {
          id: "section-6-understanding-bmr-and-tdee",
          title: "Understanding BMR and TDEE",
          searchText:
            "Understanding BMR and TDEE BMR Basal Metabolic Rate calories burns at complete rest Mifflin-St Jeor formula weight height age biological sex TDEE Total Daily Energy Expenditure estimated total daily burn baseline activity level TDEE = BMR × activity multiplier Activity multiplier Profile Sedentary 1.2x Lightly Active 1.375x Moderately Active 1.55x Very Active 1.725x Custom",
          content: (
            <div className="space-y-3">
              <p className="leading-7">BMR (Basal Metabolic Rate) — the calories your body burns at complete rest. Calculated using the Mifflin-St Jeor formula based on your weight, height, age, and biological sex.</p>
              <p className="leading-7">TDEE (Total Daily Energy Expenditure) — your estimated total daily burn including your baseline activity level. TDEE = BMR × activity multiplier.</p>
              <p className="leading-7">Activity multiplier — set in your Profile. Sedentary = 1.2x, Lightly Active = 1.375x, Moderately Active = 1.55x, Very Active = 1.725x, or Custom.</p>
            </div>
          ),
        },
        {
          id: "section-6-logging-extra-burns",
          title: "Logging Extra Burns",
          searchText:
            "Logging Extra Burns Calories log specific activity burns on top of your TDEE Log Activity Activity name Duration in minutes optional Calories burned quick-add buttons Walking Running Cycling Swimming HIIT",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                Go to Calories to log specific activity burns on top of your TDEE. Click "Log Activity" and enter:
              </p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Activity name</li>
                <li>Duration in minutes (optional)</li>
                <li>Calories burned</li>
              </ul>
              <p className="leading-7">
                Use the quick-add buttons for common activities like Walking, Running, Cycling, Swimming, and HIIT.
              </p>
            </div>
          ),
        },
        {
          id: "section-6-editing-calorie-burns",
          title: "Editing Calorie Burns",
          searchText:
            "Editing Calorie Burns Edit Delete logged activity update name duration calories walking steps distance dynamic calorie target recalculates saving",
          content: (
            <p className="leading-7">
              Each logged activity has an Edit button alongside the Delete button. Tap Edit to update the
              activity name, duration, or calories burned. This is useful for updating a walking entry throughout
              the day as you accumulate more steps or distance. The dynamic calorie target recalculates
              immediately after saving.
            </p>
          ),
        },
        {
          id: "section-6-calorie-burn-estimator",
          title: "Calorie Burn Estimator",
          searchText:
            "Calorie Burn Estimator searchable activity dropdown MET Calculate Estimate weight kg duration hours custom activity manual calories override recent activities",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                When logging an activity, use the searchable activity dropdown to select from a library of
                common exercises and sports. Once you select an activity and enter a duration, tap
                &quot;Calculate Estimate&quot; to get an estimated calorie burn based on your current weight
                and the activity&apos;s MET (Metabolic Equivalent of Task) value.
              </p>
              <p className="leading-7">
                The formula is: Calories = MET × your weight (kg) × duration (hours)
              </p>
              <p className="leading-7">
                The dropdown shows your 5 most recently logged activities at the top for quick access. If you
                type a custom activity not in the list, you can still log it but must enter calories manually.
              </p>
              <p className="leading-7">
                You can always override the calculated estimate by typing your own value.
              </p>
            </div>
          ),
        },
        {
          id: "section-6-how-dynamic-calorie-targets-work",
          title: "How Dynamic Calorie Targets Work",
          searchText:
            "How Dynamic Calorie Targets Work active weight goal dynamic calorie mode Today's calorie target = TDEE + extra burns logged today + daily deficit from your weight goal Example TDEE 2,400 600 calorie tennis session -500/day deficit Total burn 2,400 + 600 = 3,000 Calorie target 3,000 - 500 = 2,500 eat more on active days stay on track",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                When you have an active weight goal and dynamic calorie mode enabled:
              </p>
              <p className="leading-7">
                Today's calorie target = TDEE + extra burns logged today + daily deficit from your weight goal
              </p>
              <p className="leading-7">
                Example: TDEE is 2,400, you log a 600 calorie tennis session, and your weight goal requires a -500/day deficit:
              </p>
              <div className="space-y-1 rounded-lg border px-4 py-3 text-sm leading-6"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              >
                <div>Total burn = 2,400 + 600 = 3,000</div>
                <div>Calorie target = 3,000 - 500 = 2,500</div>
              </div>
              <p className="leading-7">
                This means you automatically get to eat more on active days while still staying on track for your weight goal.
              </p>
            </div>
          ),
        },
      ],
    };

    const section7: HelpSection = {
      id: "section-7",
      title: "Section 7 — Progress & Reports",
      searchText: [
        "Section 7 — Progress & Reports",
        "Personal Records",
        "Exercise Progress",
        "Body Measurements",
        "Reports",
      ].join(" "),
      items: [
        {
          id: "section-7-personal-records",
          title: "Personal Records",
          searchText:
            "Personal Records Progress → Records personal records grouped by exercise max weight max reps max volume sets × reps × weight max duration timed exercises automatically detected finish workout PR badge workout history",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                Go to Progress → Records to see all your personal records grouped by exercise. Records are tracked for max weight, max reps, max volume (sets × reps × weight in a single session), and max duration for timed exercises.
              </p>
              <p className="leading-7">
                Records are automatically detected when you finish a workout. Any set that beats a previous record is flagged with a PR badge in your workout history.
              </p>
            </div>
          ),
        },
        {
          id: "section-7-exercise-progress",
          title: "Exercise Progress",
          searchText:
            "Exercise Progress View Progress exercise library logged at least once current PRs estimated 1-rep max over time line chart Epley formula volume per session bar chart weight progression over time full set history table",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                Click "View Progress" on any exercise in the library (only visible if you've logged it at least once) to see:
              </p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Your current PRs for that exercise</li>
                <li>Estimated 1-rep max over time (line chart using the Epley formula)</li>
                <li>Volume per session (bar chart)</li>
                <li>Weight progression over time</li>
                <li>Full set history table</li>
              </ul>
            </div>
          ),
        },
        {
          id: "section-7-body-measurements",
          title: "Body Measurements",
          searchText:
            "Body Measurements Progress → Measurements log body measurements weight body fat % chest waist hips bicep thigh display in lbs and inches current stats change from first to latest history table green red deltas",
          content: (
            <p className="leading-7">
              Go to Progress → Measurements to log body measurements over time: weight, body fat %, chest, waist, hips, bicep, and thigh. All measurements display in lbs and inches. The page shows your current stats, change from first to latest measurement, and a history table with green/red deltas.
            </p>
          ),
        },
        {
          id: "section-7-reports",
          title: "Reports",
          searchText:
            "Reports Go to Reports reporting dashboard time range selector last 4 weeks 3 months 6 months all time Total volume lifted per week line chart Workout frequency per week bar chart Bodyweight trend over time Top 5 exercises by volume bar chart Personal records timeline",
          content: (
            <div className="space-y-3">
              <p className="leading-7">
                Go to Reports for a full reporting dashboard with a time range selector (last 4 weeks, 3 months, 6 months, all time):
              </p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Total volume lifted per week (line chart)</li>
                <li>Workout frequency per week (bar chart)</li>
                <li>Bodyweight trend over time</li>
                <li>Top 5 exercises by volume (bar chart)</li>
                <li>Personal records timeline</li>
              </ul>
            </div>
          ),
        },
      ],
    };

    const section8: HelpSection = {
      id: "section-8",
      title: "Section 8 — Settings & Themes",
      searchText: [
        "Section 8 — Settings & Themes",
        "Changing Your Theme",
        "Seattle Mariners",
        "Las Vegas Raiders",
        "Century High School",
        "Winter Outdoors",
        "Summer Outdoors",
        "Rainbow",
        "Year of the Fire Horse",
      ].join(" "),
      items: [
        {
          id: "section-8-changing-your-theme",
          title: "Changing Your Theme",
          searchText:
            "Changing Your Theme Settings → Themes visual themes Dark Bold Cool Purple Light Clean High Contrast NY Mets Oregon Ducks Seattle Mariners Raiders Century Winter Summer Rainbow Fire Horse",
          content: (
            <div className="space-y-3">
              <p className="leading-7">Go to Settings → Themes to choose from these visual themes:</p>
              <ul className="list-disc space-y-1 pl-5 leading-7">
                <li>Dark & Bold — the default dark theme with orange accents</li>
                <li>Dark & Cool — dark theme with blue accents</li>
                <li>Dark & Purple — dark theme with purple accents</li>
                <li>Light & Clean — light white background theme</li>
                <li>High Contrast — pure black and white</li>
                <li>NY Mets — royal blue and orange</li>
                <li>Oregon Ducks — dark green and gold</li>
                <li>Seattle Mariners Classic ⚾ — navy and teal</li>
                <li>Seattle Mariners Retro ⚾ — navy and gold</li>
                <li>Las Vegas Raiders 🏴‍☠️ — black and silver</li>
                <li>Century High School 🦅 — black and teal</li>
                <li>Winter Outdoors ❄️ — midnight blue and icy silver</li>
                <li>Summer Outdoors ☀️ — sandy tan and coral</li>
                <li>Rainbow 🌈 — dark purple and magenta</li>
                <li>Year of the Fire Horse 🐴 — deep red and gold</li>
              </ul>
              <p className="leading-7">Your theme is saved to your account and syncs across devices.</p>
            </div>
          ),
        },
      ],
    };

    const faq: HelpSection = {
      id: "faq",
      title: "FAQ",
      searchText:
        "FAQ Why does my calorie target change every day? Why does my calorie target change throughout the day? How does the calorie burn estimator work? What does Log per side mean dumbbell? How is my estimated 1-rep max calculated? What's the difference between a workout template and a meal template? Can I use the app without setting a weight goal? What does RPE mean? Why does the app store weight in kg but show lbs? Can multiple users share the same account? How do I delete my account?",
      items: [
        {
          id: "faq-calorie-target-changes",
          title: "Why does my calorie target change every day?",
          searchText:
            "Why does my calorie target change every day? If you're using dynamic calorie mode with an active weight goal, your target adjusts based on what you burn that day. Log your activities in the Calories section and your food target updates automatically.",
          content: (
            <p className="leading-7">
              If you're using dynamic calorie mode with an active weight goal, your target adjusts based on what you burn that day. Log your activities in the Calories section and your food target updates automatically.
            </p>
          ),
        },
        {
          id: "faq-calorie-target-throughout-day",
          title: "Why does my calorie target change throughout the day?",
          searchText:
            "Why does my calorie target change throughout the day? dynamic calorie mode log activity burns edit calorie burn target recalculates TDEE extra burns weight goal deficit real time",
          content: (
            <p className="leading-7">
              If you&apos;re in dynamic calorie mode, your target updates in real time as you log activity
              burns. Every time you log or edit a calorie burn, the target recalculates: TDEE + today&apos;s
              extra burns + your weight goal deficit. On high activity days you get a higher calorie budget
              automatically.
            </p>
          ),
        },
        {
          id: "faq-calorie-burn-estimator",
          title: "How does the calorie burn estimator work?",
          searchText:
            "How does the calorie burn estimator work? MET Metabolic Equivalent Task formula Calories MET weight kg duration hours weight log override estimate",
          content: (
            <p className="leading-7">
              The estimator uses MET (Metabolic Equivalent of Task) values — a standard measure of exercise
              intensity. The formula is: Calories = MET × your weight in kg × duration in hours. Your weight
              is pulled from your most recent weight log. The estimate is just that — an estimate. You can
              always override it with your own value.
            </p>
          ),
        },
        {
          id: "faq-log-per-side",
          title: 'What does "Log per side" mean for dumbbell exercises?',
          searchText:
            "What does Log per side mean dumbbell exercises left right arm leg strength imbalance L R weight fields PR stronger side",
          content: (
            <p className="leading-7">
              It means you can log separate weights for your left and right arm (or leg). This is useful if you
              have a strength imbalance and want to track each side independently. When per-side logging is on,
              each set shows L and R weight fields. PRs use the stronger side.
            </p>
          ),
        },
        {
          id: "faq-epley-1rm",
          title: "How is my estimated 1-rep max calculated?",
          searchText:
            "How is my estimated 1-rep max calculated? We use the Epley formula: weight × (1 + reps/30). This is an estimate — actual 1RM may vary.",
          content: (
            <p className="leading-7">
              We use the Epley formula: weight × (1 + reps/30). This is an estimate — actual 1RM may vary.
            </p>
          ),
        },
        {
          id: "faq-template-difference",
          title: "What's the difference between a workout template and a meal template?",
          searchText:
            "What's the difference between a workout template and a meal template? Workout templates are reusable exercise plans you start a workout from. Meal templates are saved combinations of foods you can log all at once to speed up food logging.",
          content: (
            <p className="leading-7">
              Workout templates are reusable exercise plans you start a workout from. Meal templates are saved combinations of foods you can log all at once to speed up food logging.
            </p>
          ),
        },
        {
          id: "faq-without-weight-goal",
          title: "Can I use the app without setting a weight goal?",
          searchText:
            "Can I use the app without setting a weight goal? Yes — the weight goal is optional. Without one, your calorie target will use your static nutrition goal or a manual offset if you're in dynamic mode.",
          content: (
            <p className="leading-7">
              Yes — the weight goal is optional. Without one, your calorie target will use your static nutrition goal or a manual offset if you're in dynamic mode.
            </p>
          ),
        },
        {
          id: "faq-what-is-rpe",
          title: "What does RPE mean?",
          searchText:
            "What does RPE mean? RPE stands for Rate of Perceived Exertion — a scale from 1-10 of how hard a set felt. 10 = maximum effort, 7-8 = challenging but a few reps left in the tank. It's optional but useful for tracking training intensity over time.",
          content: (
            <p className="leading-7">
              RPE stands for Rate of Perceived Exertion — a scale from 1-10 of how hard a set felt. 10 = maximum effort, 7-8 = challenging but a few reps left in the tank. It's optional but useful for tracking training intensity over time.
            </p>
          ),
        },
        {
          id: "faq-kg-vs-lbs",
          title: "Why does the app store weight in kg but show lbs?",
          searchText:
            "Why does the app store weight in kg but show lbs? Storing in kg future-proofs the app for international users. All displays are converted to lbs automatically.",
          content: (
            <p className="leading-7">
              Storing in kg future-proofs the app for international users. All displays are converted to lbs automatically.
            </p>
          ),
        },
        {
          id: "faq-multiple-users",
          title: "Can multiple users share the same account?",
          searchText:
            "Can multiple users share the same account? No — each user should have their own account. All data is private and tied to your user ID.",
          content: (
            <p className="leading-7">
              No — each user should have their own account. All data is private and tied to your user ID.
            </p>
          ),
        },
        {
          id: "faq-delete-account",
          title: "How do I delete my account?",
          searchText:
            "How do I delete my account? Contact support to request account deletion. This will permanently remove all your data.",
          content: (
            <p className="leading-7">
              Contact support to request account deletion. This will permanently remove all your data.
            </p>
          ),
        },
      ],
    };

    const introSection: HelpSection = {
      id: "intro",
      title: appIntroTitle,
      intro: (
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {appIntroTitle}
          </h1>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {appIntroWelcome}
          </h2>
          <p className="leading-7" style={{ color: "var(--text-muted)" }}>
            {appIntroBody}
          </p>
        </div>
      ),
      items: [],
      searchText: [appIntroTitle, appIntroWelcome, appIntroBody].join(" "),
    };

    return [introSection, section1, section2, section3, section4, section5, section6, section7, section8, faq];
  }, []);

  const normalizedQuery = normalizeQuery(query);

  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections
      .map((s) => {
        if (s.id === "intro") {
          const introMatches = s.searchText.toLowerCase().includes(normalizedQuery);
          return introMatches ? s : null;
        }
        const matchingItems = s.items.filter((it) => it.searchText.toLowerCase().includes(normalizedQuery));
        const sectionMatches = s.searchText.toLowerCase().includes(normalizedQuery);
        if (sectionMatches) return s;
        if (matchingItems.length === 0) return null;
        return { ...s, items: matchingItems };
      })
      .filter(Boolean) as HelpSection[];
  }, [normalizedQuery, sections]);

  useEffect(() => {
    const firstVisible = visibleSections.find((s) => s.id !== "intro")?.id ?? "section-1";
    if (!visibleSections.some((s) => s.id === activeSectionId)) {
      setActiveSectionId(firstVisible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSections]);

  useEffect(() => {
    const ids = visibleSections.map((s) => s.id).filter((id) => id !== "intro");
    const els = ids.map((id) => sectionRefs.current[id]).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0));
        const topMost = visible[0];
        const id = (topMost?.target as HTMLElement | undefined)?.dataset?.helpSectionId;
        if (id) setActiveSectionId(id);
      },
      {
        root: null,
        threshold: [0.2, 0.35, 0.5],
        rootMargin: "-20% 0px -65% 0px",
      },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleSections]);

  const tocSections = visibleSections.filter((s) => s.id !== "intro");

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)]"
      style={{
        background: "var(--bg)",
        color: "var(--text-primary)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr] md:gap-8">
          <aside className="hidden md:block">
            <div
              className="sticky top-20 rounded-xl border p-4"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
              }}
            >
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Contents
              </div>
              <nav className="space-y-1">
                {tocSections.map((s) => {
                  const isActive = s.id === activeSectionId;
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className={cx(
                        "block rounded-lg px-3 py-2 text-sm transition",
                        isActive && "font-medium",
                      )}
                      style={{
                        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                        background: isActive ? "var(--bg)" : "transparent",
                        border: isActive ? `1px solid var(--border)` : "1px solid transparent",
                      }}
                    >
                      {s.title}
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="min-w-0">
            <div
              className="mb-6 rounded-xl border p-4"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
              }}
            >
              <label htmlFor={`${reactId}-help-search`} className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Search
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id={`${reactId}-help-search`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search help topics…"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg)",
                    color: "var(--text-primary)",
                    boxShadow: "none",
                    caretColor: "var(--accent)",
                  }}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="shrink-0 rounded-lg border px-3 py-2 text-sm transition"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--bg)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                Filtering sections by keyword.
              </div>
            </div>

            <div className="space-y-6">
              {visibleSections.map((section) => {
                if (section.id === "intro") {
                  return (
                    <section
                      key={section.id}
                      className="rounded-xl border p-5"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--surface)",
                      }}
                    >
                      {section.intro}
                    </section>
                  );
                }

                return (
                  <section
                    key={section.id}
                    id={section.id}
                    ref={(el) => {
                      sectionRefs.current[section.id] = el;
                    }}
                    data-help-section-id={section.id}
                    className="scroll-mt-24 rounded-xl border p-5"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                        {section.title}
                      </h2>
                      <a
                        href={`#${section.id}`}
                        className="text-xs underline-offset-4 hover:underline"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Link
                      </a>
                    </div>

                    <div className="space-y-3">
                      {section.items.map((item) => (
                        <details
                          key={item.id}
                          className="group rounded-lg border"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--bg)",
                          }}
                        >
                          <summary
                            className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            <span>{item.title}</span>
                            <span
                              className="select-none text-xs transition group-open:rotate-180"
                              style={{ color: "var(--text-muted)" }}
                              aria-hidden
                            >
                              ▾
                            </span>
                          </summary>
                          <div
                            className="border-t px-4 py-4 text-sm"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {item.content}
                          </div>
                        </details>
                      ))}
                      {section.items.length === 0 ? (
                        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                          No matching topics in this section.
                        </div>
                      ) : null}
                    </div>
                  </section>
                );
              })}

              {visibleSections.length === 0 ? (
                <div
                  className="rounded-xl border p-5 text-sm"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-muted)",
                  }}
                >
                  No results. Try a different keyword.
                </div>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

