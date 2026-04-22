<script lang="ts">
import { onDestroy } from "svelte";

type Props = {
	date: Date | string;
	class?: string;
};

let { date, class: className }: Props = $props();

let now = $state(Date.now());

const interval = setInterval(() => {
	now = Date.now();
}, 30_000);

onDestroy(() => clearInterval(interval));

function format(date: Date | string, now: number): string {
	const ms = now - new Date(date).getTime();
	const seconds = Math.floor(ms / 1000);
	if (seconds < 5) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo ago`;
	const years = Math.floor(days / 365);
	return `${years}y ago`;
}
</script>

<time
	datetime={new Date(date).toISOString()}
	title={new Date(date).toLocaleString()}
	class={className}
>
	{format(date, now)}
</time>
