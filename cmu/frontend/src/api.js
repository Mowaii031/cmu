const API = "http://127.0.0.1:8000/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {"Content-Type": "application/json", ...(options.headers || {})};
  if (token) headers.Authorization = `Token ${token}`;

  const res = await fetch(API + path, {...options, headers});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.detail || Object.values(data).flat().join(" ") || "Request failed";
    throw new Error(message);
  }
  return data;
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
