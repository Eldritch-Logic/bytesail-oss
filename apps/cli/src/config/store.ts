import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".bytesail");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const CREDENTIALS_FILE = join(CONFIG_DIR, "credentials.json");
const STATE_FILE = ".bytesail/state.json";

function ensureDir() {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
}

type Config = {
	instanceUrl?: string;
	defaultProject?: string;
	defaultService?: string;
};

type Credentials = {
	apiKey?: string;
};

type ProjectState = {
	projectId?: string;
};

export function getConfig(): Config {
	try {
		return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
	} catch {
		return {};
	}
}

export function saveConfig(config: Config): void {
	ensureDir();
	writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getCredentials(): Credentials {
	try {
		return JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
	} catch {
		return {};
	}
}

export function saveCredentials(credentials: Credentials): void {
	ensureDir();
	writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

export function clearCredentials(): void {
	ensureDir();
	writeFileSync(CREDENTIALS_FILE, "{}");
}

export function getProjectState(): ProjectState {
	try {
		return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
	} catch {
		return {};
	}
}

export function saveProjectState(state: ProjectState): void {
	mkdirSync(".bytesail", { recursive: true });
	writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function clearProjectState(): void {
	try {
		writeFileSync(STATE_FILE, "{}");
	} catch {
		// Directory might not exist
	}
}
