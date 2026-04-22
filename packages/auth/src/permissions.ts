export const permissions = {
	org: {
		all: "org:*",
	},
	project: {
		all: "project:*",
		read: "project:read",
		create: "project:create",
		update: "project:update",
		delete: "project:delete",
	},
	service: {
		all: "service:*",
		read: "service:read",
		create: "service:create",
		update: "service:update",
		delete: "service:delete",
	},
	deploy: {
		all: "deploy:*",
		read: "deploy:read",
		create: "deploy:create",
	},
	settings: {
		all: "settings:*",
		read: "settings:read",
	},
} as const;

export type Permission = (typeof flatPermissions)[number];

const flatPermissions = [
	permissions.org.all,
	permissions.project.all,
	permissions.project.read,
	permissions.project.create,
	permissions.project.update,
	permissions.project.delete,
	permissions.service.all,
	permissions.service.read,
	permissions.service.create,
	permissions.service.update,
	permissions.service.delete,
	permissions.deploy.all,
	permissions.deploy.read,
	permissions.deploy.create,
	permissions.settings.all,
	permissions.settings.read,
] as const;
