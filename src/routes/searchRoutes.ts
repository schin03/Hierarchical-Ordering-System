import { Router, type RequestHandler } from "express";

export interface SearchRouteHandlers {
	searchV1: RequestHandler;
	searchV2: RequestHandler;
}

export function createSearchRouter(handlers: SearchRouteHandlers): Router {
	const router = Router();

	router.post("/api/v1/search", handlers.searchV1);
	router.post("/api/v2/search", handlers.searchV2);

	return router;
}
