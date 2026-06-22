import { Router, type RequestHandler } from "express";

export interface CourseRouteHandlers {
	listCourses: RequestHandler;
	getCourse: RequestHandler;
	upsertCourse: RequestHandler;
	deleteCourse: RequestHandler;
	listSectionsForCourse: RequestHandler;
	getSectionForCourse: RequestHandler;
	upsertSectionForCourse: RequestHandler;
	deleteSectionForCourse: RequestHandler;
}

export function createCourseRouter(handlers: CourseRouteHandlers): Router {
	const router = Router();

	router.get("/api/v1/courses", handlers.listCourses);
	router.get("/api/v1/courses/:courseId", handlers.getCourse);
	router.put("/api/v1/courses/:courseId", handlers.upsertCourse);
	router.delete("/api/v1/courses/:courseId", handlers.deleteCourse);

	router.get("/api/v1/courses/:courseId/sections", handlers.listSectionsForCourse);
	router.get("/api/v1/courses/:courseId/sections/:sectionId", handlers.getSectionForCourse);
	router.put("/api/v1/courses/:courseId/sections/:sectionId", handlers.upsertSectionForCourse);
	router.delete("/api/v1/courses/:courseId/sections/:sectionId", handlers.deleteSectionForCourse);

	return router;
}
