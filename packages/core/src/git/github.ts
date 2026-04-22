import { App } from "@octokit/app";

export class GitHubIntegration {
	private app: App;

	constructor(appId: string, privateKey: string) {
		this.app = new App({ appId, privateKey });
	}

	async getInstallationOctokit(installationId: number): ReturnType<App["getInstallationOctokit"]> {
		return this.app.getInstallationOctokit(installationId);
	}

	async listRepos(installationId: number) {
		const octokit = await this.getInstallationOctokit(installationId);
		const { data } = await octokit.request("GET /installation/repositories", {
			per_page: 100,
		});
		return data.repositories;
	}

	async listBranches(installationId: number, owner: string, repo: string) {
		const octokit = await this.getInstallationOctokit(installationId);
		const { data } = await octokit.request("GET /repos/{owner}/{repo}/branches", {
			owner,
			repo,
			per_page: 100,
		});
		return data;
	}

	async getCommit(installationId: number, owner: string, repo: string, sha: string) {
		const octokit = await this.getInstallationOctokit(installationId);
		const { data } = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
			owner,
			repo,
			ref: sha,
		});
		return {
			sha: data.sha,
			message: data.commit.message,
			author: data.commit.author?.name ?? "",
			date: data.commit.author?.date ?? "",
		};
	}

	async createCommitStatus(
		installationId: number,
		params: {
			owner: string;
			repo: string;
			sha: string;
			state: "pending" | "success" | "failure" | "error";
			description: string;
			targetUrl?: string;
		},
	) {
		const octokit = await this.getInstallationOctokit(installationId);
		await octokit.request("POST /repos/{owner}/{repo}/statuses/{sha}", {
			owner: params.owner,
			repo: params.repo,
			sha: params.sha,
			state: params.state,
			description: params.description,
			target_url: params.targetUrl,
			context: "bytesail/deploy",
		});
	}
}
