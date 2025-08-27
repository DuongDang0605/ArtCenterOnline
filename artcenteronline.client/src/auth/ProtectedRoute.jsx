// src/auth/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./authCore";

/**
 * Bọc các route bắt buộc đăng nhập.
 * Dùng:
 * <Route element={<ProtectedRoute />}>
 *   <Route path="/dashboard" element={<Dashboard />} />
 * </Route>
 */
export default function ProtectedRoute({ redirectTo = "/login" }) {
    const { isAuthed } = useAuth();
    const loc = useLocation();

    if (!isAuthed) {
        // Giữ lại đường dẫn gốc để login xong quay lại
        return <Navigate to={redirectTo} replace state={{ from: loc.pathname + loc.search }} />;
    }
    return <Outlet />;
}
