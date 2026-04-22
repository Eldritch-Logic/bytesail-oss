<script lang="ts">
import { AlertCircle } from "@lucide/svelte";
import { onDestroy, onMount } from "svelte";
import { browser } from "$app/environment";

type Props = {
	value?: string;
	onchange?: (value: string) => void;
	error?: string | null;
	class?: string;
	height?: string;
};

let {
	value = $bindable(""),
	onchange,
	error = null,
	class: className,
	height = "500px",
}: Props = $props();

let containerEl: HTMLDivElement | undefined = $state();
let editor: import("monaco-editor").editor.IStandaloneCodeEditor | undefined;
let monaco: typeof import("monaco-editor") | undefined;

onMount(async () => {
	if (!browser || !containerEl) return;

	monaco = await import("monaco-editor");

	// Set up YAML-specific token rules for docker-compose highlighting
	monaco.editor.defineTheme("bytesail-dark", {
		base: "vs-dark",
		inherit: true,
		rules: [],
		colors: {
			"editor.background": "#0a0a0a",
			"editor.foreground": "#d4d4d4",
			"editorLineNumber.foreground": "#555555",
			"editorLineNumber.activeForeground": "#888888",
			"editor.lineHighlightBackground": "#111111",
			"editor.selectionBackground": "#264f78",
		},
	});

	// Register docker-compose autocomplete suggestions
	monaco.languages.registerCompletionItemProvider("yaml", {
		provideCompletionItems(model, position) {
			const line = model.getLineContent(position.lineNumber);
			const indent = line.search(/\S/);
			const word = model.getWordUntilPosition(position);
			const range = {
				startLineNumber: position.lineNumber,
				endLineNumber: position.lineNumber,
				startColumn: word.startColumn,
				endColumn: word.endColumn,
			};

			const topLevel = [
				{ label: "services", insertText: "services:\n  ", detail: "Define services" },
				{ label: "volumes", insertText: "volumes:\n  ", detail: "Define named volumes" },
				{ label: "networks", insertText: "networks:\n  ", detail: "Define networks" },
				{ label: "version", insertText: "version: '3.8'", detail: "Compose file version" },
			];

			const serviceKeys = [
				{ label: "image", insertText: "image: ", detail: "Container image" },
				{ label: "build", insertText: "build: .", detail: "Build context" },
				{ label: "ports", insertText: "ports:\n    - ", detail: "Port mappings" },
				{ label: "volumes", insertText: "volumes:\n    - ", detail: "Volume mounts" },
				{ label: "environment", insertText: "environment:\n    ", detail: "Environment variables" },
				{ label: "env_file", insertText: "env_file:\n    - .env", detail: "Env file path" },
				{ label: "depends_on", insertText: "depends_on:\n    - ", detail: "Service dependencies" },
				{ label: "restart", insertText: "restart: unless-stopped", detail: "Restart policy" },
				{ label: "command", insertText: "command: ", detail: "Override command" },
				{ label: "entrypoint", insertText: "entrypoint: ", detail: "Override entrypoint" },
				{
					label: "container_name",
					insertText: "container_name: ",
					detail: "Custom container name",
				},
				{ label: "working_dir", insertText: "working_dir: ", detail: "Working directory" },
				{ label: "expose", insertText: "expose:\n    - ", detail: "Expose ports internally" },
				{
					label: "healthcheck",
					insertText:
						'healthcheck:\n    test: ["CMD", "curl", "-f", "http://localhost"]\n    interval: 30s\n    timeout: 10s\n    retries: 3',
					detail: "Health check config",
				},
				{ label: "deploy", insertText: "deploy:\n    replicas: 1", detail: "Deploy configuration" },
				{ label: "labels", insertText: "labels:\n    - ", detail: "Container labels" },
				{
					label: "logging",
					insertText: "logging:\n    driver: json-file",
					detail: "Logging config",
				},
				{ label: "networks", insertText: "networks:\n    - ", detail: "Attach to networks" },
				{ label: "cap_add", insertText: "cap_add:\n    - ", detail: "Add capabilities" },
				{ label: "cap_drop", insertText: "cap_drop:\n    - ALL", detail: "Drop capabilities" },
				{ label: "privileged", insertText: "privileged: true", detail: "Privileged mode" },
				{ label: "user", insertText: "user: ", detail: "User to run as" },
				{ label: "stdin_open", insertText: "stdin_open: true", detail: "Keep stdin open" },
				{ label: "tty", insertText: "tty: true", detail: "Allocate TTY" },
			];

			const deployKeys = [
				{ label: "replicas", insertText: "replicas: 1", detail: "Number of replicas" },
				{
					label: "resources",
					insertText: "resources:\n      limits:\n        cpus: '0.5'\n        memory: 512M",
					detail: "Resource limits",
				},
				{
					label: "restart_policy",
					insertText: "restart_policy:\n      condition: on-failure",
					detail: "Restart policy",
				},
			];

			const items = indent <= 0 ? topLevel : indent <= 4 ? serviceKeys : deployKeys;

			return {
				suggestions: items.map((item) => ({
					label: item.label,
					kind: monaco!.languages.CompletionItemKind.Property,
					insertText: item.insertText,
					detail: item.detail,
					range,
					insertTextRules: monaco!.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				})),
			};
		},
	});

	editor = monaco.editor.create(containerEl, {
		quickSuggestions: { other: true, strings: true, comments: false },
		value,
		language: "yaml",
		theme: "bytesail-dark",
		minimap: { enabled: false },
		fontSize: 13,
		fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', monospace",
		lineNumbers: "on",
		scrollBeyondLastLine: false,
		wordWrap: "on",
		tabSize: 2,
		insertSpaces: true,
		automaticLayout: true,
		padding: { top: 12, bottom: 12 },
		renderLineHighlight: "line",
		overviewRulerBorder: false,
		hideCursorInOverviewRuler: true,
		scrollbar: {
			verticalScrollbarSize: 8,
			horizontalScrollbarSize: 8,
		},
	});

	editor.onDidChangeModelContent(() => {
		const newValue = editor?.getValue() ?? "";
		value = newValue;
		onchange?.(newValue);
	});
});

$effect(() => {
	if (editor && value !== editor.getValue()) {
		editor.setValue(value);
	}
});

onDestroy(() => {
	editor?.dispose();
});
</script>

<div class="rounded-md border {error ? 'border-destructive' : 'border-border'} overflow-hidden {className ?? ''}">
	<div bind:this={containerEl} style="height: {height}"></div>

	{#if error}
		<div class="flex items-center gap-2 border-t border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
			<AlertCircle class="size-3.5 shrink-0" />
			{error}
		</div>
	{/if}
</div>
