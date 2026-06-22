import fs from "fs/promises";
import { expect } from "chai";
import request from "supertest";
import { StatusCodes } from "http-status-codes";
import { Application, createApp } from "../src/App";
import JSZip from "jszip";

import path from "path";

// TO RUN USE: yarn test:v1

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
describe("REST API v1", function () {
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
	it("GET /api/v1/courses should respond with status OK and body empty array", async () => {
		const res = await request(app).get("/api/v1/courses?limit=100&offset=0");
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal({
			items: [],
			total: 0,
			limit: 100,
			offset: 0,
		});
	});
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

	it("GET /api/v1/courses should respond with status OK and list of course", async () => {
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software constructions",
			dept: "CS",
			code: "210",
		});

		const res = await request(app).get("/api/v1/courses");
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal({
			total: 1,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "cpsc210",
					title: "Software constructions",
					dept: "CS",
					code: "210",
					links: {
						self: "/api/v1/courses/cpsc210",
						sections: "/api/v1/courses/cpsc210/sections",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses should respond with status OK and full list of course", async () => {
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software constructions",
			dept: "CS",
			code: "210",
		});

		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "CS",
			code: "310",
		});

		const res = await request(app).get("/api/v1/courses");
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal({
			total: 2,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "cpsc210",
					title: "Software constructions",
					dept: "CS",
					code: "210",
					links: {
						self: "/api/v1/courses/cpsc210",
						sections: "/api/v1/courses/cpsc210/sections",
					},
				},
				{
					id: "cpsc310",
					title: "Introduction to Software Engineering",
					dept: "CS",
					code: "310",
					links: {
						self: "/api/v1/courses/cpsc310",
						sections: "/api/v1/courses/cpsc310/sections",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses should respond with status OK and sorted list of course", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "CS",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software constructions",
			dept: "CS",
			code: "210",
		});

		const res = await request(app).get("/api/v1/courses");
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal({
			total: 2,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "cpsc210",
					title: "Software constructions",
					dept: "CS",
					code: "210",
					links: {
						self: "/api/v1/courses/cpsc210",
						sections: "/api/v1/courses/cpsc210/sections",
					},
				},
				{
					id: "cpsc310",
					title: "Introduction to Software Engineering",
					dept: "CS",
					code: "310",
					links: {
						self: "/api/v1/courses/cpsc310",
						sections: "/api/v1/courses/cpsc310/sections",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses with different course codes should respond with status OK and sorted list of course", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "CS",
			code: "310",
		});
		await request(app).put("/api/v1/courses/japn422").send({
			title: "Classical Japanese",
			dept: "Asian Studies",
			code: "422",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software constructions",
			dept: "CS",
			code: "210",
		});

		const res = await request(app).get("/api/v1/courses");
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal({
			total: 3,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "cpsc210",
					title: "Software constructions",
					dept: "CS",
					code: "210",
					links: {
						self: "/api/v1/courses/cpsc210",
						sections: "/api/v1/courses/cpsc210/sections",
					},
				},
				{
					id: "cpsc310",
					title: "Introduction to Software Engineering",
					dept: "CS",
					code: "310",
					links: {
						self: "/api/v1/courses/cpsc310",
						sections: "/api/v1/courses/cpsc310/sections",
					},
				},
				{
					id: "japn422",
					title: "Classical Japanese",
					dept: "Asian Studies",
					code: "422",
					links: {
						self: "/api/v1/courses/japn422",
						sections: "/api/v1/courses/japn422/sections",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses with specified limit 2 should respond with status OK and according sorted list of course", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "CS",
			code: "310",
		});
		await request(app).put("/api/v1/courses/japn422").send({
			title: "Classical Japanese",
			dept: "Asian Studies",
			code: "422",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software constructions",
			dept: "CS",
			code: "210",
		});

		const res = await request(app).get("/api/v1/courses?limit=2");
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal({
			total: 3,
			limit: 2,
			offset: 0,
			items: [
				{
					id: "cpsc210",
					title: "Software constructions",
					dept: "CS",
					code: "210",
					links: {
						self: "/api/v1/courses/cpsc210",
						sections: "/api/v1/courses/cpsc210/sections",
					},
				},
				{
					id: "cpsc310",
					title: "Introduction to Software Engineering",
					dept: "CS",
					code: "310",
					links: {
						self: "/api/v1/courses/cpsc310",
						sections: "/api/v1/courses/cpsc310/sections",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses with specified offset 1 should respond with status OK and according sorted list of course", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "CS",
			code: "310",
		});
		await request(app).put("/api/v1/courses/japn422").send({
			title: "Classical Japanese",
			dept: "Asian Studies",
			code: "422",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software constructions",
			dept: "CS",
			code: "210",
		});

		const res = await request(app).get("/api/v1/courses?offset=1");
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal({
			total: 3,
			limit: 100,
			offset: 1,
			items: [
				{
					id: "cpsc310",
					title: "Introduction to Software Engineering",
					dept: "CS",
					code: "310",
					links: {
						self: "/api/v1/courses/cpsc310",
						sections: "/api/v1/courses/cpsc310/sections",
					},
				},
				{
					id: "japn422",
					title: "Classical Japanese",
					dept: "Asian Studies",
					code: "422",
					links: {
						self: "/api/v1/courses/japn422",
						sections: "/api/v1/courses/japn422/sections",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses with specified limit 2 and offset 2 should respond with status OK and according sorted list of course", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "CS",
			code: "310",
		});
		await request(app).put("/api/v1/courses/japn422").send({
			title: "Classical Japanese",
			dept: "Asian Studies",
			code: "422",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software constructions",
			dept: "CS",
			code: "210",
		});

		const res = await request(app).get("/api/v1/courses?limit=2&offset=2");
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal({
			total: 3,
			limit: 2,
			offset: 2,
			items: [
				{
					id: "japn422",
					title: "Classical Japanese",
					dept: "Asian Studies",
					code: "422",
					links: {
						self: "/api/v1/courses/japn422",
						sections: "/api/v1/courses/japn422/sections",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses should respond with status BAD_REQUEST, given negative limit", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Intro to Software Engineering",
			dept: "CS",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software constructions",
			dept: "CS",
			code: "210",
		});
		const res = await request(app).get("/api/v1/courses?limit=-1&offset=0");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
			},
		});
	});
	it("GET /api/v1/courses should respond with status BAD_REQUEST, given negative limit and offset", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Intro to Software Engineering",
			dept: "CS",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software constructions",
			dept: "CS",
			code: "210",
		});
		const res = await request(app).get("/api/v1/courses?limit=-1&offset=-1");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
				offset: "expected an integer >= 0",
			},
		});
	});
	it("GET /api/v1/courses should respond with status BAD_REQUEST, given negative offset", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Intro to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software construction",
			dept: "Computer Science",
			code: "210",
		});
		const res = await request(app).get("/api/v1/courses?limit=500&offset=-1");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				offset: "expected an integer >= 0",
			},
		});
	});
	it("GET /api/v1/courses should respond with status OK and list of courses skip the first course added  ", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Intro to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software Construction",
			dept: "Computer Science",
			code: "210",
		});
		const res = await request(app).get("/api/v1/courses?limit=100&offset=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 100,
			offset: 1,
			items: [
				{
					id: "cpsc310",
					title: "Intro to Software Engineering",
					dept: "Computer Science",
					code: "310",
					links: {
						self: "/api/v1/courses/cpsc310",
						sections: "/api/v1/courses/cpsc310/sections",
					},
				},
			],
		});
	});
	it("GET /api/v1/courses/cpsc310 should respond with status OK and corrisponding course info", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			links: {
				self: "/api/v1/courses/cpsc310",
				sections: "/api/v1/courses/cpsc310/sections",
			},
		});
	});
	it("GET /api/v1/courses/cpsc310 with no pre-existing course cpsc310 should respond with status NOT_FOUND and corrisponding error body", async () => {
		const res = await request(app).get("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});
	it("GET /api/v1/courses/310cpsc with existing course cpsc310 should respond with status NOT_FOUND and corrisponding error body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/310cpsc");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id '310cpsc'",
		});
	});
	it("PUT /api/v1/courses/cpsc310 without pre-existing cpsc310 course should respond with status CREATED and course info", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			links: {
				self: "/api/v1/courses/cpsc310",
				sections: "/api/v1/courses/cpsc310/sections",
			},
		});
	});
	it("PUT /api/v1/courses/cpsc310 with existing cpsc310 should respond with status NO_CONTENT and updated course info", async () => {
		let res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Intro to Software Engineering",
			dept: "CS",
			code: "310",
		});
		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Intro to Software Engineering",
			dept: "CS",
			code: "310",
			links: {
				self: "/api/v1/courses/cpsc310",
				sections: "/api/v1/courses/cpsc310/sections",
			},
		});
		res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});

		res = await request(app).get("/api/v1/courses/cpsc310");
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			links: {
				self: "/api/v1/courses/cpsc310",
				sections: "/api/v1/courses/cpsc310/sections",
			},
		});
	});
	it("PUT /api/v1/courses/cpsc310 with title, dept, and code string missing should respond with status UNPROCESSABLE_ENTITY and appropriate message", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310").send({});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				title: "required but missing",
				dept: "required but missing",
				code: "required but missing",
			},
		});
	});
	it("PUT /api/v1/courses/cpsc310 with title, dept, and code as incorrect type should respond with status UNPROCESSABLE_ENTITY and appropriate message", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: 67,
			dept: 68,
			code: 69,
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				title: "expected a string",
				dept: "expected a string",
				code: "expected a string",
			},
		});
	});
	it("DELETE /api/v1/courses/cpsc310 with pre-existing cpsc310 course should respond with status OK and corrisponding course info being deleted", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).delete("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			sections: 0,
		});
	});
	it("DELETE /api/v1/courses/cpsc310 with no existing cpsc310 course should respond with status NOT_FOUND and corrisponding error body", async () => {
		const res = await request(app).delete("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with valid course and section should respond with status OK corrisponding body info", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 1,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "21w201",
					instructor: "holmes, reid",
					year: 2021,
					avg: 76.4,
					pass: 167,
					fail: 3,
					audit: 1,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w201",
						course: "/api/v1/courses/cpsc310",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with valid course and multiple sections should respond with status OK corrisponding body info", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2021").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2067").send({
			instructor: "six, seven",
			year: 2067,
			avg: 67,
			pass: 67,
			fail: 67,
			audit: 67,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "21w2021",
					instructor: "holmes, reid",
					year: 2021,
					avg: 76.4,
					pass: 167,
					fail: 3,
					audit: 1,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w2021",
						course: "/api/v1/courses/cpsc310",
					},
				},
				{
					id: "21w2067",
					instructor: "six, seven",
					year: 2067,
					avg: 67,
					pass: 67,
					fail: 67,
					audit: 67,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w2067",
						course: "/api/v1/courses/cpsc310",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with valid course and multiple sections with limit 1, should respond with status OK corrisponding first section's info", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2021").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2067").send({
			instructor: "six, seven",
			year: 2067,
			avg: 67,
			pass: 67,
			fail: 67,
			audit: 67,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=1&offset=0");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 1,
			offset: 0,
			items: [
				{
					id: "21w2021",
					instructor: "holmes, reid",
					year: 2021,
					avg: 76.4,
					pass: 167,
					fail: 3,
					audit: 1,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w2021",
						course: "/api/v1/courses/cpsc310",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with valid course and multiple sections with limit 1 and offset 1, should respond with status OK corrisponding second section's info", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2021").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2067").send({
			instructor: "six, seven",
			year: 2067,
			avg: 67,
			pass: 67,
			fail: 67,
			audit: 67,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=1&offset=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 1,
			offset: 1,
			items: [
				{
					id: "21w2067",
					instructor: "six, seven",
					year: 2067,
					avg: 67,
					pass: 67,
					fail: 67,
					audit: 67,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w2067",
						course: "/api/v1/courses/cpsc310",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with valid course and multiple sections with only specified limit 1, should respond with status OK corrisponding section info", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2021").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2067").send({
			instructor: "six, seven",
			year: 2067,
			avg: 67,
			pass: 67,
			fail: 67,
			audit: 67,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 1,
			offset: 0,
			items: [
				{
					id: "21w2021",
					instructor: "holmes, reid",
					year: 2021,
					avg: 76.4,
					pass: 167,
					fail: 3,
					audit: 1,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w2021",
						course: "/api/v1/courses/cpsc310",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with valid course and multiple sections with only specified offset = 1, should respond with status OK with array starting offset 1", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2021").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2067").send({
			instructor: "six, seven",
			year: 2067,
			avg: 67,
			pass: 67,
			fail: 67,
			audit: 67,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections?offset=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 100,
			offset: 1,
			items: [
				{
					id: "21w2067",
					instructor: "six, seven",
					year: 2067,
					avg: 67,
					pass: 67,
					fail: 67,
					audit: 67,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w2067",
						course: "/api/v1/courses/cpsc310",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with valid course and multiple sections pushed in different order, should respond with status OK with ordered array by id", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2067").send({
			instructor: "six, seven",
			year: 2067,
			avg: 67,
			pass: 67,
			fail: 67,
			audit: 67,
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2021").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "21w2021",
					instructor: "holmes, reid",
					year: 2021,
					avg: 76.4,
					pass: 167,
					fail: 3,
					audit: 1,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w2021",
						course: "/api/v1/courses/cpsc310",
					},
				},
				{
					id: "21w2067",
					instructor: "six, seven",
					year: 2067,
					avg: 67,
					pass: 67,
					fail: 67,
					audit: 67,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w2067",
						course: "/api/v1/courses/cpsc310",
					},
				},
			],
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with valid course and multiple sections with limit 1 and no recorded offset, should respond with status OK, first section's info, with offset default 0", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2021").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w2067").send({
			instructor: "six, seven",
			year: 2067,
			avg: 67,
			pass: 67,
			fail: 67,
			audit: 67,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=1&offset=2");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 1,
			offset: 2,
			items: [],
		});
	});

	it("GET /api/v1/courses/cpsc310/sections/21w201 with pre-existing section should respond with status OK and corrisponding section info", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "21w201",
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
			links: {
				self: "/api/v1/courses/cpsc310/sections/21w201",
				course: "/api/v1/courses/cpsc310",
			},
		});
	});
	it("GET /api/v1/courses/cpsc310/sections/21w201 without pre-existing section should respond with status NOT_FOUND and corrisponding error body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no section with id '21w201' in course 'cpsc310'",
		});
	});
	it("GET /api/v1/courses/cpsc310/sections/21w201 with mispelled course id should respond with status NOT_FOUND and corrisponding error body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).get("/api/v1/courses/310cpsc/sections/21w201");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id '310cpsc'",
		});
	});

	it("PUT /api/v1/courses/cpsc310/sections/21w201 without pre-existing 21w201 section should respond with status CREATED and corrisponding section", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "21w201",
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
			links: {
				self: "/api/v1/courses/cpsc310/sections/21w201",
				course: "/api/v1/courses/cpsc310",
			},
		});
	});
	it("PUT /api/v1/courses/cpsc310/sections/21w201 without pre-exisiting cpsc310 course should respond with status NOT_FOUND and corrisponding error body", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});
	it("PUT /api/v1/courses/cpsc310/sections/21w201 with pre-exisiting 21w201 section should respond with status NO_CONTENT and updated section body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		let res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "home, red",
			year: 2000,
			avg: 70,
			pass: 100,
			fail: 300,
			audit: 10,
		});
		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "21w201",
			instructor: "home, red",
			year: 2000,
			avg: 70,
			pass: 100,
			fail: 300,
			audit: 10,
			links: {
				self: "/api/v1/courses/cpsc310/sections/21w201",
				course: "/api/v1/courses/cpsc310",
			},
		});
		res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});

		res = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.deep.property("body", {
			id: "21w201",
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
			links: {
				self: "/api/v1/courses/cpsc310/sections/21w201",
				course: "/api/v1/courses/cpsc310",
			},
		});
	});
	it("PUT /api/v1/courses/cpsc310/sections/21w201 without instructor, year, avg, pass, fail, audit should respond with status UNPROCESSABLE_ENTITY and corrisponding error body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				instructor: "required but missing",
				year: "required but missing",
				avg: "required but missing",
				pass: "required but missing",
				fail: "required but missing",
				audit: "required but missing",
			},
		});
	});
	it("PUT /api/v1/courses/cpsc310/sections/21w201 with incorrect instructor, year, avg, pass, fail, audit data types should respond with status UNPROCESSABLE_ENTITY and corrisponding error body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: 67,
			year: "2021",
			avg: "76.4",
			pass: "167",
			fail: "3",
			audit: "1",
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				instructor: "expected a string",
				year: "expected a number between 1900 and 2099",
				avg: "expected a number between 0 and 100",
				pass: "expected a number >= 0",
				fail: "expected a number >= 0",
				audit: "expected a number >= 0",
			},
		});
	});
	it("PUT /api/v1/courses/cpsc310/sections/21w201 with value out of lower bounds for year, avg, pass, fail, audit should respond with status UNPROCESSABLE_ENTITY and corrisponding error body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 1899,
			avg: -1,
			pass: -1,
			fail: -1,
			audit: -1,
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				year: "expected a number between 1900 and 2099",
				avg: "expected a number between 0 and 100",
				pass: "expected a number >= 0",
				fail: "expected a number >= 0",
				audit: "expected a number >= 0",
			},
		});
	});
	it("PUT /api/v1/courses/cpsc310/sections/21w201 with value out of upper bounds for year, avg should respond with status UNPROCESSABLE_ENTITY and corrisponding error body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2100,
			avg: 101,
			pass: 100,
			fail: 100,
			audit: 100,
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				year: "expected a number between 1900 and 2099",
				avg: "expected a number between 0 and 100",
			},
		});
	});
	it("DELETE /api/v1/courses/cpsc310/sections/21w2021 with pre-existing section should respond with status OK and corrisponding delete body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).delete("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "21w201",
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
	});
	it("DELETE /api/v1/courses/cpsc310/sections/21w2021 without pre-existing section should respond with status NOT_FOUND and corrisponding error body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).delete("/api/v1/courses/cpsc310/sections/21w2021");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no section with id '21w2021' in course 'cpsc310'",
		});
	});
	it("DELETE /api/v1/courses/310cpsc/sections/21w2021 with mispelt course id should respond with status NOT_FOUND and corrisponding error body", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).delete("/api/v1/courses/310cpsc/sections/21w201");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id '310cpsc'",
		});
	});

	// TEST Bulk upload data
	it("POST /api/v1/datasets Upload and process a zip file containing course data. ACCEPTED", async () => {
		// Creates an empty zip file
		const zip = new JSZip();

		// Mock data. Add a JSON file with course data to the zip folder courses
		const coursesFolder = zip.folder("courses");
		coursesFolder!.file(
			"test.json",
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
		const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

		const res = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", zipBuffer, "courses.zip");

		expect(res).to.have.property("status", ACCEPTED);
		expect(res).to.have.deep.property("body", {
			id: "courses.zip",
			status: "processing",
			kind: "course_offerings",
			message: "Dataset accepted for processing",
		});
	});
	it("POST /api/v1/datasets without kind field should respond with status UNPROCESSABLE_ENTITY", async () => {
		const zip = new JSZip();
		zip.folder("courses");
		const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

		const res = await request(app).post("/api/v1/datasets").attach("archive", zipBuffer, "courses.zip");

		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "required but missing",
			},
		});
	});
	it("POST /api/v1/datasets without archive field should respond with status UNPROCESSABLE_ENTITY", async () => {
		const res = await request(app).post("/api/v1/datasets").field("kind", "course_offerings");

		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				archive: "required but missing",
			},
		});
	});
	it("POST /api/v1/datasets with invalid kind value should respond with status UNPROCESSABLE_ENTITY", async () => {
		const zip = new JSZip();
		zip.folder("courses");
		const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

		const res = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "invalid_kind")
			.attach("archive", zipBuffer, "courses.zip");

		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "expected to be course_offerings",
			},
		});
	});
	it("POST /api/v1/datasets with empty archive should respond with status UNPROCESSABLE_ENTITY", async () => {
		const res = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", Buffer.alloc(0), "empty.zip");

		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				archive: "expected non-empty file",
			},
		});
	});
	it("POST /api/v1/datasets with both fields missing should respond with status UNPROCESSABLE_ENTITY", async () => {
		const res = await request(app).post("/api/v1/datasets");

		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "required but missing",
				archive: "required but missing",
			},
		});
	});

	// //GET Retrieve upload statistics
	// it("GET /api/v1/datasets/:id should return processing with status OK", async () => {
	// 	// First, create an upload job

	// 	const zipPath = path.resolve("test/resources/partial-pair.zip");

	// 	const uploadRes = await request(app)
	// 		.post("/api/v1/datasets")
	// 		.field("kind", "course_offerings")
	// 		.attach("archive", zipPath);

	// 	// get the id from the uploaded file.
	// 	const jobId = uploadRes.body.id;

	// 	const res = await request(app).get(`/api/v1/datasets/${jobId}`);

	// 	// Retrieve the job status
	// 	expect(res).to.have.property("status", OK);
	// 	expect(res).to.have.deep.property("body", {
	// 		id: jobId,
	// 		status: "processing",
	// 		kind: "course_offerings",
	// 		stats: {
	// 			files_total: 2,
	// 			files_processed: 1,
	// 			files_skipped: 0,
	// 			courses_seen: 0,
	// 			courses_added: 0,
	// 			courses_modified: 0,
	// 			sections_seen: 0,
	// 			sections_added: 0,
	// 			sections_modified: 0,
	// 		},
	// 		message: "Dataset accepted for processing",
	// 	});
	// });

	// // Getting large data after 16 seconds
	// it("GET /api/v1/datasets/:id should return completed upload job status with stats", async () => {
	// 	// First, create an upload job

	// 	const zipPath = path.resolve("test/resources/partial-pair.zip");

	// 	const uploadRes = await request(app)
	// 		.post("/api/v1/datasets")
	// 		.field("kind", "course_offerings")
	// 		.attach("archive", zipPath);

	// 	// get the id from the uploaded file.
	// 	const jobId = uploadRes.body.id;
	// 	const res = await request(app).get(`/api/v1/datasets/${jobId}`);

	// 	// Retrieve the job status
	// 	expect(res).to.have.property("status", OK);
	// 	expect(res).to.have.deep.property("body", {
	// 		id: jobId,
	// 		status: "completed",
	// 		kind: "course_offerings",
	// 		stats: {
	// 			files_total: 5944,
	// 			files_processed: 5944,
	// 			files_skipped: 0,
	// 			courses_seen: 0,
	// 			courses_added: 1665,
	// 			courses_modified: 0,
	// 			sections_seen: 0,
	// 			sections_added: 0,
	// 			sections_modified: 0,
	// 		},
	// 		message: "Dataset processing complete",
	// 	});
	// });
	it("GET /api/v1/datasets/:id with non-existent job should return NOT_FOUND", async () => {
		const res = await request(app).get("/api/v1/datasets/nonexistent_job_id");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no upload job with id 'nonexistent_job_id'",
		});
	});
	// search data
	it("POST /api/v1/search should return all courses when WHERE is empty", async () => {
		// Create some test data first - need a section for course to appear in search
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
			.post("/api/v1/search")
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
	it("POST /api/v1/search with GT comparison should return matching results", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Software Engineering",
			dept: "CPSC",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 99.5,
			pass: 100,
			fail: 0,
			audit: 2,
		});
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {
						GT: { avg: 99 },
					},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
					},
				},
			});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				dept: "CPSC",
				avg: 99.5,
			},
		]);
	});
	it("POST /api/v1/search with missing kind should return UNPROCESSABLE_ENTITY", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["dept"],
					},
				},
			});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "required but missing",
			},
		});
	});
	it("POST /api/v1/search with missing query should return UNPROCESSABLE_ENTITY", async () => {
		const res = await request(app).post("/api/v1/search").send({
			kind: "course_offerings",
		});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				query: "required but missing",
			},
		});
	});

	it("POST /api/v1/search with given no course_offerings should return UNPROCESSABLE_ENTITY", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Software Engineering",
			dept: "CPSC",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 99.5,
			pass: 100,
			fail: 0,
			audit: 2,
		});
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "RANDOM DWAHBFW",
				query: {
					WHERE: {
						GT: { avg: 99 },
					},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
					},
				},
			});
		expect(res).to.have.property("status", UNPROCESSABLE_ENTITY);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "expected to be course_offerings",
			},
		});
	});
	it("POST /api/v1/search with missing WHERE should return BAD_REQUEST", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					OPTIONS: {
						COLUMNS: ["dept", "code"],
					},
				},
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing WHERE",
		});
	});

	it("POST /api/v1/search with missing COLUMNS should return BAD_REQUEST", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: {},
				},
			});
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing COLUMNS",
		});
	});

	it("GET /api/v1/courses/nonexist/sections should return NOT_FOUND when course does not exist", async () => {
		const res = await request(app).get("/api/v1/courses/nonexist/sections");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'nonexist'",
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with invalid limit should return BAD_REQUEST", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=0");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: { limit: "expected an integer between 1 and 5000" },
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with invalid offset should return BAD_REQUEST", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?offset=-1");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: { offset: "expected an integer >= 0" },
		});
	});

	it("GET /api/v1/courses/cpsc310/sections with both invalid limit and offset should return BAD_REQUEST", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=-1&offset=-1");
		expect(res).to.have.property("status", BAD_REQUEST);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
				offset: "expected an integer >= 0",
			},
		});
	});
});
