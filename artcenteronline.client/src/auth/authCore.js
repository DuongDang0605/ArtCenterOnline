// src/auth/authCore.js
import { createContext, useContext } from "react";

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// ----- LocalStorage (thống nhất 1 chuẩn) -----
const ACCESS_TOKEN_KEY = "accessToken";
const USER_KEY = "authUser";

export function readAuth() {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    return token ? { token, user, roles: user?.roles ?? [] } : null;
}

export function writeAuth({ accessToken, user }) {
    // API login cần trả { accessToken, user }
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}
