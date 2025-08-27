// src/Template/Class/classes.js
import http from "../../api/http";

export async function getClasses() {
    const { data } = await http.get("/Classes");
    return data;
}

export async function getClass(id) {
    const { data } = await http.get(`/Classes/${id}`);
    return data;
}

// payload: { className, dayStart(ISO|null), branch, status, mainTeacherId|null }
export async function createClass(payload) {
    const { data } = await http.post("/Classes", payload);
    return data;
}

// payload: same as create + server yêu cầu classID khớp id
export async function updateClass(id, payload) {
    await http.put(`/Classes/${id}`, { ...payload, classID: id });
    return true;
}

export async function deleteClass(id) {
    await http.delete(`/Classes/${id}`);
    return true;
}
