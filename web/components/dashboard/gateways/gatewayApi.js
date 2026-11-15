import { jsonRequest } from "../shared/request";
export const createGateway = (request, payload) => request("/api/gateways", jsonRequest("POST", payload));
