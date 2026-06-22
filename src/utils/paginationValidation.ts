import { BadRequestError } from "../errors/BadRequestError";

export class PaginationValidator {

	static parse(limitQuery: any, offsetQuery: any) {

		const limit = limitQuery !== undefined ? Number(limitQuery) : 100;
		const offset = offsetQuery !== undefined ? Number(offsetQuery) : 0;

		const params : Record<string, string> = {};

		if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
			params.limit = "expected an integer between 1 and 5000";
		}
		if (!Number.isInteger(offset) || offset < 0) {
			params.offset = "expected an integer >= 0";
		}

		if (Object.keys(params).length > 0) {
			throw new BadRequestError(params);
		}
		return {limit, offset};
	}

}
