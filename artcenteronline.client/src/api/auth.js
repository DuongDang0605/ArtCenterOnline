// src/api/auth.js
import http from "./http"; // <-- cùng thư mục /api

/**
 * Đăng nhập
 * Server trả: { accessToken, user: { userId, email, fullName, roles[] } }
 */
export async function login(email, password) {
    const { data } = await http.post("/auth/login", { email, password });
    return data;
}

/** Lấy thông tin user hiện tại theo token */
export async function fetchMe() {
    const { data } = await http.get("/auth/me");
    return data; // { userId, email, fullName, roles[] }
}
