import { API_BASE_URL } from "../../../services/config";
export async function requestBackendEndpoint(accessToken, path, options = {}) {
  if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  let response;
  try { response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers }); }
  catch (error) { throw new Error(error.message || "Could not connect to the server. Check your connection and try again."); }
  const raw = await response.text();
  let payload = null;
  if (raw) { try { payload = JSON.parse(raw); } catch { throw new Error("The server returned an invalid response."); } }
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403 ? "Your session has expired. Please sign in again." : response.status === 404 ? "The requested item was not found." : `Request failed (${response.status}). Please try again.`;
    throw new Error(message);
  }
  return payload;
}
export const jsonRequest = (method, body) => ({ method, body: JSON.stringify(body) });
export const endpointId = (value) => encodeURIComponent(value);
