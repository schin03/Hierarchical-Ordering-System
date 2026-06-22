export interface Room {
	id: string;
	building: string;
	number: string;
	seats: number;
	href: string;
	type: string;
	furniture: string;
}

export interface RoomSummary {
	id: string;
	building: string;
	number: string;
	seats: number;
	href: string;
	type: string;
	furniture: string;
}

export interface RoomUpsertInput {
	id: string;
	building: string;
	number: string;
	type: string;
	furniture: string;
	href: string;
	seats: number;
}
