import {ValidationError} from "../errors/ValidationError";

type FieldCheck = {
	name: string;
	type: "string" | "number" | "boolean";
	required?: boolean;
}


export function validateFields(body: Record<string, any>, checklist: FieldCheck[], fields?: Record<string, string>) {
	fields = fields || {};

	for (const {name, type, required = true} of checklist) {
		if (!(name in body)) {
			if (required) fields[name] = "required but missing";
		} else if (typeof body[name] !== type) {
			fields[name] = `expected a ${type}`;
		}
	}

	if (Object.keys(fields).length > 0) {
		throw new ValidationError(fields);
	}
}
