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
    const { data } = await http.post(BASE, payload);
    return data;
}

export async function updateSchedule(id, payload) {
    if (!isAdmin()) {
        throw new Error("Chỉ Admin mới được cập nhật lịch học.");
    }
    const { data } = await http.put(`${BASE}/${id}`, payload);
    return data;
}

export async function deleteSchedule(id) {
    if (!isAdmin()) {
        throw new Error("Chỉ Admin mới được xoá lịch học.");
    }
    const res = await http.delete(`${BASE}/${id}`);
    return res?.status === 204 ? true : res?.data ?? true;
}

export async function toggleSchedule(id) {
    if (!isAdmin()) {
        throw new Error("Chỉ Admin mới được thay đổi trạng thái lịch học.");
    }
    const { data } = await http.patch(`${BASE}/${id}/toggle`);
    return data;
}
