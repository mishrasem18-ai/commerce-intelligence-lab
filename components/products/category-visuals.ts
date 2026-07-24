import {
  Armchair,
  Backpack,
  BookOpen,
  Cpu,
  Dumbbell,
  Gamepad2,
  Home,
  Shirt,
  Sparkles,
  ToyBrick,
  type LucideIcon,
} from "lucide-react";
import type { ProductCategory } from "@/lib/data/products";

/** Icon + gradient used for category chips and image fallbacks. */
export const CATEGORY_ICON: Record<ProductCategory, LucideIcon> = {
  Electronics: Cpu,
  Fashion: Shirt,
  Home: Home,
  Sports: Dumbbell,
  Books: BookOpen,
  Beauty: Sparkles,
  Furniture: Armchair,
  Accessories: Backpack,
  Gaming: Gamepad2,
  Toys: ToyBrick,
};

/** Subtle two-stop gradients (Tailwind classes) tuned to each category. */
export const CATEGORY_GRADIENT: Record<ProductCategory, string> = {
  Electronics: "from-sky-500/15 to-blue-500/10 text-sky-600 dark:text-sky-400",
  Fashion: "from-rose-500/15 to-pink-500/10 text-rose-600 dark:text-rose-400",
  Home: "from-amber-500/15 to-orange-500/10 text-amber-600 dark:text-amber-400",
  Sports: "from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-400",
  Books: "from-violet-500/15 to-purple-500/10 text-violet-600 dark:text-violet-400",
  Beauty: "from-fuchsia-500/15 to-pink-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  Furniture: "from-stone-500/15 to-amber-500/10 text-stone-600 dark:text-stone-300",
  Accessories: "from-indigo-500/15 to-blue-500/10 text-indigo-600 dark:text-indigo-400",
  Gaming: "from-cyan-500/15 to-sky-500/10 text-cyan-600 dark:text-cyan-400",
  Toys: "from-lime-500/15 to-green-500/10 text-lime-600 dark:text-lime-400",
};
