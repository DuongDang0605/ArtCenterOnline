// src/auth/AuthProvider.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AuthCtx, readAuth, writeAuth, clearAuth } from "./authCore";

export default function AuthProvider({ children }) {
    const [auth, setAuth] = useState(() => readAuth());

    // Gắn Authorization cho mọi request
    useEffect(() => {
        const reqId = axios.interceptors.request.use((cfg) => {
            const a = readAuth();
            if (a?.token) cfg.headers.Authorization = `Bearer ${a.token}`;
            return cfg;
        });

        // (Tuỳ chọn) bắt 401 => auto logout
        const resId = axios.interceptors.response.use(
            (res) => res,
            (err) => {
                if (err?.response?.status === 401) {
                    clearAuth();
                    setAuth(null);
                }
                return Promise.reject(err);
            }
        );

        return () => {
            axios.interceptors.request.eject(reqId);
            axios.interceptors.response.eject(resId);
        };
    }, []);

    const value = useMemo(
        () => ({
            isAuthed: !!auth?.token,
            user: auth?.user ?? null,
            roles: auth?.roles ?? auth?.user?.roles ?? [],

            // Gọi sau khi login API trả về { accessToken, user }
            loginOk: (data) => {
                writeAuth(data);
                setAuth(readAuth());
            },

            // Cho phép cập nhật thông tin user trong bộ nhớ (không đổi token)
            updateUser: (updater) => {
                const cur = readAuth();
                if (!cur) return;
                const nextUser = typeof updater === "function" ? updater(cur.user) : updater;
                writeAuth({ accessToken: cur.token, user: nextUser });
                setAuth(readAuth());
            },

            logout: () => {
                clearAuth();
                setAuth(null);
            },
        }),
        [auth]
    );

    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
