// src/Template/Session/sessions.js
import http from "../../api/http";

const BASE = "/ClassSessions"; // http đã prefix /api

// ---------- utils ----------
export function ymd(d) {
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

function enrichError(err) {
    const res = err?.response;
    err.userMessage =
        res?.data?.message ??
        res?.data?.detail ??
        res?.data?.title ??
        (typeof res?.data === "string" ? res.data : null) ??
        err.message;
    return err;
}

// =======================
// LIST
// =======================
/**
 * Lấy danh sách buổi học theo bộ lọc.
 * @param {Object} filters
 * @param {string} [filters.from]    yyyy-MM-dd
 * @param {string} [filters.to]      yyyy-MM-dd
 * @param {number} [filters.classId]
 * @param {number} [filters.teacherId]
 * @param {number} [filters.status]
 * @param {boolean} [filters.forCalendar]
 */
export async function listSessions(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.from) qs.set("from", filters.from);
    if (filters.to) qs.set("to", filters.to);
    if (filters.classId != null) qs.set("classId", String(filters.classId));
    if (filters.teacherId != null) qs.set("teacherId", String(filters.teacherId));
    if (filters.status != null) qs.set("status", String(filters.status));
    if (filters.forCalendar) qs.set("forCalendar", "true");

    const url = qs.toString() ? `${BASE}?${qs.toString()}` : BASE;

    try {
        const { data } = await http.get(url);
        // BE có thể trả mảng hoặc {items:[]}
        return Array.isArray(data) ? data : (data?.items ?? data ?? []);
    } catch (err) {
        throw enrichError(err);
    }
}

// Giữ tương thích với nơi import listAllSessions
export { listSessions as listAllSessions };

// =======================
// DETAIL / UPDATE
// =======================
/** Lấy chi tiết 1 buổi */
export async function getSession(sessionId) {
    const { data } = await http.get(`${BASE}/${sessionId}`);
    return data;
}

/** Cập nhật 1 buổi */
export async function updateSession(sessionId, payload) {
    try {
        const { data } = await http.put(`${BASE}/${sessionId}`, payload);
        return data;
    } catch (err) {
        throw enrichError(err);
    }
}

// =======================
// PREFLIGHTS
// =======================
/** Kiểm tra trùng học sinh khi SỬA BUỔI (cảnh báo – FE sẽ bật modal) */
// HS overlap cho Session: POST -> fallback GET
// HS overlap cho Session: POST -> fallback GET
export async function checkStudentOverlapForSession(sessionId, patch = {}) {
    const tryList = [
        () => http.post(`/ClassSessions/${sessionId}/check-student-overlap`, patch),
        () => http.get(`/ClassSessions/${sessionId}/check-student-overlap`),
        () => http.get(`/ClassSessions/check-student-overlap/${sessionId}`),
        () => http.get(`/ClassSessions/check-student-overlap?id=${sessionId}`),
    ];
    let lastErr;
    for (const call of tryList) {
        try {
            const { data } = await call();
            if (Array.isArray(data)) return data;
            if (Array.isArray(data?.conflicts)) return data.conflicts; // <- quan trọng
            if (Array.isArray(data?.items)) return data.items;
            return [];
        } catch (err) {
            const st = err?.response?.status;
            if (st === 405 || st === 404 || st === 400) { lastErr = err; continue; }
            throw err;
        }
    }
    throw lastErr || new Error("Không tìm thấy endpoint check-student-overlap cho buổi.");
}



/** Preflight giáo viên cho 1 buổi (GV trùng → 409 ở server) */
export async function preflightTeacherForSession(sessionId, payload) {
    // payload: { SessionId, SessionDate: "yyyy-MM-dd", StartTime: "HH:mm:ss", EndTime: "HH:mm:ss", TeacherId }
    const { data } = await http.post(`${BASE}/${sessionId}/preflight-teacher`, payload);
    return data; // { conflict: false }
}

// =======================
// SYNC
// =======================
/** Đồng bộ buổi theo tháng cho 1 lớp */
export async function syncMonth(classId, { year, month } = {}) {
    const qs = new URLSearchParams();
    if (year) qs.set("year", String(year));
    if (month) qs.set("month", String(month));
    const url = `${BASE}/sync-month/${classId}` + (qs.toString() ? `?${qs}` : "");
    const { data } = await http.post(url);
    return data; // { created, updated, deleted, skippedTeacherConflicts }
}
// Lấy lịch theo HỌC VIÊN
export async function listSessionsByStudent(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.studentId == null) throw new Error("Thiếu studentId");
    qs.set("studentId", String(filters.studentId));
    if (filters.from) qs.set("from", filters.from);
    if (filters.to) qs.set("to", filters.to);
    if (filters.status != null) qs.set("status", String(filters.status));
    if (filters.forCalendar) qs.set("forCalendar", "true"); // BE bỏ qua cũng không sao

    const url = `/ClassSessions/by-student?${qs.toString()}`;
    try {
        const { data } = await http.get(url);
        return Array.isArray(data) ? data : (data?.items ?? data ?? []);
    } catch (err) {
        throw enrichError(err);
    }
}
