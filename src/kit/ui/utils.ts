import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { TYPE_TOKENS } from "../tokens";

// Our type scale and our colour palette both live under the `text-` prefix
// (`text-cm-body-small`, `text-cm-primary`). tailwind-merge only knows the
// stock Tailwind scale, so it read every `text-cm-*` as a colour, decided the
// two were in conflict, and dropped the earlier one — silently deleting the
// font size from any className that set a size and a colour together. Naming
// the 16 scale tokens here puts them back in the font-size group, so a size
// and a colour can coexist and only two sizes conflict.
//
// Derived from TYPE_TOKENS so the list cannot drift from the tokens the
// gallery documents. A token missing here fails by vanishing at runtime,
// which is not the kind of failure anyone catches in review.
const typeScale = TYPE_TOKENS.map((t) => t.key.replace("cm.sys.type.", "cm-"));

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: typeScale }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
