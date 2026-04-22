import { type ClassValue, clsx } from "clsx";
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// biome-ignore lint/suspicious/noExplicitAny: matches shadcn-svelte component signatures
export type WithElementRef<T extends Record<string, any>> = T & {
	ref?: HTMLElement | null;
};

export type WithoutChildrenOrChild<T> = Omit<T, "children" | "child">;

export type WithChildren<T extends HTMLAttributes<HTMLElement> = HTMLAttributes<HTMLElement>> =
	T & {
		children?: Snippet;
	};

export type WithoutChildren<T> = Omit<T, "children">;

export type WithoutChild<T> = Omit<T, "child">;
