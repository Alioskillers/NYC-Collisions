// frontend/src/lib/api.js or axiosConfig.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function fetchJSON(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}