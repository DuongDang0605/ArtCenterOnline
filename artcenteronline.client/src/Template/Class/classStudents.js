// src/Template/Class/classStudents.js
import http from "../../api/http";

export async function addStudentToClass(classId, studentId) {
    const { data } = await http.post("/ClassStudents", {
        classID: Number(classId),
        studentId: Number(studentId),
    });
    return data;
}

export async function addStudentsToClassBatch(classId, studentIds) {
    const { data } = await http.post("/ClassStudents/batch", {
        classID: Number(classId),
        studentIds: studentIds.map(Number),
    });
    return data;
}

export async function getStudentsInClass(classId) {
    const { data } = await http.get(`/ClassStudents/in-class/${classId}`);
    return Array.isArray(data) ? data : [];
}

export async function setClassStudentActive(classId, studentId, isActive) {
    await http.put(`/ClassStudents/${classId}/${studentId}/active`, { isActive: !!isActive });
    return true;
}
