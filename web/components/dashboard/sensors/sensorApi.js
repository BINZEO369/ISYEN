import { endpointId, jsonRequest } from "../shared/request";
export const createSensor = (request, payload) => request("/api/sensors", jsonRequest("POST", payload));
export const deleteSensor = (request, id) => request(`/api/sensors/${endpointId(id)}`, { method: "DELETE" });
