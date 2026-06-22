import { AppError } from "./AppError";

export class ValidationError extends AppError {
	fields: Record<string, string>;

	constructor(fields: Record<string, string>) {
		super(422, "Validation failed");
		this.fields = fields;

		Object.setPrototypeOf(this, new.target.prototype);
	}
}
