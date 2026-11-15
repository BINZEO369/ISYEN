export const getDashboard = (request) => request("/api/dashboard");
export const getReadings = (request, type) => request(`/api/readings?type=${encodeURIComponent(type)}`);
export const getOptions = (request) => request("/api/options");
