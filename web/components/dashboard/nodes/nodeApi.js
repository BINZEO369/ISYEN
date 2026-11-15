import { endpointId, jsonRequest } from "../shared/request";
export const approveNode = (request, id, nodeName) => request(`/api/nodes/${endpointId(id)}`, jsonRequest("PATCH", { node_name: nodeName, is_approved: true }));
export const deleteNode = (request, id) => request(`/api/nodes/${endpointId(id)}`, { method: "DELETE" });
