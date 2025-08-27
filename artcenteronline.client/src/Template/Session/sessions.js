import http from "../../api/http";
import { readAuth } from "../../auth/authCore";

const BASE = "/ClassSessions"; // http.js đã baseURL = /api

function ymd(d) {
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}
function todayYMD() {
    return ymd(new Date());
}

function curUser() {
    return readAuth()?.user ?? null; // { userId, email, fullName, roles[], teacherId? }
}
function hasRole(name) {
    const u = curUser();
    return !!u?.roles?.some((r) => String(r).toLowerCase() === String(name).toLowerCase());
}
function isAdmin() { return hasRole("Admin"); }
function isTeacher() { return hasRole("Teacher"); }

/**
 * Lấy sessions của 1 class trong khoảng ngày.
 * - Admin: theo range truyền vào
 * - Teacher: MẶC ĐỊNH chỉ xem hôm nay (phục vụ SessionsPage), nhưng
 *   có thể bật { forCalendar: true } để dùng cho MonthlyCalendar (không ép hôm nay).
 */
export async function listSessions(classId, fromDate, toDate, opts = {}) {
    const { forCalendar = false } = opts;

    const params = {
        classId,
        from: ymd(fromDate),
        to: ymd(toDate),
    };

    if (!forCalendar && !isAdmin() && isTeacher()) {
        const u = curUser();
        const today = todayYMD();
        params.from = today;
        params.to = today;
        if (u?.teacherId != null) {
            // dùng /all để filter theo teacher nếu bạn muốn giữ đúng hành vi cũ
            const { data } = await http.get(`${BASE}/all`, {
                params: { classId, from: today, to: today, teacherId: u.teacherId },
            });
            return data;
        }
    }

    // Controller List: GET /api/ClassSessions?classId=&from=&to=
    const { data } = await http.get(`${BASE}`, { params });
    return data;
}

/**
 * Lấy tất cả sessions (range + optional classId/teacherId/status)
 * - Admin: theo filter truyền vào
 * - Teacher: MẶC ĐỊNH chỉ 1 ngày (hôm nay) + teacherId của mình (phục vụ SessionsPage)
 *   Có thể bật { forCalendar: true } để KHÔNG ép hôm nay (nếu sau này Calendar muốn dùng API này).
 */
export async function listAllSessions(opts = {}) {
    const { classId, teacherId, status, from, to, forCalendar = false } = opts;

    const params = {};
    if (classId) params.classId = classId;

    if (isAdmin()) {
        if (from) params.from = ymd(from);
        if (to) params.to = ymd(to);
        if (teacherId) params.teacherId = teacherId;
    } else if (isTeacher()) {
        if (forCalendar) {
            // cho phép teacher xem theo range được truyền (Calendar)
            params.from = from ? ymd(from) : todayYMD();
            params.to = to ? ymd(to) : todayYMD();
            if (teacherId) params.teacherId = teacherId; // tùy nhu cầu
        } else {
            // hành vi mặc định: chỉ hôm nay + buổi của chính mình
            const u = curUser();
            const today = todayYMD();
            params.from = today;
            params.to = today;
            params.teacherId = u?.teacherId;
        }
    } else {
        // role khác (nếu có) – để an toàn yêu cầu from/to
        if (from) params.from = ymd(from);
        if (to) params.to = ymd(to);
        if (teacherId) params.teacherId = teacherId;
    }

    if (status !== undefined && status !== null && status !== "") params.status = status;

    const { data } = await http.get(`${BASE}/all`, { params });
    return data;
}

/**
 * Đồng bộ tháng cho 1 lớp (chỉ Admin – BE phải enforce)
 */
export async function syncMonth(classId, year, month) {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;

    const { data } = await http.post(`${BASE}/sync-month/${classId}`, null, { params });
    return data;
}

/**
 * Cập nhật 1 session.
 * - Admin: được cập nhật
 * - Teacher: KHÔNG được cập nhật (chặn từ FE)
 */
export async function updateSession(sessionId, patch) {
    if (!isAdmin() && isTeacher()) {
        const err = new Error("Bạn không có quyền cập nhật buổi dạy.");
        err.status = 403;
        throw err;
    }
    const { data } = await http.patch(`${BASE}/${sessionId}`, patch || {});
    return data ?? { ok: true };
}

/**
 * Lấy chi tiết 1 session.
 */
export async function getSession(sessionId) {
    const { data } = await http.get(`${BASE}/${sessionId}`);
    return data;
}
