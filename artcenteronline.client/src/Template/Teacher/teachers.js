// src/Template/Teacher/Teachers.js
import http from "../../api/http";

export async function getTeachers() {
    const { data } = await http.get("/Teachers");
    return data;
}

export async function getTeacher(id) {
    const { data } = await http.get(`/Teachers/${id}`);
    return data;
}

export async function createTeacher(payload) {
    const val = (k) => (k ?? undefined);
    const dto = {
        Email: val(payload?.Email ?? payload?.email),
        Password: val(payload?.Password ?? payload?.password),
        TeacherName: val(payload?.TeacherName ?? payload?.teacherName) ?? "",
        PhoneNumber: val(payload?.PhoneNumber ?? payload?.phoneNumber) ?? "",
        SoBuoiDayTrongThang: Number(payload?.SoBuoiDayTrongThang ?? payload?.soBuoiDayTrongThang) || 0,
        status: Number(payload?.status ?? payload?.Status)|| 1 ,
    };
    if (!dto.Email) throw new Error("Vui lòng nhập Email.");
    if (!dto.Password || String(dto.Password).length < 6)
        throw new Error("Password phải ít nhất 6 ký tự.");
    const { data } = await http.post("/Teachers", dto);
    return data;
}

// src/Template/Teacher/teachers.js
export async function updateTeacher(id, payload) {
    // Giữ 0/1 đúng ý, chỉ fallback khi null/undefined/""/NaN
    const raw = payload?.status ?? payload?.Status;
    const parsed = (raw === null || raw === undefined || raw === "") ? 1 : Number(raw);
    const status = Number.isNaN(parsed) ? 1 : parsed;

    const dto = {
        TeacherId: Number(id),
        // Không đổi email thì để undefined -> JSON sẽ bỏ qua
        Email: payload?.Email ?? payload?.email ?? undefined,
        TeacherName: payload?.TeacherName ?? payload?.teacherName ?? "",
        PhoneNumber: payload?.PhoneNumber ?? payload?.phoneNumber ?? "",
        SoBuoiDayTrongThang: Number(
            payload?.SoBuoiDayTrongThang ?? payload?.soBuoiDayTrongThang
        ) || 0,
        status, // <- quan trọng: giữ được 0
    };

    const res = await http.put(`/Teachers/${id}`, dto);
    return res?.status === 204 ? true : (res?.data ?? true);
}


export async function deleteTeacher(id) {
    const res = await http.delete(`/Teachers/${id}`);
    return res?.status === 204 ? true : res?.data ?? true;
}

export async function setTeacherPassword(id, newPassword) {
    if (!newPassword || String(newPassword).length < 6)
        throw new Error("Mật khẩu phải ít nhất 6 ký tự.");
    const { data } = await http.post(`/Teachers/${id}/set-password`, newPassword, {
        headers: { "Content-Type": "application/json" },
    });
    return data;
}
