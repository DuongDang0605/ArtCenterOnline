// src/api/reports.js
import http from "./http";

export const getMonthlyOverview = (month /* "yyyy-MM" hoặc "yyyy-MM-01" */) => {
    const params = { month };
    return http.get("/Reports/MonthlyOverview", { params }).then((r) => r.data);
};
// src/api/reports.js
export const getWebTrafficDaily = ({ from, to, path }) =>
    http.get("/Reports/web-traffic/daily", { params: { from, to, path } }).then(r => r.data);

export const getWebTrafficMonthly = ({ fromYM, toYM, path }) =>
    http.get("/Reports/web-traffic/monthly", { params: { from: fromYM, to: toYM, path } }).then(r => r.data);

// NEW: Login reports
export const getLoginDaily = ({ from, to }) =>
    http.get("/Reports/logins/daily", { params: { from, to } }).then((r) => r.data);

export const getLoginMonthly = ({ fromYM, toYM }) =>
    http
        .get("/Reports/logins/monthly", { params: { from: fromYM, to: toYM } })
        .then((r) => r.data);

export const getLoginByUser = ({ from, to, role, keyword }) =>
    http
        .get("/Reports/logins/by-user", { params: { from, to, role, keyword } })
        .then((r) => r.data);

// (giữ nguyên)
export const exportAttendanceMatrix = ({ classId, from, to, includeCanceled = true }) => {
    const params = {
        classId: Number(classId),
        from,
        to,
        includeCanceled,
    };
    return http.get("/Reports/AttendanceMatrixExport", {
        params,
        responseType: "blob",
    });
};
export const getNewStudents = ({ from, to }) =>
    http.get("/Reports/students/new", { params: { from, to } }).then(r => r.data);

export const getNewClasses = ({ from, to }) =>
    http.get("/Reports/classes/created", { params: { from, to } }).then(r => r.data);