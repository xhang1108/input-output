import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Helper to get element position relative to a specific container ancestor
export function getRelativePosition(element: HTMLElement, container: HTMLElement) {
  let x = 0;
  let y = 0;
  let el: HTMLElement | null = element;

  while (el && el !== container) {
    x += el.offsetLeft;
    y += el.offsetTop;
    el = el.offsetParent as HTMLElement;
  }

  return { x, y };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
