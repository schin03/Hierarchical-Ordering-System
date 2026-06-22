export class AppError extends Error {

	status: number;
	error: string;

	constructor(status: number, error: string, message?: string) {
		super(message);
		this.status = status;
		this.error = error;

		Object.setPrototypeOf(this, new.target.prototype);
		Error.captureStackTrace(this, this.constructor);

	}

}
