// src/api/http.js
import axios from "axios";
import { readAuth, clearAuth } from "../auth/authCore"; // <-- đi lên 1 cấp, vào /auth

const http = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || "/api",
    withCredentials: false,
});

// Gắn Bearer token
http.interceptors.request.use((config) => {
    const a = readAuth();
    if (a?.token) config.headers.Authorization = `Bearer ${a.token}`;
    return config;
});

// 401 -> xoá auth và về /login
http.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err?.response?.status;
        if (status === 401) {
            clearAuth();
            if (!location.pathname.startsWith("/login")) {
                location.assign("/login");
            }
        }
        return Promise.reject(err);
    }
);

export default http;
