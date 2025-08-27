import http from "../../api/http";

// LIST users (Admin xem được; nếu BE cho Teacher xem thì vẫn ok)
export async function getUsers() {
    const { data } = await http.get("/Users");
    return data;
}

// DETAIL user
export async function getUser(id) {
    const { data } = await http.get(`/Users/${id}`);
    return data;
}

// CREATE user — AdminOnly
export async function createUser(payload) {
    // payload ví dụ: { email, fullName, roles: ["Admin"|"Teacher"|...], password? }
    const { data } = await http.post("/Users", payload);
    return data;
}

// UPDATE user — AdminOnly
export async function updateUser(id, payload) {
    await http.put(`/Users/${id}`, payload);
    return true;
}

// DELETE user — AdminOnly
export async function deleteUser(id) {
    await http.delete(`/Users/${id}`);
    return true;
}

// (tuỳ chọn) đổi mật khẩu — AdminOnly hoặc Self (tuỳ BE)
export async function changePassword(id, payload) {
    // payload: { newPassword }
    await http.post(`/Users/${id}/change-password`, payload);
    return true;
}
