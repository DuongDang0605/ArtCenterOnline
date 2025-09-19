// src/Template/Student/students.js
import http from "../../api/http";

// Lấy danh sách tất cả học viên (Admin + Teacher)
export async function getStudents() {
    const { data } = await http.get("/Students");
    return data;
}

// Thêm mới học viên (AdminOnly)
export async function createStudent(payload) {
    const { data } = await http.post("/Students", payload);
    return data;
}

// Cập nhật học viên (AdminOnly)
export async function updateStudent(id, payload) {
    const serverShape = {
        StudentId: Number(id),
        StudentName: payload.StudentName,
        ParentName: payload.ParentName,
        PhoneNumber: payload.PhoneNumber,
        Adress: payload.Adress,
        ngayBatDauHoc: payload.ngayBatDauHoc,
        SoBuoiHocConLai: payload.SoBuoiHocConLai,
        SoBuoiHocDaHoc: payload.SoBuoiHocDaHoc,
        Status: payload.Status,
    };
    await http.put(`/Students/${id}`, serverShape);
    return true;
}

// Xoá học viên (AdminOnly)
export async function deleteStudent(id) {
    await http.delete(`/Students/${id}`);
    return true;
}

// Lấy chi tiết học viên
export async function getStudent(id) {
    const { data } = await http.get(`/Students/${id}`);
    return data;
}

// Lấy danh sách học viên đang học nhưng chưa thuộc lớp (Admin + Teacher)
export async function getActiveStudentsNotInClass(classId) {
    const { data } = await http.get(`/Students/not-in-class/${classId}`);
    return data;
}
export async function getMyProfile() {
    const { data } = await http.get("/Students/me");
    return data;
}
export async function updateMyProfile(payload) {
    // payload: { studentName?, parentName?, phoneNumber?, adress? }
    const { data } = await http.put("/Students/me", payload);
    return data; // trả về bản hồ sơ sau cập nhật
}
// --- Import Excel (server-parse) ---
export async function importStudentsExcel(file) {
    const form = new FormData();
    form.append("file", file);
    const { data } = await http.post("/Students/import/excel", form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data; // { stagingId, items } hoặc { errors: [{row, message}, ...] }
}

export async function commitImport(stagingId) {
    const { data } = await http.post(`/Students/import/${encodeURIComponent(stagingId)}/commit`);
    return data; // { inserted, skipped? }
}

export async function rollbackImport(stagingId) {
    await http.delete(`/Students/import/${encodeURIComponent(stagingId)}`);
    return true;
}
// Tải file mẫu (giữ header Authorization)
export async function downloadImportTemplate() {
    // http là axios instance đã cấu hình baseURL '/api' + token
    const res = await http.get("/Students/import/template", { responseType: "blob" });
    return res; // cần headers để lấy filename
}
