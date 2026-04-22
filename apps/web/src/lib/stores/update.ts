import { writable } from "svelte/store";

type UpdateInfo = {
	currentVersion: string;
	latestVersion: string;
	releaseNotes: string;
	publishedAt: string;
	htmlUrl: string;
};

type UpdateState = {
	updateAvailable: UpdateInfo | null;
	updateInProgress: boolean;
	updateError: string | null;
	dismissed: boolean;
};

function createUpdateStore() {
	const { subscribe, update, set } = writable<UpdateState>({
		updateAvailable: null,
		updateInProgress: false,
		updateError: null,
		dismissed: false,
	});

	return {
		subscribe,
		setAvailable(info: UpdateInfo) {
			update((s) => ({ ...s, updateAvailable: info, dismissed: false }));
		},
		setInProgress(inProgress: boolean) {
			update((s) => ({ ...s, updateInProgress: inProgress, updateError: null }));
		},
		setError(error: string) {
			update((s) => ({ ...s, updateInProgress: false, updateError: error }));
		},
		setComplete() {
			update((s) => ({
				...s,
				updateAvailable: null,
				updateInProgress: false,
				updateError: null,
			}));
		},
		dismiss() {
			update((s) => ({ ...s, dismissed: true }));
		},
		reset() {
			set({
				updateAvailable: null,
				updateInProgress: false,
				updateError: null,
				dismissed: false,
			});
		},
	};
}

export const updateStore = createUpdateStore();
