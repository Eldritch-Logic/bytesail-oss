import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function cloneRepo(
	url: string,
	branch: string,
	targetDir: string,
	token?: string,
): Promise<void> {
	const cloneUrl = token ? url.replace("https://", `https://x-access-token:${token}@`) : url;

	await exec("git", [
		"clone",
		"--depth",
		"1",
		"--branch",
		branch,
		"--single-branch",
		cloneUrl,
		targetDir,
	]);
}

export async function checkoutCommit(dir: string, sha: string): Promise<void> {
	await exec("git", ["fetch", "--depth", "1", "origin", sha], { cwd: dir });
	await exec("git", ["checkout", sha], { cwd: dir });
}
