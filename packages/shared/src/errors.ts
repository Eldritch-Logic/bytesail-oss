export class NotFoundError extends Error {
	readonly code = "NOT_FOUND" as const;
	constructor(resource: string, id?: string) {
		super(id ? `${resource} not found: ${id}` : `${resource} not found`);
		this.name = "NotFoundError";
	}
}

export class ForbiddenError extends Error {
	readonly code = "FORBIDDEN" as const;
	constructor(message = "You do not have permission to perform this action") {
		super(message);
		this.name = "ForbiddenError";
	}
}

export class ValidationError extends Error {
	readonly code = "VALIDATION_ERROR" as const;
	readonly field?: string;
	constructor(message: string, field?: string) {
		super(message);
		this.name = "ValidationError";
		this.field = field;
	}
}

export class ConflictError extends Error {
	readonly code = "CONFLICT" as const;
	constructor(message: string) {
		super(message);
		this.name = "ConflictError";
	}
}
