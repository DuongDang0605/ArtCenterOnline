// ============================
// src/Template/ClassSchedule/schedules.js
// ============================
import http from "../../api/http";
import { readAuth } from "../../auth/authCore";

const BASE = "/ClassSchedules"; // http.js đã baseURL = /api

// -------- utils (đặt trên cùng để tránh no-undef) --------
function pad2(n) { return String(n).padStart(2, "0"); }
/** Chuẩn hoá "HH:mm"|"HH:mm:ss" -> "HH:mm:ss" */
export function normTime(s) {
    if (!s) return "00:00:00";
    if (typeof s !== "string") s = String(s);
    const m = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s);
    if (!m) return s; // giữ nguyên nếu format lạ
    return `${pad2(+m[1])}:${pad2(+m[2])}:${pad2(m[3] ? +m[3] : 0)}`;
}

function curUser() {
    return readAuth()?.user ?? null;
}
function isAdmin() {
    return curUser()?.roles?.some((r) => String(r).toLowerCase() === "admin");
}

function enrichError(err) {
    if (err?.response) return err;
    return {
        response: {
            status: 0,
            data: { error: "Network", message: err?.message || "Network error" },
        },
    };
}

// -------- READ --------
export async function getSchedulesByClass(classId) {
    const { data } = await http.get(`${BASE}/by-class/${classId}`);
    return data;
}
export async function getSchedule(id) {
    const { data } = await http.get(`${BASE}/${id}`);
    return data;
}

// -------- PREFLIGHTS --------
// GV: short-circuit – server trả 409 nếu trùng
export async function preflightTeacherForSchedule({
    classId,
    dayOfWeek,
    startTime,
    endTime,
    teacherId,
    ignoreScheduleId,
}) {
    const payload = {
        ClassID: Number(classId),
        DayOfWeek: Number(dayOfWeek),
        StartTime: normTime(startTime),
        EndTime: normTime(endTime),
        TeacherId: Number(teacherId),
        IgnoreScheduleId: ignoreScheduleId ? Number(ignoreScheduleId) : undefined,
    };
    try {
        const { data } = await http.post(`${BASE}/preflight-teacher`, payload);
        return data; // { conflict: false }
    } catch (err) {
        throw enrichError(err);
    }
}

// HS: cảnh báo – controller BE của bạn đã có
// HS overlap cho Schedule: thử POST trước, nếu 405/404/400 thì fallback sang các GET route cũ
// Kiểm tra trùng học sinh cho 1 schedule
// Kiểm tra trùng học sinh cho 1 schedule (đa route, tự fallback)
// Kiểm tra trùng học sinh cho 1 schedule (POST -> GET với đủ query)
// ClassSchedules/check-student-overlap (GET, id ở path)
// --- ONLY PATH ID, no extra query ---
// gọi BE: /api/ClassSchedules/{id}/check-student-overlap?from=yyyy-MM-dd&to=yyyy-MM-dd
export async function checkStudentOverlapForSchedule(id, range = {}) {
    const { data } = await http.get(`/ClassSchedules/${id}/check-student-overlap`, {
        params: {
            ...(range.from ? { from: range.from } : {}),
            ...(range.to ? { to: range.to } : {}),
        },
    });
    return Array.isArray(data) ? data : (data?.items ?? []);
}






// -------- UPSERT --------
export async function createSchedule(payload) {
    try {
        const { data } = await http.post(BASE, payload);
        return data;
    } catch (err) {
        throw enrichError(err);
    }
}
// schedules.js

export async function updateSchedule(id, payload) {
    // Một số API cũ cần ScheduleId trong body
    const withId = {
        ...payload,
        ScheduleId: Number(id),
        scheduleId: Number(id),
    };

    const attempts = [
        // 1) API mới
        () => http.put(`/ClassSchedules/${id}`, payload),
        // 2) Nhiều backend cũ dùng POST theo id
        () => http.post(`/ClassSchedules/${id}`, payload),
        // 3) PUT không có id trên route, id ở body
        () => http.put(`/ClassSchedules`, withId),
        // 4) POST không có id trên route, id ở body  (phổ biến)
        () => http.post(`/ClassSchedules`, withId),
        // 5) Một số controller cũ đặt action riêng
        () => http.post(`/ClassSchedules/update`, withId),
        () => http.post(`/ClassSchedules/edit`, withId),
    ];

    let lastErr;
    for (const call of attempts) {
        try {
            const { data } = await call();
            return data;
        } catch (err) {
            const st = err?.response?.status;
            // nếu là 404/405/400 thì thử phương án tiếp theo
            if (st === 404 || st === 405 || st === 400) {
                lastErr = err;
                continue;
            }
            // lỗi khác (401/500/...) ném ra luôn
            throw err;
        }
    }
    throw lastErr || new Error("Không tìm thấy endpoint cập nhật lịch học phù hợp.");
}

export async function toggleSchedule(id) {
    if (!isAdmin()) throw new Error("Chỉ Admin mới được thay đổi trạng thái lịch học.");
    try {
        const { data } = await http.patch(`${BASE}/${id}/toggle`);
        return data;
    } catch (err) {
        throw enrichError(err);
    }
}
// src/Template/ClassSchedule/schedules.js
export async function deleteSchedule(id) {
    const { data } = await http.delete(`/ClassSchedules/${id}`);
    return data;
}
