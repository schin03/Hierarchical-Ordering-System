import fs from "fs/promises";
import { expect } from "chai";
import request from "supertest";
import { StatusCodes } from "http-status-codes";
import { Application, createApp } from "../src/App";
import JSZip from "jszip";

import path from "path";

// TO RUN USE: yarn test:v2

const {
	OK, // 200
	// Other common codes are:
	CREATED, // 201
	ACCEPTED, // 202
	NO_CONTENT, // 204
	BAD_REQUEST, // 400
	NOT_FOUND, // 404
	UNPROCESSABLE_ENTITY, // 422
	REQUEST_TOO_LONG, // 413
} = StatusCodes;
// Do not change datadir
const datadir = "./data" as const;
describe("REST API v2", function () {
	let app: Application;
	beforeEach(async () => {
		app = await createApp({ datadir });
	});
	afterEach(async () => {
		await fs.rm(datadir, { recursive: true, force: true });
	});

	it("GET /api should respond with status OK and text 'App is running!'", async () => {
		const res = await request(app).get("/api");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.property("text", "App is running!");
	});
	// Buildings v2
	it("GET /api/v2/buildings should respond with status OK and empty items when no buildings exist", async () => {
		const res = await request(app).get("/api/v2/buildings");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			items: [],
			total: 0,
			limit: 100,
			offset: 0,
		});
	});

	it("GET /api/v2/buildings should return OK when given limit 10 and offset 5", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=10&offset=5");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			items: [],
			total: 0,
			limit: 10,
			offset: 5,
		});
	});

	it("GET /api/v2/buildings should return 400 when limit is less than 1", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=0");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
			},
		});
	});

	it("GET /api/v2/buildings should return 400 when limit exceeds 5000", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=5001");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
			},
		});
	});

	it("GET /api/v2/buildings should return 400 when offset is negative", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=100&offset=-1");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				offset: "expected an integer >= 0",
			},
		});
	});

	it("GET /api/v2/buildings should return 400 when both limit and offset are invalid", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=-1&offset=-1");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
				offset: "expected an integer >= 0",
			},
		});
	});

	it("GET /api/v2/buildings should return 400 when limit is not an integer", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=1.5");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
			},
		});
	});

	it("GET /api/v2/buildings should return 400 when limit is a string", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=abc");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
			},
		});
	});

	it("GET /api/v2/buildings should return correct total ignoring limit/offset", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=1&offset=0");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			items: [],
			total: 0,
			limit: 1,
			offset: 0,
		});
	});

	it("GET /api/v2/buildings should accept limit at boundary value 1", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			items: [],
			total: 0,
			limit: 1,
			offset: 0,
		});
	});

	it("GET /api/v2/buildings should accept limit at boundary value 5000", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=5000");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			items: [],
			total: 0,
			limit: 5000,
			offset: 0,
		});
	});

	it("GET /api/v2/buildings should accept offset at boundary value 0", async () => {
		const res = await request(app).get("/api/v2/buildings?offset=0");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			items: [],
			total: 0,
			limit: 100,
			offset: 0,
		});
	});

	it("GET /api/v2/buildings should accept offset at boundary value 0", async () => {
		const res = await request(app).get("/api/v2/buildings?offset=0");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			items: [],
			total: 0,
			limit: 100,
			offset: 0,
		});
	});
	// GET /api/v2/buildings list with data
	it("GET /api/v2/buildings should return buildings sorted by id ascending", async () => {
		await request(app).put("/api/v2/buildings/SWNG").send({
			name: "West Mall Swing Space",
			address: "2175 West Mall V6T 1Z4",
			lat: 49.26293,
			lon: -123.25431,
		});
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/ICCS").send({
			name: "Institute for Computing",
			address: "2366 Main Mall V6T 1Z4",
			lat: 49.26044,
			lon: -123.24886,
		});
		const res = await request(app).get("/api/v2/buildings");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 3,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "DMP",
					name: "Hugh Dempster Pavilion",
					address: "6245 Agronomy Road V6T 1Z4",
					lat: 49.26125,
					lon: -123.24807,
					links: {
						self: "/api/v2/buildings/DMP",
						rooms: "/api/v2/buildings/DMP/rooms",
					},
				},
				{
					id: "ICCS",
					name: "Institute for Computing",
					address: "2366 Main Mall V6T 1Z4",
					lat: 49.26044,
					lon: -123.24886,
					links: {
						self: "/api/v2/buildings/ICCS",
						rooms: "/api/v2/buildings/ICCS/rooms",
					},
				},
				{
					id: "SWNG",
					name: "West Mall Swing Space",
					address: "2175 West Mall V6T 1Z4",
					lat: 49.26293,
					lon: -123.25431,
					links: {
						self: "/api/v2/buildings/SWNG",
						rooms: "/api/v2/buildings/SWNG/rooms",
					},
				},
			],
		});
	});

	it("GET /api/v2/buildings with limit=1 should return first building and total=3", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/ICCS").send({
			name: "Institute for Computing",
			address: "2366 Main Mall V6T 1Z4",
			lat: 49.26044,
			lon: -123.24886,
		});
		await request(app).put("/api/v2/buildings/SWNG").send({
			name: "West Mall Swing Space",
			address: "2175 West Mall V6T 1Z4",
			lat: 49.26293,
			lon: -123.25431,
		});
		const res = await request(app).get("/api/v2/buildings?limit=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 3,
			limit: 1,
			offset: 0,
			items: [
				{
					id: "DMP",
					name: "Hugh Dempster Pavilion",
					address: "6245 Agronomy Road V6T 1Z4",
					lat: 49.26125,
					lon: -123.24807,
					links: {
						self: "/api/v2/buildings/DMP",
						rooms: "/api/v2/buildings/DMP/rooms",
					},
				},
			],
		});
	});

	it("GET /api/v2/buildings with offset=2 should skip first two buildings", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/ICCS").send({
			name: "Institute for Computing",
			address: "2366 Main Mall V6T 1Z4",
			lat: 49.26044,
			lon: -123.24886,
		});
		await request(app).put("/api/v2/buildings/SWNG").send({
			name: "West Mall Swing Space",
			address: "2175 West Mall V6T 1Z4",
			lat: 49.26293,
			lon: -123.25431,
		});
		const res = await request(app).get("/api/v2/buildings?offset=2");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 3,
			limit: 100,
			offset: 2,
			items: [
				{
					id: "SWNG",
					name: "West Mall Swing Space",
					address: "2175 West Mall V6T 1Z4",
					lat: 49.26293,
					lon: -123.25431,
					links: {
						self: "/api/v2/buildings/SWNG",
						rooms: "/api/v2/buildings/SWNG/rooms",
					},
				},
			],
		});
	});

	// GET /api/v2/buildings/{building}
	it("GET /api/v2/buildings/DMP should return NOT_FOUND when building does not exist", async () => {
		const res = await request(app).get("/api/v2/buildings/DMP");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	it("GET /api/v2/buildings/DMP should return OK with building info after creation", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		const res = await request(app).get("/api/v2/buildings/DMP");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "DMP",
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			links: {
				self: "/api/v2/buildings/DMP",
				rooms: "/api/v2/buildings/DMP/rooms",
			},
		});
	});

	it("GET /api/v2/buildings/NONEXIST should return NOT_FOUND when fetching wrong id with existing buildings", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		const res = await request(app).get("/api/v2/buildings/NONEXIST");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'NONEXIST'",
		});
	});

	//PUT /api/v2/buildings/{building}

	it("PUT /api/v2/buildings/DMP should return CREATED when building does not exist", async () => {
		const res = await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "DMP",
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			links: {
				self: "/api/v2/buildings/DMP",
				rooms: "/api/v2/buildings/DMP/rooms",
			},
		});
	});

	it("PUT /api/v2/buildings/DMP should return NO_CONTENT when building already exists", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		const res = await request(app).put("/api/v2/buildings/DMP").send({
			name: "Updated Dempster",
			address: "New Address",
			lat: 50.0,
			lon: -124.0,
		});
		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});
	});

	it("PUT /api/v2/buildings/DMP should update the building and GET returns new data", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Updated Dempster",
			address: "New Address 123",
			lat: 50.0,
			lon: -124.0,
		});
		const res = await request(app).get("/api/v2/buildings/DMP");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "DMP",
			name: "Updated Dempster",
			address: "New Address 123",
			lat: 50.0,
			lon: -124.0,
			links: {
				self: "/api/v2/buildings/DMP",
				rooms: "/api/v2/buildings/DMP/rooms",
			},
		});
	});

	it("PUT /api/v2/buildings/DMP with all fields missing should return UNPROCESSABLE_ENTITY", async () => {
		const res = await request(app).put("/api/v2/buildings/DMP").send({});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				name: "required but missing",
				address: "required but missing",
				lat: "required but missing",
				lon: "required but missing",
			},
		});
	});

	it("PUT /api/v2/buildings/DMP with wrong types should return UNPROCESSABLE_ENTITY", async () => {
		const res = await request(app).put("/api/v2/buildings/DMP").send({
			name: 123,
			address: 456,
			lat: "not a number",
			lon: "not a number",
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				name: "expected a string",
				address: "expected a string",
				lat: "expected a number",
				lon: "expected a number",
			},
		});
	});

	it("PUT /api/v2/buildings/DMP with partial fields missing should return UNPROCESSABLE_ENTITY", async () => {
		const res = await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			lat: 49.26125,
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				address: "required but missing",
				lon: "required but missing",
			},
		});
	});

	it("PUT /api/v2/buildings/DMP with mixed missing and wrong type should return UNPROCESSABLE_ENTITY", async () => {
		const res = await request(app).put("/api/v2/buildings/DMP").send({
			name: 999,
			address: "6245 Agronomy Road V6T 1Z4",
			lon: -123.24807,
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				name: "expected a string",
				lat: "required but missing",
			},
		});
	});

	// DELETE /api/v2/buildings/{building}
	it("DELETE /api/v2/buildings/DMP should return OK after deleting an existing building", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		const res = await request(app).delete("/api/v2/buildings/DMP");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "DMP",
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			rooms: 0,
		});
	});

	it("DELETE /api/v2/buildings/{buildingId} with rooms registered to building respond with OK and corresponding building info", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 67,
		});

		const res = await request(app).delete("/api/v2/buildings/DMP");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "DMP",
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			rooms: 2,
		});
	});

	it("DELETE /api/v2/buildings/DMP should return NOT_FOUND when building does not exist", async () => {
		const res = await request(app).delete("/api/v2/buildings/DMP");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	it("DELETE /api/v2/buildings/DMP should make GET return NOT_FOUND afterwards", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).delete("/api/v2/buildings/DMP");
		const res = await request(app).get("/api/v2/buildings/DMP");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	// tests for GET rooms
	it("GET /api/v2/buildings/{buildingId}/rooms should return OK and empty items when no rooms exist", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		const res = await request(app).get("/api/v2/buildings/DMP/rooms");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 0,
			limit: 100,
			offset: 0,
			items: [],
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms with rooms should respond with OK and corresponding sorted room list", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_103").send({
			building: "DMP",
			number: "103",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-103",
			seats: 69,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
			seats: 67,
		});

		const res = await request(app).get("/api/v2/buildings/DMP/rooms");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 3,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "DMP_101",
					building: "DMP",
					number: "101",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
					seats: 40,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_101",
						building: "/api/v2/buildings/DMP",
					},
				},
				{
					id: "DMP_102",
					building: "DMP",
					number: "102",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
					seats: 67,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_102",
						building: "/api/v2/buildings/DMP",
					},
				},
				{
					id: "DMP_103",
					building: "DMP",
					number: "103",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-103",
					seats: 69,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_103",
						building: "/api/v2/buildings/DMP",
					},
				},
			],
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms with specified offset should respond with OK and corresponding sorted room list", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_103").send({
			building: "DMP",
			number: "103",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-103",
			seats: 69,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
			seats: 67,
		});

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?offset=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 3,
			limit: 100,
			offset: 1,
			items: [
				{
					id: "DMP_102",
					building: "DMP",
					number: "102",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
					seats: 67,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_102",
						building: "/api/v2/buildings/DMP",
					},
				},
				{
					id: "DMP_103",
					building: "DMP",
					number: "103",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-103",
					seats: 69,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_103",
						building: "/api/v2/buildings/DMP",
					},
				},
			],
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms specified limit should respond with OK and corresponding sorted room list", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_103").send({
			building: "DMP",
			number: "103",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-103",
			seats: 69,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
			seats: 67,
		});

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?limit=2");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 3,
			limit: 2,
			offset: 0,
			items: [
				{
					id: "DMP_101",
					building: "DMP",
					number: "101",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
					seats: 40,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_101",
						building: "/api/v2/buildings/DMP",
					},
				},
				{
					id: "DMP_102",
					building: "DMP",
					number: "102",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
					seats: 67,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_102",
						building: "/api/v2/buildings/DMP",
					},
				},
			],
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms with specified offset and limit should respond with OK and corresponding sorted room list", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_103").send({
			building: "DMP",
			number: "103",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-103",
			seats: 69,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
			seats: 67,
		});

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?offset=1&limit=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 3,
			limit: 1,
			offset: 1,
			items: [
				{
					id: "DMP_102",
					building: "DMP",
					number: "102",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
					seats: 67,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_102",
						building: "/api/v2/buildings/DMP",
					},
				},
			],
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms with offset out of range of room amount with OK and corresponding sorted room list", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_103").send({
			building: "DMP",
			number: "103",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-103",
			seats: 69,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
			seats: 67,
		});

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?offset=2");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 3,
			limit: 100,
			offset: 2,
			items: [
				{
					id: "DMP_103",
					building: "DMP",
					number: "103",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-103",
					seats: 69,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_103",
						building: "/api/v2/buildings/DMP",
					},
				},
			],
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms with invalid offset and limit should respond with BAD_REQUEST and corresponding error body", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_103").send({
			building: "DMP",
			number: "103",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 69,
		});

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?offset=-1&limit=0");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
				offset: "expected an integer >= 0",
			},
		});
	});
	it("GET /api/v2/buildings/{buildingId}/rooms with invalid building should respond with NOT_FOUND and corresponding error body", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_103").send({
			building: "DMP",
			number: "103",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 69,
		});

		const res = await request(app).get("/api/v2/buildings/DMPy/rooms");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMPy'",
		});
	});
	// test for GET room
	it("GET /api/v2/buildings/{buildingId}/rooms/{roomid} with all required params should respond with OK and corresponding room info", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		const res = await request(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "DMP_101",
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
			links: {
				self: "/api/v2/buildings/DMP/rooms/DMP_101",
				building: "/api/v2/buildings/DMP",
			},
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms/{roomid} with incorrect building pathname should respond with NOT_FOUND and corresponding error body", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		const res = await request(app).get("/api/v2/buildings/DMPy/rooms/DMP_101");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMPy'",
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms/{roomid} with no pre-existing room should respond with NOT_FOUND and corresponding error body", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		const res = await request(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no room with id 'DMP_101' in building 'DMP'",
		});
	});

	// tests for PUT room
	it("PUT /api/v2/buildings/{buildingId}/rooms/{roomid} with all required params should respond with OK and corresponding room info", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "DMP_101",
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
			links: {
				self: "/api/v2/buildings/DMP/rooms/DMP_101",
				building: "/api/v2/buildings/DMP",
			},
		});
	});

	it("PUT /api/v2/buildings/{buildingId}/rooms/{roomid} with pre-existing room should respond with NO_CONTENT and GET{roomId} should respond with updated room info", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "DMPy",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101000",
			type: "Closed Design Specific Purpose",
			furniture: "Classroom-Nonmoveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 67,
		});

		let res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});

		res = await request(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "DMP_101",
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
			links: {
				self: "/api/v2/buildings/DMP/rooms/DMP_101",
				building: "/api/v2/buildings/DMP",
			},
		});
	});

	it("PUT /api/v2/buildings/{buildingId}/rooms/{roomid} without exisiting building should respond with NOT_FOUND and corresponding error message", async () => {
		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	it("PUT /api/v2/buildings/{buildingId}/rooms/{roomid} with missing params should respond with UNPROCESSABLE_ENTITY and corresponding error message", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				building: "required but missing",
				number: "required but missing",
				type: "required but missing",
				furniture: "required but missing",
				href: "required but missing",
				seats: "required but missing",
			},
		});
	});

	it("PUT /api/v2/buildings/{buildingId}/rooms/{roomid} with incorrect param types should respond with UNPROCESSABLE_ENTITY and corresponding error message", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: 10,
			number: 10,
			type: 10,
			furniture: 10,
			href: 10,
			seats: "10",
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				building: "expected a string",
				number: "expected a string",
				type: "expected a string",
				furniture: "expected a string",
				href: "expected a string",
				seats: "expected a number >= 0",
			},
		});
	});

	it("PUT /api/v2/buildings/{buildingId}/rooms/{roomid} with incorrect building name and invalid seat value types should respond with UNPROCESSABLE_ENTITY and corresponding error message", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMPy",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: -10,
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				building: "must match parent building in path",
				seats: "expected a number >= 0",
			},
		});
	});

	// tests for DELETE room
	it("DELETE /api/v2/buildings/{buildingId}/rooms/{roomid} with existing room should respond with OK and corresponding room info", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		const res = await request(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "DMP_101",
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
	});

	it("DELETE /api/v2/buildings/{buildingId}/rooms/{roomid} without correct roomid should respond with NOT_FOUND and corresponding error body", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		const res = await request(app).delete("/api/v2/buildings/DMP/rooms/101_DMP");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no room with id '101_DMP' in building 'DMP'",
		});
	});

	it("DELETE /api/v2/buildings/{buildingId}/rooms/{roomid} without correct buildingid should respond with NOT_FOUND and corresponding error body", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		const res = await request(app).delete("/api/v2/buildings/DMPy/rooms/101_DMP");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMPy'",
		});
	});

	it("DELETE /api/v2/buildings/{buildingId}/rooms/{roomid} twice should return NOT_FOUND on second delete", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
		await request(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
		const res = await request(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no room with id 'DMP_101' in building 'DMP'",
		});
	});

	it("DELETE /api/v2/buildings/{buildingId}/rooms/{roomid} should remove room from building rooms list", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
			seats: 67,
		});
		await request(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
		const res = await request(app).get("/api/v2/buildings/DMP/rooms");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 1,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "DMP_102",
					building: "DMP",
					number: "102",
					type: "Open Design General Purpose",
					furniture: "Classroom-Moveable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-102",
					seats: 67,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_102",
						building: "/api/v2/buildings/DMP",
					},
				},
			],
		});
	});

	it("DELETE /api/v2/buildings/{buildingId} should also remove all rooms from the data store", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
		await request(app).delete("/api/v2/buildings/DMP");
		// Recreate the building and verify rooms are gone
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		const res = await request(app).get("/api/v2/buildings/DMP/rooms");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 0,
			limit: 100,
			offset: 0,
			items: [],
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms with invalid params and non-existent building should return BAD_REQUEST", async () => {
		const res = await request(app).get("/api/v2/buildings/NONEXIST/rooms?limit=0&offset=-1");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
				offset: "expected an integer >= 0",
			},
		});
	});

	it("GET /api/v2/buildings/{buildingId}/rooms with valid params and non-existent building should return NOT_FOUND", async () => {
		const res = await request(app).get("/api/v2/buildings/NONEXIST/rooms?limit=10&offset=0");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'NONEXIST'",
		});
	});

	it("DELETE /api/v2/buildings/{buildingId} twice should return NOT_FOUND on second delete", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).delete("/api/v2/buildings/DMP");
		const res = await request(app).delete("/api/v2/buildings/DMP");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	it("PUT /api/v2/buildings/{buildingId}/rooms/{roomid} update preserves room in building list", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Lecture Hall",
			furniture: "Fixed Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 100,
		});
		const res = await request(app).get("/api/v2/buildings/DMP/rooms");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 1,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "DMP_101",
					building: "DMP",
					number: "101",
					type: "Lecture Hall",
					furniture: "Fixed Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
					seats: 100,
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_101",
						building: "/api/v2/buildings/DMP",
					},
				},
			],
		});
	});

	// ── seats integer validation ────────────────────────────────────────────
	it("PUT /api/v2/buildings/{buildingId}/rooms/{roomId} should reject float seats with 422", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 1.5,
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { seats: "expected a number >= 0" },
		});
	});

	it("PUT /api/v2/buildings/{buildingId}/rooms/{roomId} should accept seats = 0", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 0,
		});
		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "DMP_101",
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Moveable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 0,
			links: {
				self: "/api/v2/buildings/DMP/rooms/DMP_101",
				building: "/api/v2/buildings/DMP",
			},
		});
	});

	// ── POST /api/v2/datasets validation ───────────────────────────────────
	it("POST /api/v2/datasets should reject missing kind with 422", async () => {
		const zip = new JSZip();
		zip.file("index.htm", "<html></html>");
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app).post("/api/v2/datasets").attach("archive", buf, "test.zip");
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { kind: "required but missing" },
		});
	});

	it("POST /api/v2/datasets should reject invalid kind with 422", async () => {
		const zip = new JSZip();
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "unknown_kind")
			.attach("archive", buf, "test.zip");
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { kind: "expected to be course_offerings or facilities" },
		});
	});

	it("POST /api/v2/datasets should reject missing archive with 422", async () => {
		const res = await request(app).post("/api/v2/datasets").field("kind", "facilities");
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { archive: "required but missing" },
		});
	});

	it("POST /api/v2/datasets should accept course_offerings and return 202", async () => {
		const zip = new JSZip();
		zip.folder("courses");
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", buf, "data.zip");
		expect(res).to.have.property("status", ACCEPTED);
		expect(res).to.have.deep.property("body", {
			id: "data.zip",
			status: "processing",
			kind: "course_offerings",
			message: "Dataset accepted for processing",
		});
	});

	it("POST /api/v2/datasets should accept facilities and return 202", async () => {
		const zip = new JSZip();
		zip.file("index.htm", "<html></html>");
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", buf, "campus.zip");
		expect(res).to.have.property("status", ACCEPTED);
		expect(res).to.have.deep.property("body", {
			id: "campus.zip",
			status: "processing",
			kind: "facilities",
			message: "Dataset accepted for processing",
		});
	});

	it("GET /api/v2/datasets/:id should return 404 for unknown job", async () => {
		const res = await request(app).get("/api/v2/datasets/no-such-job.zip");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no upload job with id 'no-such-job.zip'",
		});
	});

	it("POST /api/v2/dataset upload Facilities job fails with incorrect data.", async () => {
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", Buffer.from("not a zip"), "bad.zip");
		expect(res).to.have.property("status", ACCEPTED);
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "bad.zip",
			status: "failed",
			kind: "facilities",
			message: "Data is not in a valid zip format",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 0,
				buildings_added: 0,
				buildings_modified: 0,
				rooms_seen: 0,
				rooms_added: 0,
				rooms_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets facilities job fails when index.htm is missing", async () => {
		const zip = new JSZip();
		zip.file("other.htm", "<html></html>");
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", buf, "campus.zip");
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes!.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "campus.zip",
			status: "failed",
			kind: "facilities",
			message: "Missing index.htm file",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 0,
				buildings_added: 0,
				buildings_modified: 0,
				rooms_seen: 0,
				rooms_added: 0,
				rooms_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets facilities job fails when no building table in index.htm", async () => {
		const zip = new JSZip();
		zip.file("index.htm", "<html><body><p>no table</p></body></html>");
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", buf, "campus.zip");
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes!.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "campus.zip",
			status: "failed",
			kind: "facilities",
			message: "No building table found in index.htm",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 0,
				buildings_added: 0,
				buildings_modified: 0,
				rooms_seen: 0,
				rooms_added: 0,
				rooms_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets should reject empty archive with 422", async () => {
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", Buffer.alloc(0), "empty.zip");
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { archive: "expected non-empty file" },
		});
	});

	it("POST /api/v2/datasets facilities job skips building row with <a> missing href", async () => {
		const zip = new JSZip();
		zip.file(
			"index.htm",
			`<!DOCTYPE html><html><head><title>Buildings</title></head><body>
			<table class="views-table cols-5 table">
			<thead><tr>
				<th class="views-field views-field-field-building-image"></th>
				<th class="views-field views-field-field-building-code">Code</th>
				<th class="views-field views-field-title">Building</th>
				<th class="views-field views-field-field-building-address">Address</th>
				<th class="views-field views-field-nothing"></th>
			</tr></thead>
			<tbody>
				<tr class="odd views-row-first">
					<td class="views-field views-field-field-building-image"><img src="http://dummyimage.com/60x50" alt="img"></td>
					<td class="views-field views-field-field-building-code">DMP</td>
					<td class="views-field views-field-title"><a>No href here</a></td>
					<td class="views-field views-field-field-building-address">6245 Agronomy Road V6T 1Z4</td>
					<td class="views-field views-field-nothing"><a>More info</a></td>
				</tr>
			</tbody></table>
			</body></html>`
		);
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", buf, "campus.zip");
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes!.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "campus.zip",
			status: "completed",
			kind: "facilities",
			message: "Dataset processing complete",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 0,
				buildings_added: 0,
				buildings_modified: 0,
				rooms_seen: 0,
				rooms_added: 0,
				rooms_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets facilities job skips building row missing title cell", async () => {
		const zip = new JSZip();
		zip.file(
			"index.htm",
			`<html><body>
			<table class="views-table"><tbody>
				<tr>
					<td class="views-field-field-building-code">DMP</td>
					<td class="views-field-field-building-address">6245 Agronomy Road V6T 1Z4</td>
				</tr>
			</tbody></table>
			</body></html>`
		);
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", buf, "campus.zip");
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes!.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "campus.zip",
			status: "completed",
			kind: "facilities",
			message: "Dataset processing complete",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 0,
				buildings_added: 0,
				buildings_modified: 0,
				rooms_seen: 0,
				rooms_added: 0,
				rooms_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets facilities should track buildings_seen and skip when geo fails", async () => {
		const zip = new JSZip();
		zip.file(
			"index.htm",
			`<html><body>
			<table class="views-table"><tbody>
				<tr>
					<td class="views-field-title"><a href="./campus/DMP/index.htm">Hugh Dempster Pavilion</a></td>
					<td class="views-field-field-building-code">DMP</td>
					<td class="views-field-field-building-address">NOT A REAL ADDRESS XYZZY 99999</td>
				</tr>
			</tbody></table>
			</body></html>`
		);
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", buf, "campus.zip");
		expect(res).to.have.property("status", ACCEPTED);
		expect(res).to.have.deep.property("body", {
			id: "campus.zip",
			status: "processing",
			kind: "facilities",
			message: "Dataset accepted for processing",
		});
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 40; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes!.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 100));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "campus.zip",
			status: "completed",
			kind: "facilities",
			message: "Dataset processing complete",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 1,
				buildings_added: 0,
				buildings_modified: 0,
				rooms_seen: 0,
				rooms_added: 0,
				rooms_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets facilities should skip building when linked room file not in zip", async () => {
		const zip = new JSZip();
		zip.file(
			"index.htm",
			`<html><body>
			<table class="views-table"><tbody>
				<tr>
					<td class="views-field-title"><a href="./campus/DMP/index.htm">Hugh Dempster Pavilion</a></td>
					<td class="views-field-field-building-code">DMP</td>
					<td class="views-field-field-building-address">NOT A REAL ADDRESS XYZZY 99999</td>
				</tr>
			</tbody></table>
			</body></html>`
		);
		// campus/DMP/index.htm NOT added — building still valid but no rooms
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", buf, "campus.zip");
		expect(res).to.have.property("status", ACCEPTED);
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 40; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes!.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 100));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "campus.zip",
			status: "completed",
			kind: "facilities",
			message: "Dataset processing complete",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 1,
				buildings_added: 0,
				buildings_modified: 0,
				rooms_seen: 0,
				rooms_added: 0,
				rooms_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets facilities should skip rooms when building file has no views-table", async () => {
		const zip = new JSZip();
		zip.file(
			"index.htm",
			`<html><body>
			<table class="views-table"><tbody>
				<tr>
					<td class="views-field-title"><a href="./campus/DMP/index.htm">Hugh Dempster Pavilion</a></td>
					<td class="views-field-field-building-code">DMP</td>
					<td class="views-field-field-building-address">NOT A REAL ADDRESS XYZZY 99999</td>
				</tr>
			</tbody></table>
			</body></html>`
		);
		zip.file("campus/DMP/index.htm", "<html><body><p>no room table here</p></body></html>");
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", buf, "campus.zip");
		expect(res).to.have.property("status", ACCEPTED);
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 40; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes!.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 100));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "campus.zip",
			status: "completed",
			kind: "facilities",
			message: "Dataset processing complete",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 1,
				buildings_added: 0,
				buildings_modified: 0,
				rooms_seen: 0,
				rooms_added: 0,
				rooms_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets facilities should load building and rooms with valid geo", async function () {
		this.timeout(15000);
		const campusZipPath = path.resolve("test/resources/campus-test.zip");
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", campusZipPath);
		expect(res).to.have.property("status", ACCEPTED);
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 100; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes!.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 150));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "campus-test.zip",
			status: "completed",
			kind: "facilities",
			message: "Dataset processing complete",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 2,
				buildings_added: 2,
				buildings_modified: 0,
				rooms_seen: 6,
				rooms_added: 6,
				rooms_modified: 0,
			},
		});

		const buildingRes = await request(app).get("/api/v2/buildings/DMP");
		expect(buildingRes).to.have.property("status", OK);
		expect(buildingRes).to.have.deep.property("body", {
			id: "DMP",
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			links: {
				self: "/api/v2/buildings/DMP",
				rooms: "/api/v2/buildings/DMP/rooms",
			},
		});

		const roomsRes = await request(app).get("/api/v2/buildings/DMP/rooms");
		expect(roomsRes).to.have.property("status", OK);
		expect(roomsRes).to.have.deep.property("body", {
			total: 3,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "DMP_101",
					building: "DMP",
					number: "101",
					seats: 40,
					furniture: "Classroom-Movable Tables & Chairs",
					type: "Small Group",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_101",
						building: "/api/v2/buildings/DMP",
					},
				},
				{
					id: "DMP_201",
					building: "DMP",
					number: "201",
					seats: 120,
					furniture: "Classroom-Fixed Tables/Movable Chairs",
					type: "Tiered Large Group",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-201",
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_201",
						building: "/api/v2/buildings/DMP",
					},
				},
				{
					id: "DMP_301",
					building: "DMP",
					number: "301",
					seats: 25,
					furniture: "Classroom-Movable Tables & Chairs",
					type: "Open Design General Purpose",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-301",
					links: {
						self: "/api/v2/buildings/DMP/rooms/DMP_301",
						building: "/api/v2/buildings/DMP",
					},
				},
			],
		});

		const anguRes = await request(app).get("/api/v2/buildings/ANGU");
		expect(anguRes).to.have.property("status", OK);
		expect(anguRes).to.have.deep.property("body", {
			id: "ANGU",
			name: "Henry Angus",
			address: "2053 Main Mall",
			lat: 49.26486,
			lon: -123.25364,
			links: {
				self: "/api/v2/buildings/ANGU",
				rooms: "/api/v2/buildings/ANGU/rooms",
			},
		});

		const anguRoomsRes = await request(app).get("/api/v2/buildings/ANGU/rooms");
		expect(anguRoomsRes).to.have.property("status", OK);
		expect(anguRoomsRes).to.have.deep.property("body", {
			total: 3,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "ANGU_037",
					building: "ANGU",
					number: "037",
					seats: 54,
					furniture: "Classroom-Fixed Tables/Movable Chairs",
					type: "Case Style",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ANGU-037",
					links: {
						self: "/api/v2/buildings/ANGU/rooms/ANGU_037",
						building: "/api/v2/buildings/ANGU",
					},
				},
				{
					id: "ANGU_098",
					building: "ANGU",
					number: "098",
					seats: 260,
					furniture: "Classroom-Fixed Tables/Movable Chairs",
					type: "Tiered Large Group",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ANGU-098",
					links: {
						self: "/api/v2/buildings/ANGU/rooms/ANGU_098",
						building: "/api/v2/buildings/ANGU",
					},
				},
				{
					id: "ANGU_232",
					building: "ANGU",
					number: "232",
					seats: 16,
					furniture: "Classroom-Movable Tables & Chairs",
					type: "Small Group",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ANGU-232",
					links: {
						self: "/api/v2/buildings/ANGU/rooms/ANGU_232",
						building: "/api/v2/buildings/ANGU",
					},
				},
			],
		});
	});

	it("POST /api/v2/datasets facilities should update existing building on re-upload", async function () {
		this.timeout(15000);
		// Pre-create DMP with stale data so the upload triggers a modification
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Old Name",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 0,
			lon: 0,
		});
		const campusZipPath = path.resolve("test/resources/campus-test.zip");
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", campusZipPath);
		expect(res).to.have.property("status", ACCEPTED);
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 100; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes!.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 150));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "campus-test.zip",
			status: "completed",
			kind: "facilities",
			message: "Dataset processing complete",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				buildings_seen: 2,
				buildings_added: 1,
				buildings_modified: 1,
				rooms_seen: 6,
				rooms_added: 6,
				rooms_modified: 0,
			},
		});

		const buildingRes = await request(app).get("/api/v2/buildings/DMP");
		expect(buildingRes).to.have.property("status", OK);
		expect(buildingRes).to.have.deep.property("body", {
			id: "DMP",
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			links: {
				self: "/api/v2/buildings/DMP",
				rooms: "/api/v2/buildings/DMP/rooms",
			},
		});
	});

	// ── POST /api/v2/datasets course_offerings processing ─────────────────

	it("POST /api/v2/datasets course_offerings job completes with valid data", async () => {
		const zip = new JSZip();
		zip.folder("courses");
		zip.file(
			"courses/cpsc310.json",
			JSON.stringify({
				result: [
					{
						id: "12345",
						Course: "310",
						Title: "Software Engineering",
						Professor: "Reid Holmes",
						Subject: "CPSC",
						Section: "101",
						Year: "2024",
						Avg: 85.5,
						Pass: 150,
						Fail: 5,
						Audit: 2,
					},
				],
			})
		);
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", buf, "data.zip");
		expect(res).to.have.property("status", ACCEPTED);
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "data.zip",
			status: "completed",
			kind: "course_offerings",
			message: "Dataset processing complete",
			stats: {
				files_total: 1,
				files_processed: 1,
				files_skipped: 0,
				courses_seen: 1,
				courses_added: 1,
				courses_modified: 0,
				sections_seen: 1,
				sections_added: 1,
				sections_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets course_offerings job updates existing course and section", async () => {
		const offering = {
			id: "12345",
			Course: "310",
			Title: "Software Engineering",
			Professor: "Reid Holmes",
			Subject: "CPSC",
			Section: "101",
			Year: "2024",
			Avg: 85.5,
			Pass: 150,
			Fail: 5,
			Audit: 2,
		};

		// First upload — creates course and section
		let zip = new JSZip();
		zip.folder("courses");
		zip.file("courses/cpsc310.json", JSON.stringify({ result: [offering] }));
		let buf = await zip.generateAsync({ type: "nodebuffer" });
		let res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", buf, "first.zip");
		let jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!.body.status).to.equal("completed");

		// Second upload — same IDs, different title and instructor
		const updated = { ...offering, Title: "SW Engineering", Professor: "Gregor Kiczales" };
		zip = new JSZip();
		zip.folder("courses");
		zip.file("courses/cpsc310.json", JSON.stringify({ result: [updated] }));
		buf = await zip.generateAsync({ type: "nodebuffer" });
		res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", buf, "second.zip");
		expect(res).to.have.property("status", ACCEPTED);
		jobId = res.body.id;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "second.zip",
			status: "completed",
			kind: "course_offerings",
			message: "Dataset processing complete",
			stats: {
				files_total: 1,
				files_processed: 1,
				files_skipped: 0,
				courses_seen: 1,
				courses_added: 0,
				courses_modified: 1,
				sections_seen: 1,
				sections_added: 0,
				sections_modified: 1,
			},
		});
	});

	it("POST /api/v2/datasets course_offerings skips invalid JSON and records with missing fields", async () => {
		const zip = new JSZip();
		zip.folder("courses");
		zip.file("courses/bad.json", "not valid json");
		zip.file(
			"courses/missing_fields.json",
			JSON.stringify({
				result: [
					{ id: "1", Course: "310" }, // missing required fields
				],
			})
		);
		zip.file(
			"courses/good.json",
			JSON.stringify({
				result: [
					{
						id: "99999",
						Course: "110",
						Title: "Computation, Programs, and Programming",
						Professor: "Mike Feeley",
						Subject: "CPSC",
						Section: "101",
						Year: "2023",
						Avg: 75.0,
						Pass: 200,
						Fail: 10,
						Audit: 5,
					},
				],
			})
		);
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", buf, "mixed.zip");
		expect(res).to.have.property("status", ACCEPTED);
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "mixed.zip",
			status: "completed",
			kind: "course_offerings",
			message: "Dataset processing complete",
			stats: {
				files_total: 3,
				files_processed: 2,
				files_skipped: 1,
				courses_seen: 1,
				courses_added: 1,
				courses_modified: 0,
				sections_seen: 1,
				sections_added: 1,
				sections_modified: 0,
			},
		});
	});

	it("POST /api/v2/datasets course_offerings fails when courses/ directory is missing", async () => {
		const zip = new JSZip();
		zip.file("other/file.json", "{}");
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", buf, "nocourses.zip");
		expect(res).to.have.property("status", ACCEPTED);
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "nocourses.zip",
			status: "failed",
			kind: "course_offerings",
			message: "Missing root courses directory",
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
		});
	});

	it("POST /api/v2/datasets course_offerings handles overall section (year = 1900)", async () => {
		const zip = new JSZip();
		zip.folder("courses");
		zip.file(
			"courses/cpsc310.json",
			JSON.stringify({
				result: [
					{
						id: "overall-1",
						Course: "310",
						Title: "Software Engineering",
						Professor: "",
						Subject: "CPSC",
						Section: "overall",
						Year: "2024",
						Avg: 80.0,
						Pass: 300,
						Fail: 10,
						Audit: 5,
					},
				],
			})
		);
		const buf = await zip.generateAsync({ type: "nodebuffer" });
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", buf, "overall.zip");
		expect(res).to.have.property("status", ACCEPTED);
		const jobId = res.body.id;
		let jobRes;
		for (let i = 0; i < 20; i++) {
			jobRes = await request(app).get(`/api/v2/datasets/${jobId}`);
			if (jobRes.body.status !== "processing") break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(jobRes!).to.have.property("status", OK);
		expect(jobRes!).to.have.deep.property("body", {
			id: "overall.zip",
			status: "completed",
			kind: "course_offerings",
			message: "Dataset processing complete",
			stats: {
				files_total: 1,
				files_processed: 1,
				files_skipped: 0,
				courses_seen: 1,
				courses_added: 1,
				courses_modified: 0,
				sections_seen: 1,
				sections_added: 1,
				sections_modified: 0,
			},
		});
	});

	// search for v2
	it("POST /api/v2/search should return all courses when WHERE is empty", async () => {
		// Create some test data first - need a course WITH a section to appear in search
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Software Engineering",
			dept: "CPSC",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/001").send({
			instructor: "Reid Holmes",
			year: 2024,
			avg: 80,
			pass: 100,
			fail: 5,
			audit: 0,
		});
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["dept", "code", "title"],
					},
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				dept: "CPSC",
				code: "310",
				title: "Software Engineering",
			},
		]);
	});

	it("POST /api/v2/search should return all buildings when WHERE is empty", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_110").send({
			building: "DMP",
			number: "110",
			seats: 120,
			type: "Tiered Large Group",
			furniture: "Classroom-Fixed Tables/Fixed Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-110",
		});
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["name", "address", "lat", "lon"],
					},
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				name: "Hugh Dempster Pavilion",
				address: "6245 Agronomy Road V6T 1Z4",
				lat: 49.26125,
				lon: -123.24807,
			},
		]);
	});

	it("POST /api/v2/search should return all rooms when WHERE is empty", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_110").send({
			building: "DMP",
			number: "110",
			seats: 120,
			type: "Tiered Large Group",
			furniture: "Classroom-Fixed Tables/Fixed Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-110",
		});
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["name", "address", "lat", "lon"],
					},
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				name: "Hugh Dempster Pavilion",
				address: "6245 Agronomy Road V6T 1Z4",
				lat: 49.26125,
				lon: -123.24807,
			},
		]);
	});

	it("POST /api/v2/search should return building, num, and all seats with > 50 when WHERE is empty", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Lecture Hall",
			furniture: "Fixed Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 100,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Lecture Hall",
			furniture: "Fixed Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 49,
		});

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						GT: {
							seats: 50,
						},
					},
					OPTIONS: {
						COLUMNS: ["seats", "number", "building"],
					},
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				building: "DMP",
				number: "101",
				seats: 100,
			},
		]);
	});

	it("POST /api/v2/search should return min of all seats in building", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Lecture Hall",
			furniture: "Fixed Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 100,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Lecture Hall",
			furniture: "Fixed Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 50,
		});

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["building", "minSeats"],
					},
					TRANSFORMATIONS: {
						GROUP: ["building"],
						APPLY: [
							{
								minSeats: {
									MIN: "seats",
								},
							},
						],
					},
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				building: "DMP",
				minSeats: 50,
			},
		]);
	});

	it("POST /api/v2/search should return avg of all seats in building", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Lecture Hall",
			furniture: "Fixed Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 100,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
			building: "DMP",
			number: "102",
			type: "Lecture Hall",
			furniture: "Fixed Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 50,
		});

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["building", "avgSeats"],
					},
					TRANSFORMATIONS: {
						GROUP: ["building"],
						APPLY: [
							{
								avgSeats: {
									AVG: "seats",
								},
							},
						],
					},
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				building: "DMP",
				avgSeats: 75,
			},
		]);
	});

	it("POST /api/v2/search should return 400 for ORDER string not in COLUMNS", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["dept"],
						ORDER: "avg",
					},
				},
			});

		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "ORDER must be a key in COLUMNS",
		});
	});

	it("POST /api/v2/search should return 400 for ORDER object keys not in COLUMNS", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
						ORDER: { dir: "UP", keys: ["year"] },
					},
				},
			});

		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "All ORDER keys must be in COLUMNS",
		});
	});

	it("POST /api/v2/search should return 400 for invalid sort direction", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
						ORDER: { dir: "ASC", keys: ["avg"] },
					},
				},
			});

		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Invalid sort direction (must be UP or DOWN)",
		});
	});

	it("POST /api/v2/search should return 400 when WHERE has more than one FILTER", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {
						GT: { avg: 90 },
						LT: { avg: 100 },
					},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
					},
				},
			});

		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "WHERE must be an object with at most one FILTER",
		});
	});

	it("POST /api/v2/search should return 400 when AND is empty", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { AND: [] },
					OPTIONS: { COLUMNS: ["dept", "avg"] },
				},
			});

		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "AND must be a non-empty array of FILTER objects",
		});
	});

	it("POST /api/v2/search should return 400 for invalid IS wildcard position", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { IS: { dept: "c*sc" } },
					OPTIONS: { COLUMNS: ["dept"] },
				},
			});

		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "IS asterisks can only be first or last character",
		});
	});

	it("POST /api/v2/search should return 400 when mixing facilities fields into course query", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { GT: { seats: 10 } },
					OPTIONS: { COLUMNS: ["dept"] },
				},
			});

		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Cannot mix course_offerings and facilities fields in one query",
		});
	});

	// --- Branch coverage tests ---

	it("POST /api/v2/search should return 422 when kind is invalid", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "invalid",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { kind: "expected to be course_offerings or facilities" },
		});
	});

	it("POST /api/v2/search should return 422 when query is not an object", async () => {
		const res = await request(app).post("/api/v2/search").send({
			kind: "course_offerings",
			query: "not an object",
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { query: "expected an object" },
		});
	});

	it("POST /api/v2/search should return 422 when kind and query are both missing", async () => {
		const res = await request(app).post("/api/v2/search").send({});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { kind: "required but missing", query: "required but missing" },
		});
	});

	it("POST /api/v2/search should return 400 for Missing OPTIONS", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {} },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing OPTIONS",
		});
	});

	it("POST /api/v2/search should return 400 for Missing COLUMNS", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: {} },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing COLUMNS",
		});
	});

	it("POST /api/v2/search should return 400 for invalid OPTIONS structure", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"], EXTRA: true } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "OPTIONS must be an object with COLUMNS and optional ORDER",
		});
	});

	it("POST /api/v2/search should return 400 for Unknown key in COLUMNS", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["invalid_col"] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Unknown key in COLUMNS",
		});
	});

	it("POST /api/v2/search should return 400 for ORDER object with empty keys", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"], ORDER: { dir: "UP", keys: [] } } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "All ORDER keys must be in COLUMNS",
		});
	});

	it("POST /api/v2/search should return 400 for ORDER that is not string or object", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"], ORDER: 123 } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "OPTIONS must be an object with COLUMNS and optional ORDER",
		});
	});

	it("POST /api/v2/search should return 400 for NOT with invalid value", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { NOT: "invalid" }, OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "NOT must be a FILTER object",
		});
	});

	it("POST /api/v2/search should return 400 for unknown filter operator", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { FOO: { avg: 50 } }, OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "WHERE must be an object with at most one FILTER",
		});
	});

	it("POST /api/v2/search should return 400 for GT with invalid structure", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { GT: "invalid" }, OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "GT must be an object with one mfield of type number",
		});
	});

	it("POST /api/v2/search should return 400 for GT with sfield", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { GT: { dept: 5 } }, OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "GT must be an object with one mfield of type number",
		});
	});

	it("POST /api/v2/search should return 400 for IS with mfield", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { IS: { avg: "test" } }, OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "IS must be an object with one sfield of type string",
		});
	});

	it("POST /api/v2/search should return 400 for IS with invalid structure", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { IS: 42 }, OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "IS must be an object with one sfield of type string",
		});
	});

	it("POST /api/v2/search should return 400 for Missing GROUP in TRANSFORMATIONS", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"] }, TRANSFORMATIONS: { APPLY: [] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing GROUP in TRANSFORMATIONS",
		});
	});

	it("POST /api/v2/search should return 400 for Missing APPLY in TRANSFORMATIONS", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"] }, TRANSFORMATIONS: { GROUP: ["dept"] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing APPLY in TRANSFORMATIONS",
		});
	});

	it("POST /api/v2/search should return 400 for GROUP must be non-empty array", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"] }, TRANSFORMATIONS: { GROUP: [], APPLY: [] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "GROUP must be a non-empty array",
		});
	});

	it("POST /api/v2/search should return 400 for APPLY must be an array", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"] }, TRANSFORMATIONS: { GROUP: ["dept"], APPLY: "bad" } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "APPLY must be an array",
		});
	});

	it("POST /api/v2/search should return 400 for invalid GROUP key", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"] }, TRANSFORMATIONS: { GROUP: ["badkey"], APPLY: [] } },
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Unknown key in COLUMNS",
		});
	});

	it("POST /api/v2/search should return 400 for applykey with underscore", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept", "bad_key"] },
					TRANSFORMATIONS: { GROUP: ["dept"], APPLY: [{ bad_key: { MAX: "avg" } }] },
				},
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "applykey cannot be empty or contain underscore",
		});
	});

	it("POST /api/v2/search should return 400 for duplicate applykey", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept", "maxAvg"] },
					TRANSFORMATIONS: {
						GROUP: ["dept"],
						APPLY: [{ maxAvg: { MAX: "avg" } }, { maxAvg: { MIN: "avg" } }],
					},
				},
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Duplicate applykey in APPLY",
		});
	});

	it("POST /api/v2/search should return 400 when COLUMNS not in GROUP or APPLY", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept", "avg"] },
					TRANSFORMATIONS: { GROUP: ["dept"], APPLY: [] },
				},
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY",
		});
	});

	it("POST /api/v2/search should return 400 for APPLYRULE with invalid KEY", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept", "maxVal"] },
					TRANSFORMATIONS: { GROUP: ["dept"], APPLY: [{ maxVal: { MAX: "badfield" } }] },
				},
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "APPLYRULE must apply aggregation to a valid KEY",
		});
	});

	it("POST /api/v2/search should return 400 for AVG on sfield", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept", "avgTitle"] },
					TRANSFORMATIONS: { GROUP: ["dept"], APPLY: [{ avgTitle: { AVG: "title" } }] },
				},
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "MAX/MIN/AVG/SUM can only be applied to mfields",
		});
	});

	it("POST /api/v2/search should return 400 for invalid APPLYTOKEN", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept", "result"] },
					TRANSFORMATIONS: { GROUP: ["dept"], APPLY: [{ result: { INVALID: "avg" } }] },
				},
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Invalid APPLYTOKEN (must be MAX, MIN, AVG, COUNT, or SUM)",
		});
	});

	it("POST /api/v2/search should support MAX aggregation", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			seats: 100,
			type: "Lecture",
			furniture: "Fixed",
			href: "http://example.com/101",
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_201").send({
			building: "DMP",
			number: "201",
			seats: 200,
			type: "Lecture",
			furniture: "Fixed",
			href: "http://example.com/201",
		});
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["name", "maxSeats"], ORDER: { dir: "DOWN", keys: ["maxSeats"] } },
					TRANSFORMATIONS: { GROUP: ["name"], APPLY: [{ maxSeats: { MAX: "seats" } }] },
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ name: "Hugh Dempster Pavilion", maxSeats: 200 }]);
	});

	it("POST /api/v2/search should support SUM and COUNT aggregation", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			seats: 100,
			type: "Lecture",
			furniture: "Fixed",
			href: "http://example.com/101",
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_201").send({
			building: "DMP",
			number: "201",
			seats: 200,
			type: "Lecture",
			furniture: "Movable",
			href: "http://example.com/201",
		});
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["name", "totalSeats", "numFurniture"] },
					TRANSFORMATIONS: {
						GROUP: ["name"],
						APPLY: [{ totalSeats: { SUM: "seats" } }, { numFurniture: { COUNT: "furniture" } }],
					},
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ name: "Hugh Dempster Pavilion", totalSeats: 300, numFurniture: 2 }]);
	});

	it("POST /api/v2/search should support LT and EQ filters", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({ title: "SE", dept: "CPSC", code: "310" });
		await request(app).put("/api/v1/courses/cpsc310/sections/001").send({
			instructor: "Reid",
			year: 2024,
			avg: 75,
			pass: 100,
			fail: 5,
			audit: 0,
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/002").send({
			instructor: "Gregor",
			year: 2024,
			avg: 90,
			pass: 80,
			fail: 2,
			audit: 1,
		});
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { LT: { avg: 80 } }, OPTIONS: { COLUMNS: ["avg", "instructor"] } },
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ avg: 75, instructor: "Reid" }]);
	});

	it("POST /api/v2/search should support EQ filter", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({ title: "SE", dept: "CPSC", code: "310" });
		await request(app).put("/api/v1/courses/cpsc310/sections/001").send({
			instructor: "Reid",
			year: 2024,
			avg: 75,
			pass: 100,
			fail: 5,
			audit: 0,
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/002").send({
			instructor: "Gregor",
			year: 2024,
			avg: 90,
			pass: 80,
			fail: 2,
			audit: 1,
		});
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { EQ: { avg: 90 } }, OPTIONS: { COLUMNS: ["avg", "instructor"] } },
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ avg: 90, instructor: "Gregor" }]);
	});

	it("POST /api/v2/search should support OR and NOT filters", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({ title: "SE", dept: "CPSC", code: "310" });
		await request(app).put("/api/v1/courses/cpsc310/sections/001").send({
			instructor: "Reid",
			year: 2024,
			avg: 75,
			pass: 100,
			fail: 5,
			audit: 0,
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/002").send({
			instructor: "Gregor",
			year: 2024,
			avg: 90,
			pass: 80,
			fail: 2,
			audit: 1,
		});
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { OR: [{ GT: { avg: 89 } }, { LT: { avg: 76 } }] },
					OPTIONS: { COLUMNS: ["avg"], ORDER: { dir: "UP", keys: ["avg"] } },
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ avg: 75 }, { avg: 90 }]);
	});

	it("POST /api/v2/search should support NOT filter", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({ title: "SE", dept: "CPSC", code: "310" });
		await request(app).put("/api/v1/courses/cpsc310/sections/001").send({
			instructor: "Reid",
			year: 2024,
			avg: 75,
			pass: 100,
			fail: 5,
			audit: 0,
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/002").send({
			instructor: "Gregor",
			year: 2024,
			avg: 90,
			pass: 80,
			fail: 2,
			audit: 1,
		});
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { NOT: { GT: { avg: 80 } } }, OPTIONS: { COLUMNS: ["avg"] } },
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ avg: 75 }]);
	});

	it("POST /api/v2/search should support wildcard IS patterns", async () => {
		await request(app)
			.put("/api/v1/courses/cpsc310")
			.send({ title: "Software Engineering", dept: "CPSC", code: "310" });
		await request(app).put("/api/v1/courses/cpsc310/sections/001").send({
			instructor: "Reid",
			year: 2024,
			avg: 80,
			pass: 100,
			fail: 5,
			audit: 0,
		});
		// startsWith
		let res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { IS: { title: "Software*" } }, OPTIONS: { COLUMNS: ["title"] } },
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ title: "Software Engineering" }]);
		// endsWith
		res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { IS: { title: "*Engineering" } }, OPTIONS: { COLUMNS: ["title"] } },
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ title: "Software Engineering" }]);
		// contains
		res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { IS: { title: "*ware Eng*" } }, OPTIONS: { COLUMNS: ["title"] } },
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ title: "Software Engineering" }]);
		// exact match
		res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { IS: { title: "Software Engineering" } }, OPTIONS: { COLUMNS: ["title"] } },
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [{ title: "Software Engineering" }]);
	});

	it("POST /api/v2/search should support facilities href in COLUMNS and IS", async () => {
		await request(app).put("/api/v2/buildings/DMP").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "DMP",
			number: "101",
			type: "Lecture Hall",
			furniture: "Fixed Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 100,
		});

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: { IS: { href: "*DMP-101" } },
					OPTIONS: { COLUMNS: ["building", "number", "href"] },
				},
			});

		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				building: "DMP",
				number: "101",
				href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			},
		]);
	});
});
