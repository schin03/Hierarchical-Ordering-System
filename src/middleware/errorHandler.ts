import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import { ValidationError } from "../errors/ValidationError";

export function errorHandler(
	err: unknown,
	req: Request,
	res: Response,
	next: NextFunction
) {
	if (err instanceof BadRequestError) {
		res.status(err.status).json({
			error: err.error,
			params: err.params
		});
		return;
	}

	if (err instanceof NotFoundError) {
		res.status(err.status).json({
			error: err.error,
			message: err.message,
		});
		return;
	}

	if (err instanceof ValidationError) {
		res.status(err.status).json({
			error: err.error,
			fields: err.fields
		});
		return;
	}

	if(err instanceof AppError) {
		res.status(err.status).json({
			error: err.error,
			message: err.message
		});
		return;
	}
}
