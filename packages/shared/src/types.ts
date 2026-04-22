export type ServiceStatus = "running" | "deploying" | "stopped" | "failed" | "building" | "queued";

export type DeployStatus =
	| "queued"
	| "building"
	| "pushing"
	| "deploying"
	| "running"
	| "failed"
	| "cancelled"
	| "rolled_back";

export type BuildType = "railpacks" | "dockerfile" | "docker_image";

export type SourceType = "github" | "docker_image" | "compose" | "template";

export type ServiceType = "app" | "database" | "redis" | "worker" | "cron";

export type EnvironmentType = "production" | "staging" | "preview" | "development";

export type DeployTrigger =
	| "git_push"
	| "manual"
	| "cli"
	| "rollback"
	| "pr_preview"
	| "compose"
	| "api";

export type DatabaseType = "postgresql" | "mysql" | "mariadb" | "mongodb" | "redis" | "keydb";

export type NotificationChannelType = "slack" | "discord" | "email" | "telegram" | "webhook";

export type GitProvider = "github" | "gitlab" | "gitea" | "bitbucket";
