import { Router, type RequestHandler } from "express";
import { asyncHandler } from "../middleware/asyncHandler";

export interface BuildingRouteHandlers {
	listBuildings: RequestHandler;
	getBuilding: RequestHandler;
	upsertBuilding: RequestHandler;
	deleteBuilding: RequestHandler;
	listRoomsInBuilding: RequestHandler;
	getRoomInBuilding: RequestHandler;
	upsertRoomInBuilding: RequestHandler;
	deleteRoomInBuilding: RequestHandler;
}

export function createBuildingRouter(handlers: BuildingRouteHandlers): Router {
	const router = Router();

	router.get("/api/v2/buildings", asyncHandler(handlers.listBuildings));
	router.get("/api/v2/buildings/:buildingId", asyncHandler(handlers.getBuilding));
	router.put("/api/v2/buildings/:buildingId", asyncHandler(handlers.upsertBuilding));
	router.delete("/api/v2/buildings/:buildingId", asyncHandler(handlers.deleteBuilding));

	router.get("/api/v2/buildings/:buildingId/rooms", asyncHandler(handlers.listRoomsInBuilding));
	router.get("/api/v2/buildings/:buildingId/rooms/:roomId", asyncHandler(handlers.getRoomInBuilding));
	router.put("/api/v2/buildings/:buildingId/rooms/:roomId", asyncHandler(handlers.upsertRoomInBuilding));
	router.delete("/api/v2/buildings/:buildingId/rooms/:roomId", asyncHandler(handlers.deleteRoomInBuilding));

	return router;
}
