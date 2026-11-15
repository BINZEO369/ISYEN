import { endpointId, jsonRequest } from "../shared/request";
export const createDevice = (request, payload) => request("/api/devices", jsonRequest("POST", payload));
export const setDeviceState = (request, id, isOn) => request(`/api/devices/${endpointId(id)}/state`, jsonRequest("PATCH", { is_on: isOn }));
export const deleteDevice = (request, id) => request(`/api/devices/${endpointId(id)}`, { method: "DELETE" });
