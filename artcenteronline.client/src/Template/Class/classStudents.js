// src/Template/Class/classStudents.js
import http from "../../api/http";

function enrichError(err) {
    const res = err?.response;
    // Ưu tiên message/detail/title hoặc chuỗi thô
    let msg =
        res?.data?.message ??
        res?.data?.detail ??
        res?.data?.title ??
        (typeof res?.data === "string" ? res.data : null) ??
        err?.message;

    // Nếu là ValidationProblem
    if (!msg && res?.data?.errors && typeof res.data.errors === "object") {
        const lines = [];
        for (const [k, arr] of Object.entries(res.data.errors)) {
            (arr || []).forEach((x) => lines.push(`${k}: ${x}`));
        }
        if (lines.length) msg = lines.join("\n");
    }
    err.userMessage = msg || "Đã xảy ra lỗi.";
    return err;
}

export async function addStudentToClass(classId, studentId) {
    try {
        const { data } = await http.post("/ClassStudents", {
            classID: Number(classId),
            studentId: Number(studentId),
        });
        return data;
    } catch (err) {
        throw enrichError(err);
    }
}

export async function addStudentsToClassBatch(classId, studentIds) {
    try {
        const { data } = await http.post("/ClassStudents/batch", {
            classID: Number(classId),
            studentIds: studentIds.map(Number),
        });
        return data;
    } catch (err) {
        throw enrichError(err);
    }
}

export async function getStudentsInClass(classId) {
    try {
        const { data } = await http.get(`/ClassStudents/in-class/${classId}`);
        return Array.isArray(data) ? data : [];
    } catch (err) {
        throw enrichError(err);
    }
}

export async function setClassStudentActive(classId, studentId, isActive) {
    try {
        await http.put(`/ClassStudents/${classId}/${studentId}/active`, { isActive: !!isActive });
        return true;
    } catch (err) {
        throw enrichError(err);
    }
}

export async function importClassStudentsExcel(classId, file) {
    try {
        const formData = new FormData();
        formData.append("file", file);

        const { data } = await http.post(
            `/ClassStudents/import-excel/${classId}`,
            formData,
            {
                headers: { "Content-Type": "multipart/form-data" },
            }
        );
        return data; // { errors: [...] } hoặc { pending: [...] }
    } catch (err) {
        throw enrichError(err);
    }
}

export async function downloadImportClassTemplate(classId) {
    try {
        const res = await http.get(`/ClassStudents/import/template/${classId}`, {
            responseType: "blob",
        });
        return res;
    } catch (err) {
        throw enrichError(err);
    }
}

