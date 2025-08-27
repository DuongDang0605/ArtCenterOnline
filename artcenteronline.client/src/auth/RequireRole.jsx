// src/auth/RequireRole.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authCore";

/**
 * Hạn chế theo vai trò.
 * Dùng:
 * <RequireRole roles={['Admin']}><UsersPage /></RequireRole>
 *
 * - roles: mảng role được phép
 * - redirectTo: trang chuyển hướng nếu không đủ quyền
 */
export default function RequireRole({ roles = [], redirectTo = "/", children }) {
    const { roles: ctxRoles = [] } = useAuth(); // LẤY TỪ CONTEXT, không lấy từ user.roles

    // Nếu không truyền roles -> coi như open (không chặn)
    const allowed = roles.length === 0 ? true : ctxRoles.some((r) => roles.includes(r));

    if (!allowed) return <Navigate to={redirectTo} replace />;
    return children;
}
