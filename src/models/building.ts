export interface Building {
	id: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	rooms: string[];
}

export interface BuildingSummary {
	id: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
}

export interface BuildingUpsertInput {
	id: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
}
