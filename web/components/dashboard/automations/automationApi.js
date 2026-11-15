export const saveAutomation = (request, id, payload) => request(id ? `/api/automations/${encodeURIComponent(id)}` : "/api/automations", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
export const setAutomationEnabled = (request, id, enabled) => request(`/api/automations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
export const deleteAutomation = (request, id) => request(`/api/automations/${encodeURIComponent(id)}`, { method: "DELETE" });
export const getAutomationLogs = (request, id) => request(`/api/automations/${encodeURIComponent(id)}/logs`);
