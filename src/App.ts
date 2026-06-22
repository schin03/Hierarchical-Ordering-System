import fs from "fs/promises";
import express from "express";
import cors from "cors";
import { unescape } from "querystring";
import multer from "multer";
import JSZip from "jszip";
import { totalmem } from "os";
import parse5 from "parse5";
import Decimal from "decimal.js";
import type { Building } from "./models/building";
import type { Room } from "./models/room";
import { createDatasetsRouter } from "./routes/datasetsRoutes";
import { createSearchRouter } from "./routes/searchRoutes";
import { createCourseRouter } from "./routes/courseRoutes";
import { createBuildingRouter } from "./routes/buildingRoutes";

import { errorHandler } from "./middleware/errorHandler";
import { NotFoundError } from "./errors/NotFoundError";
import { PaginationValidator } from "./utils/paginationValidation";
import { BadRequestError } from "./errors/BadRequestError";
import { validateFields } from "./utils/validateFields";


/**
 * Express application.
 */
export type Application = ReturnType<typeof express>;

/**
 * Configuration options for the application.
 */
export type AppConfig = {
	/**
	 * The directory where application data will be stored enabling the application to persist data between restarts.
	 *
	 * @internal
	 * During autograding, the directory will be deleted as a means to reset the application data between tests.
	 */
	readonly datadir: string;
};

// parse5 node type alias (using any since parse5 v8 types are complex)
type P5Node = any;

/** Building info extracted from index.htm */
export interface BuildingInfo {
	fullname: string;
	shortname: string;
	address: string;
	link: string;
}

/** Room info extracted from a building HTML file */
export interface RoomInfo {
	number: string;
	seats: number;
	furniture: string;
	type: string;
	href: string;
}

/** Get CSS classes from a parse5 element node's attrs */
export function getNodeClasses(node: P5Node): string[] {
	if (!node?.attrs) return [];
	const cls = node.attrs.find((a: any) => a.name === "class");
	return cls ? cls.value.split(/\s+/).filter(Boolean) : [];
}

/** Recursively find all nodes with a given tag name */
export function findAllNodes(node: P5Node, tagName: string): P5Node[] {
	const results: P5Node[] = [];
	if (node.nodeName === tagName) results.push(node);
	for (const child of node.childNodes ?? []) {
		results.push(...findAllNodes(child, tagName));
	}
	return results;
}

/** Find the first <table> with the given CSS class */
export function findTableByClass(doc: P5Node, className: string): P5Node | null {
	const tables = findAllNodes(doc, "table");
	return tables.find((t) => getNodeClasses(t).includes(className)) ?? null;
}

/** Get all text content of a node recursively */
export function getTextContent(node: P5Node): string {
	if (node.nodeName === "#text") return node.value ?? "";
	return (node.childNodes ?? []).map(getTextContent).join("");
}

/** Find first descendant element with the given tag name */
export function findFirstDescendant(node: P5Node, tagName: string): P5Node | null {
	for (const child of node.childNodes ?? []) {
		if (child.nodeName === tagName) return child;
		const found = findFirstDescendant(child, tagName);
		if (found) return found;
	}
	return null;
}

/** Get href attribute value from a node */
export function getHref(node: P5Node): string | null {
	const attr = (node.attrs ?? []).find((a: any) => a.name === "href");
	return attr ? attr.value : null;
}

/** Find the <td> in a <tr> that has the given CSS class */
export function getCellByClass(row: P5Node, className: string): P5Node | null {
	const tds = (row.childNodes ?? []).filter((n: P5Node) => n.nodeName === "td");
	return tds.find((td: P5Node) => getNodeClasses(td).includes(className)) ?? null;
}

/**
 * Parse index.htm content and return extracted building info rows.
 * Returns empty array when no views-table is found.
 */
export function parseBuildingIndex(htmlContent: string): BuildingInfo[] {
	const doc = parse5.parse(htmlContent);
	const table = findTableByClass(doc, "views-table");
	if (!table) return [];

	const buildings: BuildingInfo[] = [];
	for (const row of findAllNodes(table, "tr")) {
		const titleCell = getCellByClass(row, "views-field-title");
		const codeCell = getCellByClass(row, "views-field-field-building-code");
		const addressCell = getCellByClass(row, "views-field-field-building-address");
		if (!titleCell || !codeCell || !addressCell) continue;

		const linkEl = findFirstDescendant(titleCell, "a");
		if (!linkEl) continue;

		const href = getHref(linkEl);
		if (!href) continue;

		const fullname = getTextContent(linkEl).trim();
		const shortname = getTextContent(codeCell).trim();
		const address = getTextContent(addressCell).trim();
		if (!fullname || !shortname || !address) continue;

		buildings.push({
			fullname,
			shortname,
			address,
			link: href,
		});
	}
	return buildings;
}

/**
 * Parse a building HTML file and return extracted room info rows.
 * Returns empty array when no views-table is found.
 */
export function parseRoomTable(htmlContent: string): RoomInfo[] {
	const doc = parse5.parse(htmlContent);
	const table = findTableByClass(doc, "views-table");
	if (!table) return [];

	const rooms: RoomInfo[] = [];
	for (const row of findAllNodes(table, "tr")) {
		const numberCell = getCellByClass(row, "views-field-field-room-number");
		const capacityCell = getCellByClass(row, "views-field-field-room-capacity");
		const furnitureCell = getCellByClass(row, "views-field-field-room-furniture");
		const typeCell = getCellByClass(row, "views-field-field-room-type");
		const nothingCell = getCellByClass(row, "views-field-nothing");
		if (!numberCell || !capacityCell || !furnitureCell || !typeCell || !nothingCell) continue;

		const numberLink = findFirstDescendant(numberCell, "a");
		if (!numberLink) continue;
		const nothingLink = findFirstDescendant(nothingCell, "a");
		if (!nothingLink) continue;
		const href = getHref(nothingLink) ?? "";

		const seats = parseInt(getTextContent(capacityCell).trim(), 10);
		if (!Number.isFinite(seats) || seats < 0) continue;

		rooms.push({
			number: getTextContent(numberLink).trim(),
			seats,
			furniture: getTextContent(furnitureCell).trim(),
			type: getTextContent(typeCell).trim(),
			href,
		});
	}
	return rooms;
}

/**
 * Initializes the application.
 */
export async function createApp(config: AppConfig): Promise<Application> {
	const app = express();

	const { datadir } = config;

	// Ensure the data directory exists
	await fs.mkdir(datadir, { recursive: true });

	class Model {
		private path: string;
		private data: {
			courses: Course[];
			sections: Section[];
			buildings: Building[];
			rooms: Room[];
		} = {
				courses: [],
				sections: [],
				buildings: [],
				rooms: [],
			};

		constructor(datadir: string) {
			this.path = `${datadir}/model.json`;
		}

		async load() {
			try {
				const raw = await fs.readFile(this.path, "utf-8");
				this.data = JSON.parse(raw);
				for (const course of this.data.courses) {
					if (!Array.isArray(course.sections)) {
						course.sections = [];
					}
				}
				if (!Array.isArray(this.data.buildings)) {
					this.data.buildings = [];
				}
				if (!Array.isArray(this.data.rooms)) {
					this.data.rooms = [];
				}
			} catch (err: any) {
				if (err.code !== "ENOENT") throw err;
				this.data = { courses: [], sections: [], buildings: [], rooms: [] };
			}
		}

		private async save() {
			await fs.mkdir(datadir, { recursive: true });
			await fs.writeFile(this.path, JSON.stringify(this.data, null, 2));
		}

		// perform search on data and apply filters
		async search(query: any, kind: string) {
			// Validate query structure
			if (!query.WHERE) throw new Error("Missing WHERE");
			if (!query.OPTIONS) throw new Error("Missing OPTIONS");
			if (!query.OPTIONS.COLUMNS) throw new Error("Missing COLUMNS");
			if (typeof query.WHERE !== "object" || Array.isArray(query.WHERE) || Object.keys(query.WHERE).length > 1) {
				throw new Error("WHERE must be an object with at most one FILTER");
			}
			if (
				typeof query.OPTIONS !== "object" ||
				Array.isArray(query.OPTIONS) ||
				!Array.isArray(query.OPTIONS.COLUMNS) ||
				query.OPTIONS.COLUMNS.length === 0 ||
				Object.keys(query.OPTIONS).some((k) => k !== "COLUMNS" && k !== "ORDER")
			) {
				throw new Error("OPTIONS must be an object with COLUMNS and optional ORDER");
			}

			const mfields = kind === "course_offerings" ? ["avg", "pass", "fail", "audit", "year"] : ["lat", "lon", "seats"];

			const sfields =
				kind === "course_offerings"
					? ["title", "dept", "code", "instructor"]
					: ["name", "building", "address", "number", "type", "furniture", "href"];
			const validKeys = new Set([...mfields, ...sfields]);

			const courseKeys = new Set(["avg", "pass", "fail", "audit", "year", "title", "dept", "code", "instructor"]);
			const facilitiesKeys = new Set([
				"lat",
				"lon",
				"seats",
				"name",
				"building",
				"address",
				"number",
				"type",
				"furniture",
				"href",
			]);

			// Validate COLUMNS are valid keys
			if (!query.TRANSFORMATIONS) {
				for (const col of query.OPTIONS.COLUMNS) {
					if (!mfields.includes(col) && !sfields.includes(col)) {
						throw new Error("Unknown key in COLUMNS");
					}
					if (
						(kind === "course_offerings" && !courseKeys.has(col)) ||
						(kind === "facilities" && !facilitiesKeys.has(col))
					)
						throw new Error("Cannot mix course_offerings and facilities fields in one query");
				}
			}

			if (query.OPTIONS.ORDER !== undefined) {
				const order = query.OPTIONS.ORDER;
				if (typeof order === "string") {
					if (!query.OPTIONS.COLUMNS.includes(order)) throw new Error("ORDER must be a key in COLUMNS");
				} else if (typeof order === "object" && order !== null && !Array.isArray(order)) {
					if (order.dir !== "UP" && order.dir !== "DOWN") {
						throw new Error("Invalid sort direction (must be UP or DOWN)");
					}
					if (!Array.isArray(order.keys) || order.keys.length === 0) {
						throw new Error("All ORDER keys must be in COLUMNS");
					}
					if (!order.keys.every((key: string) => query.OPTIONS.COLUMNS.includes(key))) {
						throw new Error("All ORDER keys must be in COLUMNS");
					}
				} else {
					throw new Error("OPTIONS must be an object with COLUMNS and optional ORDER");
				}
			}

			this.validateFilter(query.WHERE, kind, mfields, sfields, courseKeys, facilitiesKeys);

			// Build search data: enrich sections with course data, and include courses as offerings
			const searchData: any[] = [];

			// filter for course/section search
			if (kind == "course_offerings") {
				// Add enriched sections
				for (const section of this.data.sections) {
					const parentCourse = this.data.courses.find((c) => c.sections.includes(section.id));
					if (parentCourse) {
						searchData.push({
							...section,
							dept: parentCourse.dept,
							code: parentCourse.code,
							title: parentCourse.title,
						});
					}
				}
			}

			// if not course_offerings, search for facilities filter
			else {
				for (const room of this.data.rooms) {
					const parentBuilding = this.data.buildings.find((c) => c.rooms.includes(room.id));
					if (parentBuilding) {
						searchData.push({
							...room,
							name: parentBuilding.name,
							address: parentBuilding.address,
							lat: parentBuilding.lat,
							lon: parentBuilding.lon,
						});
					}
				}
			}

			let filteredData = this.applyWhere(searchData, query.WHERE);
			// if TRANSFORMATIONS is present, apply transformations - maintains v1 imp while adding v2 features
			if (!query.TRANSFORMATIONS) {
				filteredData = this.applyColumns(filteredData, query.OPTIONS.COLUMNS);
			} else {
				// handle missing transformation params
				if (!query.TRANSFORMATIONS.GROUP) throw new Error("Missing GROUP in TRANSFORMATIONS");
				if (!query.TRANSFORMATIONS.APPLY) throw new Error("Missing APPLY in TRANSFORMATIONS");

				if (!Array.isArray(query.TRANSFORMATIONS.GROUP) || query.TRANSFORMATIONS.GROUP.length === 0)
					throw new Error("GROUP must be a non-empty array");
				if (!Array.isArray(query.TRANSFORMATIONS.APPLY)) throw new Error("APPLY must be an array");

				// Validate GROUP keys are valid field keys
				for (const gKey of query.TRANSFORMATIONS.GROUP) {
					if (!validKeys.has(gKey)) {
						throw new Error("Unknown key in COLUMNS");
					}
				}

				filteredData = this.applyTransformations(
					filteredData,
					query.TRANSFORMATIONS,
					query.OPTIONS,
					validKeys,
					mfields
				);
			}

			if (query.OPTIONS.ORDER) {
				filteredData = this.applyOrder(filteredData, query.OPTIONS.ORDER);
			}

			return filteredData;
		}

		public applyTransformations(data: any[], transformations: any, options: any, validKeys: any, mfields: any) {
			const groupKeys: string[] = transformations.GROUP;
			const applyRules: any[] = transformations.APPLY;

			// validate APPLY keys
			const applyKeySet = new Set<string>();
			for (const rule of applyRules) {
				const applyKey = Object.keys(rule)[0];
				//check for empty or underscore
				if (!applyKey || applyKey.includes("_")) throw new Error("applykey cannot be empty or contain underscore");

				//check for dups
				if (applyKeySet.has(applyKey)) throw new Error("Duplicate applykey in APPLY");
				applyKeySet.add(applyKey);
			}

			// validate all COLUMNS are either in GROUP or APPLY
			const groupKeySet = new Set(groupKeys);
			for (const col of options.COLUMNS) {
				if (!groupKeySet.has(col) && !applyKeySet.has(col))
					throw new Error("When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY");
			}

			// validate APPLY rule tokens and keys upfront
			for (const rule of applyRules) {
				const applyKey = Object.keys(rule)[0];
				const token = Object.keys(rule[applyKey])[0];
				const key = rule[applyKey][token];
				if (!validKeys.has(key)) throw new Error("APPLYRULE must apply aggregation to a valid KEY");
				if (!["MAX", "MIN", "AVG", "SUM", "COUNT"].includes(token)) {
					throw new Error("Invalid APPLYTOKEN (must be MAX, MIN, AVG, COUNT, or SUM)");
				}
				if (["MAX", "MIN", "AVG", "SUM"].includes(token)) {
					if (!mfields.includes(key)) throw new Error("MAX/MIN/AVG/SUM can only be applied to mfields");
				}
			}

			// group data
			const grouped: Map<string, any[]> = new Map();
			for (const record of data) {
				const groupId = JSON.stringify(groupKeys.map((k: string) => record[k]));
				if (!grouped.has(groupId)) grouped.set(groupId, []);
				grouped.get(groupId)!.push(record);
			}

			// aggregate per group
			const result: any[] = [];
			for (const [_, records] of grouped) {
				const aggregated: any = {};

				// copy GROUP keys into aggregated record
				for (const g of groupKeys) {
					aggregated[g] = records[0][g];
				}

				//apply each APPLY rule
				for (const rule of applyRules) {
					const applyKey = Object.keys(rule)[0];
					const token = Object.keys(rule[applyKey])[0]; //ie: AVG, MAX
					const key = rule[applyKey][token]; // source key in data

					// check for valid KEY
					if (!validKeys.has(key)) throw new Error("APPLYRULE must apply aggregation to a valid KEY");

					if (["MAX", "MIN", "AVG", "SUM"].includes(token)) {
						if (!mfields.includes(key)) throw new Error("MAX/MIN/AVG/SUM can only be applied to mfields");
					}

					switch (token) {
						case "MAX":
							aggregated[applyKey] = Math.max(...records.map((r) => r[key]));
							break;

						case "MIN":
							aggregated[applyKey] = Math.min(...records.map((r) => r[key]));
							break;

						case "AVG":
							let total = new Decimal(0);
							for (const r of records) total = total.add(new Decimal(r[key]));
							let avg = total.toNumber() / records.length;
							aggregated[applyKey] = Number(avg.toFixed(2));
							break;

						case "SUM":
							let sum = records.reduce((acc, r) => acc + r[key], 0);
							aggregated[applyKey] = Number(sum.toFixed(2));
							break;

						case "COUNT":
							aggregated[applyKey] = new Set(records.map((r) => r[key])).size;
							break;

						default:
							throw new Error("Invalid APPLYTOKEN (must be MAX, MIN, AVG, COUNT, or SUM)");
					}
				}

				result.push(aggregated);
			}

			return result.map((r) => {
				const obj: any = {};
				for (const col of options.COLUMNS) obj[col] = r[col];
				return obj;
			});
		}

		private validateFilter(
			filter: any,
			kind: string,
			mfields: string[],
			sfields: string[],
			courseKeys: Set<string>,
			facilitiesKeys: Set<string>
		) {
			if (Object.keys(filter).length === 0) return;

			if (typeof filter !== "object" || filter === null || Array.isArray(filter) || Object.keys(filter).length !== 1) {
				throw new Error("WHERE must be an object with at most one FILTER");
			}

			const operator = Object.keys(filter)[0];
			const value = filter[operator];

			if (operator === "AND" || operator === "OR") {
				if (
					!Array.isArray(value) ||
					value.length === 0 ||
					value.some((f: any) => typeof f !== "object" || f === null || Array.isArray(f))
				) {
					throw new Error(
						operator === "AND"
							? "AND must be a non-empty array of FILTER objects"
							: "OR must be a non-empty array of FILTER objects"
					);
				}
				for (const nested of value) {
					this.validateFilter(nested, kind, mfields, sfields, courseKeys, facilitiesKeys);
				}
				return;
			}

			if (operator === "NOT") {
				if (typeof value !== "object" || value === null || Array.isArray(value)) {
					throw new Error("NOT must be a FILTER object");
				}
				this.validateFilter(value, kind, mfields, sfields, courseKeys, facilitiesKeys);
				return;
			}

			if (!["LT", "GT", "EQ", "IS"].includes(operator)) {
				throw new Error("WHERE must be an object with at most one FILTER");
			}

			if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).length !== 1) {
				if (operator === "IS") throw new Error("IS must be an object with one sfield of type string");
				throw new Error(`${operator} must be an object with one mfield of type number`);
			}

			const key = Object.keys(value)[0];
			const comparisonValue = value[key];

			const keyInCourse = courseKeys.has(key);
			const keyInFacilities = facilitiesKeys.has(key);
			if ((kind === "course_offerings" && keyInFacilities) || (kind === "facilities" && keyInCourse)) {
				throw new Error("Cannot mix course_offerings and facilities fields in one query");
			}

			if (operator === "IS") {
				if (!sfields.includes(key) || typeof comparisonValue !== "string") {
					throw new Error("IS must be an object with one sfield of type string");
				}
				if (!/^\*?[^*]*\*?$/.test(comparisonValue)) {
					throw new Error("IS asterisks can only be first or last character");
				}
				return;
			}

			if (!mfields.includes(key) || typeof comparisonValue !== "number") {
				throw new Error(`${operator} must be an object with one mfield of type number`);
			}
		}

		// iterate through given WHERE filter and apply them to query
		public applyWhere(data: any[], where: any) {
			if (Object.keys(where).length === 0) return data;

			return data.filter((record) => this.evaluateFilter(record, where));
		}

		// Check if string matches wildcard pattern (* at start/end only)
		public matchesWildcard(recordValue: string, pattern: string): boolean {
			if (recordValue === undefined || recordValue === null || pattern === undefined || pattern === null) return false;
			recordValue = String(recordValue);

			if (pattern.startsWith("*") && pattern.endsWith("*")) {
				return recordValue.includes(pattern.slice(1, -1));
			} else if (pattern.startsWith("*")) {
				return recordValue.endsWith(pattern.slice(1));
			} else if (pattern.endsWith("*")) {
				return recordValue.startsWith(pattern.slice(0, -1));
			}
			return recordValue === pattern;
		}

		// evaluate the given WHERE filters
		public evaluateFilter(record: any, filter: any): boolean {
			if (Object.keys(filter).length === 0) return true;
			const operator = Object.keys(filter)[0];
			const value = filter[operator];

			if (operator === "AND") {
				return value.every((f: any) => this.evaluateFilter(record, f));
			} else if (operator === "OR") {
				return value.some((f: any) => this.evaluateFilter(record, f));
			} else if (operator === "NOT") {
				return !this.evaluateFilter(record, value);
			}

			const key = Object.keys(value)[0];
			const val = value[key];

			switch (operator) {
				case "GT":
					return record[key] > val;
				case "LT":
					return record[key] < val;
				case "EQ":
					return record[key] === val;
				case "IS":
					return this.matchesWildcard(record[key], val);
				default:
					return false;
			}
		}

		// iterate through given data and apply to necessary columns
		public applyColumns(records: any[], columns: string[]) {
			return records.map((record) => {
				const result: any = {};
				for (const col of columns) result[col] = record[col];

				return result;
			});
		}

		public applyOrder(records: any[], order: any) {
			let orderKeys: string[] = [];
			let direction: "UP" | "DOWN" = "UP"; //default ascending

			if (typeof order === "string") {
				orderKeys = [order];
			} else if (typeof order === "object" && order.keys) {
				orderKeys = order.keys;
				if (order.dir !== undefined && order.dir !== "UP" && order.dir !== "DOWN") {
					throw new Error("Invalid sort direction (must be UP or DOWN)");
				}
				if (order.dir === "UP" || order.dir === "DOWN") direction = order.dir;
			} else {
				orderKeys = Object.keys(records[0] || {});
				direction = "UP";
			}
			return records.sort((a, b) => {
				for (const key of orderKeys) {
					if (a[key] < b[key]) return direction === "UP" ? -1 : 1;
					if (a[key] > b[key]) return direction === "UP" ? 1 : -1;
				}

				return 0;
			});
		}

		public getCourses(): Course[] {
			return this.data.courses;
		}

		public getCourseById(id: string): Course | undefined {
			return this.data.courses.find((course) => course.id === id);
		}

		async setCourse(
			id: string,
			title: string,
			dept: string,
			code: string
		): Promise<{ course: Course; created: boolean }> {
			let course = this.getCourseById(id);
			let created = false;

			if (course) {
				course.title = title;
				course.dept = dept;
				course.code = code;
			} else {
				course = { id, title, dept, code, sections: [] };
				created = true;
				this.data.courses.push(course);
			}
			await this.save();
			return { course, created };
		}

		async deleteCourse(id: string): Promise<Course | undefined> {
			const index = this.data.courses.findIndex((course) => course.id === id);
			if (index === -1) {
				return undefined;
			}

			const [deletedCourse] = this.data.courses.splice(index, 1);

			for (const sectionId of deletedCourse.sections) {
				const section = await this.getSectionById(sectionId);
				if (section) {
					await this.deleteSection(sectionId);
				}
			}

			await this.save();
			return deletedCourse;
		}

		public getSections(): Section[] {
			return this.data.sections;
		}

		public getSectionById(id: string): Section | undefined {
			return this.data.sections.find((section) => section.id === id);
		}

		async setSection(
			id: string,
			instructor: string,
			year: number,
			avg: number,
			pass: number,
			fail: number,
			audit: number
		): Promise<{ section: Section; created: boolean }> {
			let section = this.getSectionById(id);
			let created = false;

			if (section) {
				section.instructor = instructor;
				section.year = year;
				section.avg = avg;
				section.pass = pass;
				section.fail = fail;
				section.audit = audit;
			} else {
				section = { id, instructor, year, avg, pass, fail, audit };
				created = true;
				this.data.sections.push(section);
			}
			await this.save();
			return { section, created };
		}

		async deleteSection(id: string): Promise<Section | undefined> {
			const index = this.data.sections.findIndex((section) => section.id === id);
			if (index === -1) {
				return undefined;
			}
			const [deleteSections] = this.data.sections.splice(index, 1);

			for (const course of this.data.courses) {
				const sectionIndex = course.sections.indexOf(id);
				if (sectionIndex !== -1) {
					course.sections.splice(sectionIndex, 1);
				}
			}

			await this.save();
			return deleteSections;
		}

		public getBuildings(): Building[] {
			return this.data.buildings;
		}

		public getBuildingById(id: string): Building | undefined {
			return this.data.buildings.find((building) => building.id === id);
		}

		async setBuilding(
			id: string,
			name: string,
			address: string,
			lat: number,
			lon: number
		): Promise<{ building: Building; created: boolean }> {
			let building = this.getBuildingById(id);
			let created = false;

			if (building) {
				building.name = name;
				building.address = address;
				building.lat = lat;
				building.lon = lon;
			} else {
				building = { id, name, address, lat, lon, rooms: [] };
				created = true;
				this.data.buildings.push(building);
			}
			await this.save();
			return { building, created };
		}

		async deleteBuilding(id: string): Promise<Building | undefined> {
			const index = this.data.buildings.findIndex((building) => building.id === id);
			if (index === -1) {
				return undefined;
			}
			const [deletedBuilding] = this.data.buildings.splice(index, 1);
			for (const roomId of deletedBuilding.rooms) {
				await this.deleteRoom(roomId);
			}
			await this.save();
			return deletedBuilding;
		}

		public getRooms(): Room[] {
			return this.data.rooms;
		}

		public getRoomById(id: string): Room | undefined {
			return this.data.rooms.find((room) => room.id === id);
		}

		async setRoom(
			id: string,
			building: string,
			number: string,
			type: string,
			furniture: string,
			href: string,
			seats: number
		): Promise<{ room: Room; created: boolean }> {
			let room = this.getRoomById(id);
			let created = false;

			if (room) {
				room.building = building;
				room.number = number;
				room.type = type;
				room.furniture = furniture;
				room.href = href;
				room.seats = seats;
			} else {
				room = { id, building, number, type, furniture, href, seats };
				created = true;
				this.data.rooms.push(room);
			}
			await this.save();
			return { room, created };
		}

		async deleteRoom(id: string): Promise<Room | undefined> {
			const index = this.data.rooms.findIndex((room) => room.id === id);
			if (index === -1) {
				return undefined;
			}
			const [deletedRoom] = this.data.rooms.splice(index, 1);

			for (const building of this.data.buildings) {
				const roomIndex = building.rooms.indexOf(id);
				if (roomIndex !== -1) {
					building.rooms.splice(roomIndex, 1);
				}
			}

			await this.save();
			return deletedRoom;
		}
	}

	interface Course {
		id: string;
		title: string;
		dept: string;
		code: string;
		sections: string[];
	}

	interface Section {
		id: string;
		instructor: string;
		year: number;
		avg: number;
		pass: number;
		fail: number;
		audit: number;
	}

	const model = new Model(datadir);
	await model.load();

	// Make files in ../frontend/public accessible at http://localhost:<port>/
	app.use(express.static("frontend/public"));

	// Register middleware to parse request before passing them to request handlers
	// Note: JSON parser must be place before raw parser because of wildcard matching done by raw parser below
	app.use(express.json());
	app.use(express.raw({ type: "application/*", limit: "10mb" }));
	app.use(cors());

	// Handles file uploads
	// multer.memoryStorage() = store uploaded files in MEMORY!
	const upload = multer({ storage: multer.memoryStorage() });

	// HELPER: Validate that a record has all required fields with correct types
	interface CourseOffering {
		id: string | number; // id can be string or number in real data
		Course: string;
		Title: string;
		Professor: string;
		Subject: string;
		Section: string;
		Year: string | number;
		Avg: number;
		Pass: number;
		Fail: number;
		Audit: number;
	}

	function isValidCourseOffering(record: any): record is CourseOffering {
		if (typeof record !== "object" || record === null) return false;

		// Check required fields exist
		const requiredFields = [
			"id",
			"Course",
			"Title",
			"Professor",
			"Subject",
			"Section",
			"Year",
			"Avg",
			"Pass",
			"Fail",
			"Audit",
		];
		for (const field of requiredFields) {
			if (record[field] === undefined || record[field] === null) return false;
		}

		// Convert string fields: accept string or number (convert number to string)
		for (const field of ["Course", "Title", "Professor", "Subject", "Section"] as const) {
			if (typeof record[field] === "number") {
				record[field] = String(record[field]);
			} else if (typeof record[field] !== "string") {
				return false;
			}
		}

		// id: accept string or number
		if (typeof record.id !== "string" && typeof record.id !== "number") return false;

		// Year: accept string or number
		if (typeof record.Year !== "string" && typeof record.Year !== "number") return false;

		// Convert number fields: accept number or string that parses to a finite number
		for (const field of ["Avg", "Pass", "Fail", "Audit"] as const) {
			if (typeof record[field] === "string") {
				const num = Number(record[field]);
				if (!Number.isFinite(num)) return false;
				record[field] = num;
			} else if (typeof record[field] !== "number") {
				return false;
			}
		}

		return true;
	}

	type JobStatus = "processing" | "completed" | "failed";

	interface UploadJob {
		id: string;
		status: JobStatus;
		kind: string;
		message: string;
		stats: Record<string, number>;
	}

	// Create job tracker for memory contents
	const jobs = new Map<string, UploadJob>();

	// ASYNC PROCESSING: Facilities -- NO GEOLOCATION
	async function processFacilitiesZip(zip: JSZip, job: UploadJob): Promise<void> {
		const stats = job.stats;

		// Step 2: Validate index.htm
		const indexFile = zip.file("index.htm");
		if (!indexFile) {
			job.status = "failed";
			job.message = "Missing index.htm file";
			return;
		}

		let indexContent: string;
		try {
			indexContent = await indexFile.async("string");
		} catch {
			job.status = "failed";
			job.message = "index.htm could not be parsed";
			return;
		}

		// Step 3: Locate building table
		let indexDoc: P5Node;
		try {
			indexDoc = parse5.parse(indexContent);
		} catch {
			job.status = "failed";
			job.message = "index.htm could not be parsed";
			return;
		}

		const buildingTable = findTableByClass(indexDoc, "views-table");
		if (!buildingTable) {
			job.status = "failed";
			job.message = "No building table found in index.htm";
			return;
		}

		// Step 4: Extract building information
		const buildingInfos = parseBuildingIndex(indexContent);

		// Steps 5, 6, 7
		for (const buildingInfo of buildingInfos) {
			stats.buildings_seen++;

			// Step 5: Extract rooms from the linked building file
			const linkPath = buildingInfo.link.replace(/^\.\//, "").replace(/^\//, "");
			let rooms: RoomInfo[] = [];
			const buildingFile = zip.file(linkPath);
			if (buildingFile) {
				try {
					const buildingContent = await buildingFile.async("string");
					rooms = parseRoomTable(buildingContent);
				} catch {
					// File can't be read/parsed — no rooms for this building
				}
			}

			// Step 6: Fetch geolocation
			let lat: number;
			let lon: number;
			try {
				const encodedAddress = encodeURIComponent(buildingInfo.address);
				const geoUrl = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team079/${encodedAddress}`;
				const geoTimeout = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("Geolocation request timed out")), 10000)
				);
				const geoResponse = (await Promise.race([fetch(geoUrl), geoTimeout])) as Response;
				const geoData = (await geoResponse.json()) as { lat?: number; lon?: number; error?: string };
				if (geoData.error !== undefined || geoData.lat === undefined || geoData.lon === undefined) {
					continue;
				}
				if (!Number.isFinite(geoData.lat) || !Number.isFinite(geoData.lon)) {
					continue;
				}
				lat = geoData.lat;
				lon = geoData.lon;
			} catch {
				continue;
			}

			// Step 7: Load building
			const existingBuilding = model.getBuildingById(buildingInfo.shortname);
			if (!existingBuilding) {
				await model.setBuilding(buildingInfo.shortname, buildingInfo.fullname, buildingInfo.address, lat, lon);
				stats.buildings_added++;
			} else {
				if (
					existingBuilding.name !== buildingInfo.fullname ||
					existingBuilding.address !== buildingInfo.address ||
					existingBuilding.lat !== lat ||
					existingBuilding.lon !== lon
				) {
					await model.setBuilding(buildingInfo.shortname, buildingInfo.fullname, buildingInfo.address, lat, lon);
					stats.buildings_modified++;
				}
			}

			// Load rooms
			const buildingRecord = model.getBuildingById(buildingInfo.shortname)!;
			for (const roomInfo of rooms) {
				stats.rooms_seen++;
				const roomId = `${buildingInfo.shortname}_${roomInfo.number}`;
				const existingRoom = model.getRoomById(roomId);
				if (!existingRoom) {
					await model.setRoom(
						roomId,
						buildingInfo.shortname,
						roomInfo.number,
						roomInfo.type,
						roomInfo.furniture,
						roomInfo.href,
						roomInfo.seats
					);
					stats.rooms_added++;
				} else {
					if (
						existingRoom.building !== buildingInfo.shortname ||
						existingRoom.number !== roomInfo.number ||
						existingRoom.type !== roomInfo.type ||
						existingRoom.furniture !== roomInfo.furniture ||
						existingRoom.href !== roomInfo.href ||
						existingRoom.seats !== roomInfo.seats
					) {
						await model.setRoom(
							roomId,
							buildingInfo.shortname,
							roomInfo.number,
							roomInfo.type,
							roomInfo.furniture,
							roomInfo.href,
							roomInfo.seats
						);
						stats.rooms_modified++;
					}
				}
				if (!buildingRecord.rooms.includes(roomId)) {
					buildingRecord.rooms.push(roomId);
					await model.setBuilding(
						buildingInfo.shortname,
						buildingRecord.name,
						buildingRecord.address,
						buildingRecord.lat,
						buildingRecord.lon
					);
				}
			}
		}

		job.status = "completed";
		job.message = "Dataset processing complete";
	}

	// ASYNC PROCESSING: Process the uploaded zip file in the background
	// This function runs AFTER we return 202 to the user.
	// It follows these steps from the spec:
	// 1.Validate zip format
	// 2.Check for courses
	// 3.Process files in courses
	// 4.Load records into resources (courses first, then sections)
	async function processDataset(zipBuffer: Buffer, kind: string, jobId: string): Promise<void> {
		const job = jobs.get(jobId);
		if (!job) return;

		// 1. Validate zip format:
		try {
			let zip: JSZip;
			try {
				zip = await JSZip.loadAsync(zipBuffer);
			} catch {
				// Invalid zip
				job.status = "failed";
				job.message = "Data is not in a valid zip format";
				return;
			}

			// Route to facilities processing if kind is facilities
			if (kind === "facilities") {
				await processFacilitiesZip(zip, job);
				return;
			}

			// 2. Check for courses/ directory:
			const hasRootCoursesDir = Object.keys(zip.files).some((name) => name.startsWith("courses/"));
			if (!hasRootCoursesDir) {
				job.status = "failed";
				job.message = "Missing root courses directory";
				return;
			}

			const coursesFiles = Object.keys(zip.files).filter(
				(filePath) => filePath.startsWith("courses/") && !filePath.endsWith("/") && filePath.split("/").length === 2
			);

			// 3. Process files in courses/ directory:
			// For each file in the courses/ directory:
			// If the file is valid JSON with a result property, each course
			// offering object in the result array is processed.
			//
			// If the file is not valid JSON or does not have a result
			// property, the file is skipped."
			//
			// Increase job stats accordingly
			const allOfferings: CourseOffering[] = [];

			for (const filePath of coursesFiles) {
				job.stats.files_total++;

				const file = zip.file(filePath);
				if (!file) {
					job.stats.files_skipped++;
					continue;
				}

				try {
					// Read file content as string
					const content = await file.async("string");

					// Try to parse as JSON
					const json = JSON.parse(content);

					// Check if it has a "result" property that is an array
					if (!json.result || !Array.isArray(json.result)) {
						job.stats.files_skipped++;
						continue; // Skip - no valid result property
					}
					job.stats.files_processed++;
					// Validate each record in the result array
					for (const record of json.result) {
						if (isValidCourseOffering(record)) allOfferings.push(record); // Invalid records are silently skipped
					}
				} catch {
					// Skip - file is not valid JSON
					job.stats.files_skipped++;
					continue;
				}
			}

			// Process courses first
			const courseOfferingsMap = new Map<string, CourseOffering[]>();

			for (const offering of allOfferings) {
				const courseId = offering.Subject + offering.Course;
				if (!courseOfferingsMap.has(courseId)) {
					courseOfferingsMap.set(courseId, []);
				}
				courseOfferingsMap.get(courseId)!.push(offering);
			}

			// Process each course
			for (const [courseId, offerings] of courseOfferingsMap) {
				// "title set to the most recent offering's Title field"
				// Find the offering with the highest year (excluding "overall" sections)
				const sortedOfferings = offerings
					.filter((o) => o.Section !== "overall")
					.sort((a, b) => String(b.Year).localeCompare(String(a.Year), undefined, { numeric: true }));

				// Use the most recent, or fallback to first offering
				const mostRecent = sortedOfferings[0] || offerings[0];

				// Check if course already exists
				const existingCourse = model.getCourseById(courseId);

				//increases job stats accordingly
				if (!existingCourse) {
					// "If the course does not exist, create a new course with:
					//  - code set to the offering's Course field
					//  - title set to the most recent offering's Title field
					//  - dept set to the offering's Subject field"
					await model.setCourse(
						courseId, // id = Subject + Course (e.g., "CPSC310")
						mostRecent.Title, // title
						mostRecent.Subject, // dept
						mostRecent.Course // code
					);

					job.stats.courses_added++;
				} else {
					// "If the course exists, update it only if any field value
					//  differs from the current resource."
					if (
						existingCourse.title !== mostRecent.Title ||
						existingCourse.dept !== mostRecent.Subject ||
						existingCourse.code !== mostRecent.Course
					) {
						await model.setCourse(courseId, mostRecent.Title, mostRecent.Subject, mostRecent.Course);
						job.stats.courses_modified++;
					}
				}
			}

			// 4. Load records into resources: FOLLOW THE RULES!
			// Process sections (after all courses exist)
			// A record will not be processed if any of the following conditions are met:
			for (const offering of allOfferings) {
				// "Sections: the section id is set to the course offering id."
				const courseId = offering.Subject + offering.Course;
				const sectionId = String(offering.id); // Convert to string for consistent storage

				// Get the parent course
				const course = model.getCourseById(courseId);
				if (!course) continue; // Should never happen since we created courses first

				// "year set to the offering's Year field, converted to a number
				//  (or 1900 when the offering's Section field equals 'overall')"
				let year: number;
				if (offering.Section.toLowerCase() === "overall") {
					year = 1900;
				} else {
					const parsedYear = Number(offering.Year);
					if (!Number.isFinite(parsedYear)) continue; // skip if year is not valid value
					year = parsedYear;
				}

				job.stats.sections_seen++;

				// Check if section already exists
				const existingSection = model.getSectionById(sectionId);

				if (!existingSection) {
					await model.setSection(
						sectionId,
						offering.Professor, // instructor
						year, // year
						offering.Avg, // avg
						offering.Pass, // pass
						offering.Fail, // fail
						offering.Audit // audit
					);

					job.stats.sections_added++;
				} else {
					// "If the section exists, update it only if any field value
					//  differs from the current resource."
					if (
						existingSection.instructor !== offering.Professor ||
						existingSection.year !== year ||
						existingSection.avg !== offering.Avg ||
						existingSection.pass !== offering.Pass ||
						existingSection.fail !== offering.Fail ||
						existingSection.audit !== offering.Audit
					) {
						await model.setSection(
							sectionId,
							offering.Professor,
							year,
							offering.Avg,
							offering.Pass,
							offering.Fail,
							offering.Audit
						);
						job.stats.sections_modified++;
					}
				}
				// Make sure section is linked to course
				if (!course.sections.includes(sectionId)) {
					course.sections.push(sectionId);
					await model.setCourse(courseId, course.title, course.dept, course.code);
				}
			}
			job.stats.courses_seen = courseOfferingsMap.size;
			job.status = "completed";
			job.message = "Dataset processing complete";
		} catch (err: any) {
			job.status = "failed";
			job.message = err?.message || "Dataset processing failed";
		}
	}

	const createV1DatasetHandler: express.RequestHandler = async (req, res) => {
		// Get the "kind" field from the form data
		const kind = req.body?.kind;

		// Collect validation errors
		const fields: Record<string, string> = {};

		// Validate "kind" field
		if (kind === undefined) {
			fields.kind = "required but missing";
		} else if (kind !== "course_offerings") {
			fields.kind = "expected to be course_offerings";
		}

		// Validate "archive" file
		// req.file is set by multer if a file was uploaded
		if (!req.file) {
			fields.archive = "required but missing";
		} else if (req.file.buffer.length === 0) {
			fields.archive = "expected non-empty file";
		}

		// If any validation errors, return 422
		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		}

		// Get the zip file content from req.file.buffer
		const zipBuffer = req.file!.buffer;
		const id = req.file!.originalname;

		// store initial job state
		const job: UploadJob = {
			id,
			status: "processing",
			kind,
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				courses_seen: 0,
				courses_added: 0,
				courses_modified: 0,
				sections_seen: 0,
				sections_added: 0,
				sections_modified: 0,
			},
			message: "Dataset accepted for processing",
		};

		jobs.set(id, job);

		// Return 202 immediately
		res.status(202).send({
			id: job.id,
			status: job.status,
			kind: job.kind,
			message: job.message,
		});

		// Perform processing in the background

		processDataset(zipBuffer, kind, id).catch((err) => {
			const existingJob = jobs.get(id);
			if (existingJob) {
				existingJob.status = "failed";
				existingJob.message = err?.message || "Dataset processing failed unexpectedly";
			}
		});
	};

	// GET /datasetId
	const getV1DatasetHandler: express.RequestHandler = (req, res) => {
		const { datasetId } = req.params;

		const job = jobs.get(datasetId);

		if (!job) {
			res.status(404).send({
				error: "Not found",
				message: `no upload job with id '${datasetId}'`,
			});
			return;
		} else {
			res.status(200).send(job);
		}
	};

	// POST /api/v2/datasets — accepts both course_offerings and facilities
	const createV2DatasetHandler: express.RequestHandler = async (req, res) => {
		const kind = req.body?.kind;
		const fields: Record<string, string> = {};

		if (kind === undefined) {
			fields.kind = "required but missing";
		} else if (kind !== "course_offerings" && kind !== "facilities") {
			fields.kind = "expected to be course_offerings or facilities";
		}

		if (!req.file) {
			fields.archive = "required but missing";
		} else if (req.file.buffer.length === 0) {
			fields.archive = "expected non-empty file";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).send({ error: "Validation failed", fields });
			return;
		}

		const zipBuffer = req.file!.buffer;
		const id = req.file!.originalname;

		const initStats: Record<string, number> =
			kind === "facilities"
				? {
					files_total: 0,
					files_processed: 0,
					files_skipped: 0,
					buildings_seen: 0,
					buildings_added: 0,
					buildings_modified: 0,
					rooms_seen: 0,
					rooms_added: 0,
					rooms_modified: 0,
				}
				: {
					files_total: 0,
					files_processed: 0,
					files_skipped: 0,
					courses_seen: 0,
					courses_added: 0,
					courses_modified: 0,
					sections_seen: 0,
					sections_added: 0,
					sections_modified: 0,
				};

		const job: UploadJob = {
			id,
			status: "processing",
			kind,
			stats: initStats,
			message: "Dataset accepted for processing",
		};

		jobs.set(id, job);

		res.status(202).send({
			id: job.id,
			status: job.status,
			kind: job.kind,
			message: job.message,
		});

		processDataset(zipBuffer, kind, id).catch((err) => {
			const existingJob = jobs.get(id);
			if (existingJob) {
				existingJob.status = "failed";
				existingJob.message = err?.message || "Dataset processing failed unexpectedly";
			}
		});
	};

	// GET /api/v2/datasets/:datasetId
	const getV2DatasetHandler: express.RequestHandler = (req, res) => {
		const { datasetId } = req.params;
		const job = jobs.get(datasetId);
		if (!job) {
			res.status(404).send({
				error: "Not found",
				message: `no upload job with id '${datasetId}'`,
			});
			return;
		}
		res.status(200).send(job);
	};

	const searchV1Handler: express.RequestHandler = async (req, res) => {
		const { kind, query } = req.body;
		// Validate kind and query fields
		const fields: Record<string, string> = {};
		if (kind === undefined) {
			fields.kind = "required but missing";
		} else if (kind !== "course_offerings") {
			fields.kind = "expected to be course_offerings";
		}
		if (query === undefined) {
			fields.query = "required but missing";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		}

		try {
			const results = await model.search(query, kind);

			if (results.length > 5000) {
				res.status(413).send({
					error: "Too many results",
					message: "Query would return more than 5000 results",
					limit: 5000,
				});
				return;
			}

			res.status(200).send(results);
		} catch (err: any) {
			res.status(400).send({
				error: "Invalid query",
				message: err.message,
			});
		}
	};

	// v2 version of search
	const searchV2Handler: express.RequestHandler = async (req, res) => {
		const { kind, query } = req.body;

		// Validate kind and query fields
		const fields: Record<string, string> = {};
		if (kind === undefined) {
			fields.kind = "required but missing";
		} else if (kind !== "course_offerings" && kind !== "facilities") {
			fields.kind = "expected to be course_offerings or facilities"; // check for both course_offerings and facilities
		}
		if (query === undefined) {
			fields.query = "required but missing";
		} else if (typeof query !== "object" || query === null || Array.isArray(query)) {
			fields.query = "expected an object";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		}

		try {
			const results = await model.search(query, kind);

			if (results.length > 5000) {
				res.status(413).send({
					error: "Too many results",
					message: "Query would return more than 5000 results",
					limit: 5000,
				});
				return;
			}

			res.status(200).send(results);
		} catch (err: any) {
			res.status(400).send({
				error: "Invalid query",
				message: err.message,
			});
		}
	};

	// Basic message to verify REST API is available
	// You can see the message by going to http://localhost:<port>/api
	app.get("/api", (_req, res) => {
		res.send("App is running!");
	});

	// GET /courses (list courses with pagination)
	const listCoursesHandler: express.RequestHandler = (req, res) => {
		const givenLimit = req.query.limit;
		const givenOffset = req.query.offset;

		const limit = req.query.limit !== undefined ? Number(givenLimit) : 100;
		const offset = req.query.offset !== undefined ? Number(givenOffset) : 0;

		const params: Record<string, string> = {};
		if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
			params.limit = "expected an integer between 1 and 5000";
		}
		if (!Number.isInteger(offset) || offset < 0) {
			params.offset = "expected an integer >= 0";
		}
		if (Object.keys(params).length > 0) {
			res.status(400).send({
				error: "Invalid request parameters",
				params: params,
			});
			return;
		}
		const allCourses = model.getCourses();
		allCourses.sort((a, b) => a.id.localeCompare(b.id));
		let items = allCourses.slice(offset, offset + limit).map((course) => ({
			id: course.id,
			title: course.title,
			dept: course.dept,
			code: course.code,
			links: {
				self: `/api/v1/courses/${course.id}`,
				sections: `/api/v1/courses/${course.id}/sections`,
			},
		}));
		res.status(200).send({
			total: allCourses.length,
			limit: limit,
			offset: offset,
			items,
		});
	};

	// GET /courses/:course (get course details)
	const getCourseHandler: express.RequestHandler = (req, res) => {
		const { courseId } = req.params;
		const course = model.getCourseById(courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${courseId}'`,
			});
			return;
		}
		res.status(200).send({
			id: course.id,
			title: course.title,
			dept: course.dept,
			code: course.code,
			links: {
				self: `/api/v1/courses/${course.id}`,
				sections: `/api/v1/courses/${course.id}/sections`,
			},
		});
	};

	// PUT /courses/:course (create or update course)
	const upsertCourseHandler: express.RequestHandler = async (req, res) => {
		const { courseId } = req.params;
		const { title, dept, code } = req.body;
		const fields: Record<string, string> = {};
		if (title === undefined) fields.title = "required but missing";
		else if (typeof title !== "string") fields.title = "expected a string";
		if (dept === undefined) fields.dept = "required but missing";
		else if (typeof dept !== "string") fields.dept = "expected a string";
		if (code === undefined) fields.code = "required but missing";
		else if (typeof code !== "string") fields.code = "expected a string";
		if (Object.keys(fields).length > 0) {
			res.status(422).send({ error: "Validation failed", fields });
			return;
		}
		const { course, created } = await model.setCourse(courseId, title, dept, code);
		const links = {
			self: `/api/v1/courses/${course.id}`,
			sections: `/api/v1/courses/${course.id}/sections`,
		};
		if (created) {
			res.status(201).send({
				id: course.id,
				title: course.title,
				dept: course.dept,
				code: course.code,
				links,
			});
			return;
		}
		res.status(204).send();
	};

	// DELETE /courses/:course (remove course and its sections)
	const deleteCourseHandler: express.RequestHandler = async (req, res) => {
		const { courseId } = req.params;
		const course = await model.deleteCourse(courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${courseId}'`,
			});
			return;
		}
		res.status(200).send({
			id: course.id,
			title: course.title,
			dept: course.dept,
			code: course.code,
			sections: course.sections.length,
		});
	};

	// GET /courses/:course/sections (list sections for a course with pagination)
	const listSectionsForCourseHandler: express.RequestHandler = (req, res) => {
		const { courseId } = req.params;
		const course = model.getCourseById(courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${courseId}'`,
			});
			return;
		}
		const givenLimit = req.query.limit;
		const givenOffset = req.query.offset;

		const limit = req.query.limit !== undefined ? Number(givenLimit) : 100;
		const offset = req.query.offset !== undefined ? Number(givenOffset) : 0;
		const params: Record<string, string> = {};
		if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
			params.limit = "expected an integer between 1 and 5000";
		}
		if (!Number.isInteger(offset) || offset < 0) {
			params.offset = "expected an integer >= 0";
		}
		if (Object.keys(params).length > 0) {
			res.status(400).send({
				error: "Invalid request parameters",
				params: params,
			});
			return;
		}
		const allSections = course.sections.map((id) => model.getSectionById(id)).filter((s): s is Section => !!s);
		allSections.sort((a, b) => a.id.localeCompare(b.id));
		const items = allSections.slice(offset, offset + limit).map((section) => ({
			id: section.id,
			instructor: section.instructor,
			year: section.year,
			avg: section.avg,
			pass: section.pass,
			fail: section.fail,
			audit: section.audit,
			links: {
				course: `/api/v1/courses/${course.id}`,
				self: `/api/v1/courses/${course.id}/sections/${section.id}`,
			},
		}));
		res.status(200).send({
			items,
			total: allSections.length,
			limit: limit,
			offset: offset,
		});
	};

	// GET /courses/:course/sections/:section (get section details)
	const getSectionForCourseHandler: express.RequestHandler = (req, res) => {
		const { courseId, sectionId } = req.params;
		const course = model.getCourseById(courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${courseId}'`,
			});
			return;
		}
		const section = model.getSectionById(sectionId);
		if (!section || !course.sections.includes(sectionId)) {
			res.status(404).send({
				error: "Not found",
				message: `no section with id '${sectionId}' in course '${courseId}'`,
			});
			return;
		}
		res.status(200).send({
			id: section.id,
			instructor: section.instructor,
			year: section.year,
			avg: section.avg,
			pass: section.pass,
			fail: section.fail,
			audit: section.audit,
			links: {
				course: `/api/v1/courses/${course.id}`,
				self: `/api/v1/courses/${course.id}/sections/${section.id}`,
			},
		});
	};

	// PUT /courses/:course/sections/:section (create or update section)
	const upsertSectionForCourseHandler: express.RequestHandler = async (req, res) => {
		const { courseId, sectionId } = req.params;
		const { instructor, year, avg, pass, fail, audit } = req.body;
		const course = model.getCourseById(courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${courseId}'`,
			});
			return;
		}
		const fields: Record<string, string> = {};
		if (instructor === undefined) fields.instructor = "required but missing";
		else if (typeof instructor !== "string") fields.instructor = "expected a string";
		if (year === undefined) fields.year = "required but missing";
		else if (typeof year !== "number" || year < 1900 || year > 2099)
			fields.year = "expected a number between 1900 and 2099";
		if (avg === undefined) fields.avg = "required but missing";
		else if (typeof avg !== "number" || avg < 0 || avg > 100) fields.avg = "expected a number between 0 and 100";
		if (pass === undefined) fields.pass = "required but missing";
		else if (typeof pass !== "number" || pass < 0) fields.pass = "expected a number >= 0";
		if (fail === undefined) fields.fail = "required but missing";
		else if (typeof fail !== "number" || fail < 0) fields.fail = "expected a number >= 0";
		if (audit === undefined) fields.audit = "required but missing";
		else if (typeof audit !== "number" || audit < 0) fields.audit = "expected a number >= 0";
		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		}
		const { section, created } = await model.setSection(sectionId, instructor, year, avg, pass, fail, audit);
		if (!course.sections.includes(sectionId)) {
			course.sections.push(sectionId);
			await model.setCourse(courseId, course.title, course.dept, course.code);
		}

		const responseBody = {
			id: section.id,
			instructor: section.instructor,
			year: section.year,
			avg: section.avg,
			pass: section.pass,
			fail: section.fail,
			audit: section.audit,
			links: {
				course: `/api/v1/courses/${course.id}`,
				self: `/api/v1/courses/${course.id}/sections/${section.id}`,
			},
		};

		if (created) {
			res.status(201).send(responseBody);
			return;
		}
		res.status(204).send(responseBody);
	};

	// DELETE /courses/:course/sections/:section (remove a section)
	const deleteSectionForCourseHandler: express.RequestHandler = async (req, res) => {
		const { courseId, sectionId } = req.params;
		const course = model.getCourseById(courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${courseId}'`,
			});
			return;
		}
		if (!course.sections.includes(sectionId)) {
			res.status(404).send({
				error: "Not found",
				message: `no section with id '${sectionId}' in course '${courseId}'`,
			});
			return;
		}
		const section = await model.deleteSection(sectionId);
		if (!section) {
			res.status(404).send({
				error: "Not found",
				message: `no section with id '${sectionId}'`,
			});
			return;
		}
		res.status(200).send({
			id: section.id,
			instructor: section.instructor,
			year: section.year,
			avg: section.avg,
			pass: section.pass,
			fail: section.fail,
			audit: section.audit,
		});
	};
	// Building API
	// perform GET for all buildings with pagination
	const listBuildingsHandler: express.RequestHandler = async (req, res, next) => {
		try {
			const {limit, offset} = PaginationValidator.parse(
				req.query.limit,
				req.query.offset
			);

			const allBuildings = model.getBuildings();
			allBuildings.sort((a, b) => a.id.localeCompare(b.id));
			const items = allBuildings.slice(offset, offset + limit).map((building) => ({
				id: building.id,
				name: building.name,
				address: building.address,
				lat: building.lat,
				lon: building.lon,
				links: {
					self: `/api/v2/buildings/${building.id}`,
					rooms: `/api/v2/buildings/${building.id}/rooms`,
				},
			}));
			res.status(200).send({
				total: allBuildings.length,
				limit: limit,
				offset: offset,
				items,
			});
		} catch (err) {
			next(err);
		}
	};

	// perform GET for building given id
	const getBuildingHandler: express.RequestHandler = async (req, res, next) => {
		try {
			const { buildingId } = req.params;
			const building = model.getBuildingById(buildingId);
			if (!building) {
				throw new NotFoundError(`no building with id '${buildingId}'`);
			}

			res.status(200).send({
				id: building.id,
				name: building.name,
				address: building.address,
				lat: building.lat,
				lon: building.lon,
				links: {
					self: `/api/v2/buildings/${building.id}`,
					rooms: `/api/v2/buildings/${building.id}/rooms`,
				},
			});
		} catch (err) {
			next(err);
		}
	};

	// perform PUT for building given required params
	const upsertBuildingHandler: express.RequestHandler = async (req, res, next) => {
		try {
			const { buildingId } = req.params;
			const { name, address, lat, lon } = req.body;

			validateFields(req.body, [
				{name: "name", type: "string"},
				{name: "address", type: "string"},
				{name: "lat", type: "number"},
				{name: "lon", type: "number"}
			]);

			const { building, created } = await model.setBuilding(buildingId, name, address, lat, lon);
			const links = {
				self: `/api/v2/buildings/${building.id}`,
				rooms: `/api/v2/buildings/${building.id}/rooms`,
			};

			if (created) {
				res.status(201).send({
					id: building.id,
					name: building.name,
					address: building.address,
					lat: building.lat,
					lon: building.lon,
					links,
				});
				return;
			}
			res.status(204).send();
		} catch (err) {
			next(err);
		}

	};

	const deleteBuildingHandler: express.RequestHandler = async (req, res, next) => {
		try {
			const { buildingId } = req.params;
			const building = await model.deleteBuilding(buildingId);
			if (!building) {
				throw new NotFoundError(`no building with id '${buildingId}'`);
			}

			res.status(200).send({
				id: building?.id,
				name: building?.name,
				address: building?.address,
				lat: building?.lat,
				lon: building?.lon,
				rooms: building?.rooms.length,
			});
		} catch (err) {
			next(err);
		}
	};

	// perform GET for rooms
	const listRoomsInBuildingHandler: express.RequestHandler = async (req, res, next) => {
		try {
			const { buildingId } = req.params;

			const {limit, offset} = PaginationValidator.parse(
				req.query.limit,
				req.query.offset
			);


			const buildingPath = model.getBuildingById(buildingId);
			if (!buildingPath) {
				throw new NotFoundError(`no building with id '${buildingId}'`);
			}

			const allRooms = buildingPath.rooms.map((id) => model.getRoomById(id)).filter((r): r is Room => !!r);
			allRooms.sort((a, b) => a.id.localeCompare(b.id));
			const items = allRooms.slice(offset, offset + limit).map((room) => ({
				id: room.id,
				building: room.building,
				number: room.number,
				type: room.type,
				furniture: room.furniture,
				href: room.href,
				seats: room.seats,
				links: {
					self: `/api/v2/buildings/${buildingId}/rooms/${room.id}`,
					building: `/api/v2/buildings/${buildingId}`,
				},
			}));
			res.status(200).send({
				total: allRooms.length,
				limit: limit,
				offset: offset,
				items,
			});
		} catch (err) {
			next(err);
		}

	};

	// perform GET for room given room id
	const getRoomInBuildingHandler: express.RequestHandler = async (req, res, next) => {
		try {
			const { buildingId, roomId } = req.params;
			const buildingPath = model.getBuildingById(buildingId);

			//message: `no room with id '${roomId}' in building '${buildingId}'`

			if (!buildingPath) {
				throw new NotFoundError(`no building with id '${buildingId}'`);
			}

			const room = model.getRoomById(roomId);
			if (!room || !buildingPath.rooms.includes(roomId)) {
				throw new NotFoundError(`no room with id '${roomId}' in building '${buildingId}'`);
			}

			res.status(200).send({
				id: room.id,
				building: room.building,
				number: room.number,
				type: room.type,
				furniture: room.furniture,
				href: room.href,
				seats: room.seats,
				links: {
					self: `/api/v2/buildings/${buildingId}/rooms/${roomId}`,
					building: `/api/v2/buildings/${buildingId}`,
				},
			});
		} catch (err) {
			next(err);
		}
	};

	// TODO: refactor how validation is checked
	// perform PUT for room given required params
	const upsertRoomInBuildingHandler: express.RequestHandler = async (req, res, next) => {
		try {
			const { buildingId, roomId } = req.params;
			const { building, number, type, furniture, href, seats } = req.body;
			const buildingPath = model.getBuildingById(buildingId);
			if (!buildingPath) {
				throw new NotFoundError(`no building with id '${buildingId}'`);
			}

			const fields: Record<string, string> = {};
			if (building !== buildingId) fields.building = "must match parent building in path";
			if (seats === undefined) fields.seats = "required but missing";
			else if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 0)
				fields.seats = "expected a number >= 0";

			validateFields(req.body, [
				{name: "building", type: "string"},
				{name: "number", type: "string"},
				{name: "type", type: "string"},
				{name: "furniture", type: "string"},
				{name: "href", type: "string"},
			], fields);

			const { room, created } = await model.setRoom(roomId, building, number, type, furniture, href, seats);
			if (!buildingPath.rooms.includes(roomId)) {
				buildingPath.rooms.push(roomId);
				await model.setBuilding(buildingId, buildingPath.name, buildingPath.address, buildingPath.lat, buildingPath.lon);
			}

			const responseBody = {
				id: room.id,
				building: room.building,
				number: room.number,
				type: room.type,
				furniture: room.furniture,
				href: room.href,
				seats: room.seats,
				links: {
					self: `/api/v2/buildings/${buildingId}/rooms/${roomId}`,
					building: `/api/v2/buildings/${buildingId}`,
				},
			};

			if (created) {
				res.status(201).send(responseBody);
				return;
			}
			res.status(204).send();
		} catch (err) {
			next(err);
		}


	};

	const deleteRoomInBuildingHandler: express.RequestHandler = async (req, res, next) => {
		try {
			const { buildingId, roomId } = req.params;
			const buildingPath = model.getBuildingById(buildingId);
			if (!buildingPath) {
				throw new NotFoundError(`no building with id '${buildingId}'`);
			}

			if (!buildingPath.rooms.includes(roomId)) {
				throw new NotFoundError(`no room with id '${roomId}' in building '${buildingId}'`);
			}

			const room = await model.deleteRoom(roomId);
			if (!room) {
				throw new NotFoundError(`no room with id '${roomId}'`);
			}
			res.status(200).send({
				id: room.id,
				building: room.building,
				number: room.number,
				type: room.type,
				furniture: room.furniture,
				href: room.href,
				seats: room.seats,
			});
		} catch (err) {
			next(err);
		}
	};

	app.use(
		createDatasetsRouter({
			uploadArchive: upload.single("archive"),
			createV1Dataset: createV1DatasetHandler,
			getV1Dataset: getV1DatasetHandler,
			createV2Dataset: createV2DatasetHandler,
			getV2Dataset: getV2DatasetHandler,
		})
	);

	app.use(
		createSearchRouter({
			searchV1: searchV1Handler,
			searchV2: searchV2Handler,
		})
	);

	app.use(
		createCourseRouter({
			listCourses: listCoursesHandler,
			getCourse: getCourseHandler,
			upsertCourse: upsertCourseHandler,
			deleteCourse: deleteCourseHandler,
			listSectionsForCourse: listSectionsForCourseHandler,
			getSectionForCourse: getSectionForCourseHandler,
			upsertSectionForCourse: upsertSectionForCourseHandler,
			deleteSectionForCourse: deleteSectionForCourseHandler,
		})
	);

	app.use(
		createBuildingRouter({
			listBuildings: listBuildingsHandler,
			getBuilding: getBuildingHandler,
			upsertBuilding: upsertBuildingHandler,
			deleteBuilding: deleteBuildingHandler,
			listRoomsInBuilding: listRoomsInBuildingHandler,
			getRoomInBuilding: getRoomInBuildingHandler,
			upsertRoomInBuilding: upsertRoomInBuildingHandler,
			deleteRoomInBuilding: deleteRoomInBuildingHandler,
		})
	);

	app.use(errorHandler);

	return app;
}
