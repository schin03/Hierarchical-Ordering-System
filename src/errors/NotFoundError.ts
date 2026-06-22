import { AppError } from "./AppError";

export class NotFoundError extends AppError {
	constructor(message: string) {
		super(404, "Not found", message);
	}
}
