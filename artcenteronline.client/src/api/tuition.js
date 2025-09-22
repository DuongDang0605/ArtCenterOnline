import http from "./http";

export const createTuitionRequest = (file) => {
    const form = new FormData();
    form.append("file", file);
    return http.post("/tuitionrequests", form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};

export const getMyTuitionRequests = () => http.get("/tuitionrequests/my");
export const cancelMyTuitionRequest = (id) => http.delete(`/tuitionrequests/${id}`);

export const adminListTuitionRequests = (status) =>
    http.get(`/tuitionrequests`, { params: { status } });

export const adminGetTuitionRequest = (id) => http.get(`/tuitionrequests/${id}`);
export const adminApproveTuitionRequest = (id, sessionsToAdd) =>
    http.post(`/tuitionrequests/${id}/approve`, { sessionsToAdd });

export const adminRejectTuitionRequest = (id, reason) =>
    http.post(`/tuitionrequests/${id}/reject`, { reason });
