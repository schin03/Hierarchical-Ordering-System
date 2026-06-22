import { Router, type RequestHandler } from "express";

export interface DatasetsRouteHandlers {
	uploadArchive: RequestHandler;
	createV1Dataset: RequestHandler;
	getV1Dataset: RequestHandler;
	createV2Dataset: RequestHandler;
	getV2Dataset: RequestHandler;
}

export function createDatasetsRouter(handlers: DatasetsRouteHandlers): Router {
	const router = Router();

	router.post("/api/v1/datasets", handlers.uploadArchive, handlers.createV1Dataset);
	router.get("/api/v1/datasets/:datasetId", handlers.getV1Dataset);
	router.post("/api/v2/datasets", handlers.uploadArchive, handlers.createV2Dataset);
	router.get("/api/v2/datasets/:datasetId", handlers.getV2Dataset);

	return router;
}
