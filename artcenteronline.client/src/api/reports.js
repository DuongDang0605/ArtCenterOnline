// src/api/reports.js
import http from "./http";

export const getMonthlyOverview = (month /* "yyyy-MM" hoặc "yyyy-MM-01" */) => {
    const params = { month };
    return http.get("/Reports/MonthlyOverview", { params }).then((r) => r.data);
};

// NEW: export attendance matrix -> .xlsx
export const exportAttendanceMatrix = ({ classId, from, to, includeCanceled = true }) => {
    // from/to: string "yyyy-MM-dd" (input[type=date] value)
    const params = {
        classId: Number(classId),
        from,
        to,
        includeCanceled,
    };
    return http.get("/Reports/AttendanceMatrixExport", {
        params,
        responseType: "blob",
        // allow binary
    });
};
