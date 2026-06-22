import { AppError } from "./AppError";

export class BadRequestError extends AppError {
	params: Record<string, string>;

	constructor(params: Record<string, string>) {
		super(400, "Invalid request parameters");
		this.params = params;
	}
}
