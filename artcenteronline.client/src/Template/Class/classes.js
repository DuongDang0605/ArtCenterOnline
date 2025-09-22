// src/Template/Class/classes.js
import http from "../../api/http";

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
    try {
        const { data } = await http.post("/Classes", payload);
        return data;
    } catch (err) {
        throw enrichError(err);
    }
}

// payload: same as create + server yêu cầu classID khớp id
export async function updateClass(id, payload) {
    try {
        await http.put(`/Classes/${id}`, { ...payload, classID: id });
        return true;
    } catch (err) {
        throw enrichError(err); // ⬅️ GIỮ axios error + gắn userMessage
    }
}

export async function deleteClass(id) {
    try {
        await http.delete(`/Classes/${id}`);
        return true;
    } catch (err) {
        throw enrichError(err);
    }
}

// src/Template/Class/classes.js


export async function searchClasses(keyword) {
    try {
        const { data } = await http.get(`/Classes`, { params: { q: keyword } });
        return data; // [{ classId, className, branch }]
    } catch (err) {
        throw enrichError(err);
    }
}
