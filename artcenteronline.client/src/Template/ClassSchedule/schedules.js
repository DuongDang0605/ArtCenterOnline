/* eslint-disable no-unused-vars */
// src/Template/ClassSchedule/schedules.js
import http from "../../api/http";
import { readAuth } from "../../auth/authCore";

const BASE = "/ClassSchedules";

function curUser() {
    return readAuth()?.user ?? null;
}
function isAdmin() {
    return curUser()?.roles?.some(r => String(r).toLowerCase() === "admin");
}
function isTeacher() {
    return curUser()?.roles?.some(r => String(r).toLowerCase() === "teacher");
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


// Lấy lịch học theo classId
export async function getSchedulesByClass(classId) {
    // Teacher vẫn gọi được, BE nên enforce lớp thuộc giáo viên đó
    const { data } = await http.get(`${BASE}/by-class/${classId}`);
    return data;
}

export async function getSchedule(id) {
    const { data } = await http.get(`${BASE}/${id}`);
    return data;
}
export async function createSchedule(payload) {
    if (!isAdmin()) {
        throw new Error("Chỉ Admin mới được tạo lịch học.");
    }
    try {
        const { data } = await http.post(BASE, payload);
        return data;
    } catch (err) {
        throw enrichError(err);
    }
}
// Kiểm tra trùng học sinh khi SỬA LỊCH MẪU
export async function checkStudentOverlapForSchedule(id, payload, opts = {}) {
    // payload: { ClassID, DayOfWeek, StartTime, EndTime, ... } là bản draft người dùng đang sửa
    // opts: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
    const qs = [];
    if (opts.from) qs.push(`from=${encodeURIComponent(opts.from)}`);
    if (opts.to) qs.push(`to=${encodeURIComponent(opts.to)}`);
    const url = `/ClassSchedules/${id}/check-student-overlap` + (qs.length ? `?${qs.join("&")}` : "");
    const { data } = await http.post(url, payload || {});
    return Array.isArray(data) ? data : [];
}


export async function updateSchedule(id, payload) {
    if (!isAdmin()) {
        throw new Error("Chỉ Admin mới được cập nhật lịch học.");
    }
    try {
        const { data } = await http.put(`${BASE}/${id}`, payload);
        return data;
    } catch (err) {
        throw enrichError(err);
    }
}

export async function deleteSchedule(id) {
    if (!isAdmin()) {
        throw new Error("Chỉ Admin mới được xoá lịch học.");
    }
    try {
        const res = await http.delete(`${BASE}/${id}`);
        return res?.status === 204 ? true : res?.data ?? true;
    } catch (err) {
        throw enrichError(err);
    }
}

export async function toggleSchedule(id) {
    if (!isAdmin()) {
        throw new Error("Chỉ Admin mới được thay đổi trạng thái lịch học.");
    }
    try {
        const { data } = await http.patch(`${BASE}/${id}/toggle`);
        return data;
    } catch (err) {
        throw enrichError(err);
    }
}
