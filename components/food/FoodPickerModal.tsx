"use client";

import type { Food } from "@/types";
import { FoodSearchPicker } from "./FoodSearchPicker";

export function FoodPickerModal({
  open,
  onClose,
  foods,
  title = "Add food",
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  foods: Food[];
  title?: string;
  onSelect: (f: Food) => void;
}) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-zinc-800 bg-[#0a0a0a] shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <FoodSearchPicker
              foods={foods}
              autoFocus
              onSelect={(f) => {
                onSelect(f);
                onClose();
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
