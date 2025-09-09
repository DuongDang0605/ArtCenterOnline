// src/Template/Session/SessionAttendancePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import http from "../../api/http";
import { useAuth } from "../../auth/authCore";

function d2input(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoToDMY(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
}
function pickErr(e) {
    return (
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Đã có lỗi xảy ra."
    );
}

export default function SessionAttendancePage() {
    const nav = useNavigate();
    const { id: sessionId } = useParams();

    const auth = useAuth();
    const roles = Array.isArray(auth?.roles) ? auth.roles : [];
    const isAdmin = roles.includes("Admin");
    const isTeacher = roles.includes("Teacher");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");

    const [meta, setMeta] = useState(null); // thông tin buổi (className, sessionDate, startTime, endTime, teacherName, note)
    const [rows, setRows] = useState([]);   // [{studentId, studentName, isPresent|null, note}]
    const [q, setQ] = useState("");

    // today (local, yyyy-MM-dd)
    const todayISO = d2input(new Date());

    // ====== Load meta & roster ======
    useEffect(() => {
        let alive = true;

        (async () => {
            setLoading(true);
            setErr(""); setOk("");

            try {
                // 1) Meta buổi
                const { data: m } = await http.get(`/ClassSessions/${sessionId}`);
                if (!alive) return;

                // 2) Danh sách học sinh
                const { data: roster } = await http.get(`/classsessions/${sessionId}/students`);
                if (!alive) return;

                setMeta(m);
                const mapped = (Array.isArray(roster) ? roster : []).map((x) => ({
                    studentId: x.studentId ?? x.StudentId,
                    studentName: x.studentName ?? x.StudentName,
                    isPresent:
                        typeof x.isPresent === "boolean"
                            ? x.isPresent
                            : typeof x.IsPresent === "boolean"
                                ? x.IsPresent
                                : null,
                    note: x.note ?? x.Note ?? "",
                }));
                setRows(mapped);
            } catch (e) {
                setErr(pickErr(e));
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [sessionId]);

    // ====== Chỉ KHÓA NÚT LƯU: Admin luôn lưu được, Teacher chỉ khi HÔM NAY ======
    const isTodaySession = useMemo(
        () => (meta?.sessionDate ? String(meta.sessionDate).slice(0, 10) === todayISO : false),
        [meta, todayISO]
    );
    const canSave = isAdmin || (isTeacher && isTodaySession);

    // ====== Lọc theo tên nhanh ======
    const filtered = useMemo(() => {
        const key = (q || "").toLowerCase().trim();
        if (!key) return rows;
        return rows.filter((r) => (r.studentName || "").toLowerCase().includes(key));
    }, [rows, q]);

    function setRow(idx, patch) {
        setRows((prev) => {
            const next = prev.slice();
            next[idx] = { ...next[idx], ...patch };
            return next;
        });
    }

    async function onSave() {
        setErr(""); setOk("");
        try {
            setSaving(true);
            const payload = filtered.map((r) => ({
                studentId: r.studentId,
                isPresent: r.isPresent === true, // null/undefined => false
                note: r.note || null,
            }));
            if (payload.length === 0) {
                setErr("Không có dữ liệu để lưu.");
                setSaving(false);
                return;
            }
            const { data } = await http.post(`/classsessions/${sessionId}/attendance`, payload);
            // Thành công -> quay về danh sách buổi
            nav("/sessions", { state: { notice: data?.message || "Đã lưu điểm danh." } });
        } catch (e) {
            setErr(pickErr(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="content">
            <div className="content-header" style={{ marginBottom: 8 }}>
                <h1>Điểm danh buổi học</h1>
            </div>

            {err && <div className="alert alert-danger">{String(err)}</div>}
            {ok && <div className="alert alert-success">{String(ok)}</div>}

            {meta && (
                <div className="box box-default">
                    <div className="box-body">
                        <div><b>Lớp:</b> {meta.className}</div>
                        <div>
                            <b>Ngày:</b> {isoToDMY(meta.sessionDate)} • <b>Giờ:</b> {meta.startTime}–{meta.endTime}
                        </div>
                        <div><b>Giáo viên:</b> {meta.teacherName ?? "—"}</div>
                        {meta.note && <div><b>Ghi chú buổi:</b> {meta.note}</div>}

                        {isTeacher && !isTodaySession && (
                            <div className="alert alert-warning" style={{ marginTop: 10 }}>
                                Giáo viên chỉ được <b>Điểm danh</b> cho <b>ngày hôm nay</b>. Nếu cần <b>sửa điểm danh</b> liên hệ <b>Quản lý</b>.
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="box box-primary">
                <div className="box-header with-border">
                    <div className="row">
                        <div className="col-sm-6">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Tìm theo tên học sinh..."
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-sm-6 text-right">
                            <div className="btn-group btn-group-sm">
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={() => setRows((prev) => prev.map((r) => ({ ...r, isPresent: true })))}
                                    title="Đánh dấu tất cả Có mặt"
                                >
                                    Chọn tất cả: Có mặt
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={() => setRows((prev) => prev.map((r) => ({ ...r, isPresent: false })))}
                                    title="Đánh dấu tất cả Vắng"
                                >
                                    Chọn tất cả: Vắng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="box-body table-responsive no-padding">
                    {loading ? (
                        <div className="text-center text-muted" style={{ padding: 20 }}>Đang tải…</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-muted" style={{ padding: 20 }}>Không có học sinh.</div>
                    ) : (
                        <table className="table table-bordered" style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }} className="text-center">#</th>
                                    <th>Học sinh</th>
                                    <th style={{ width: 120 }} className="text-center">Có mặt</th>
                                    <th>Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r, idx) => (
                                    <tr key={r.studentId ?? idx}>
                                        <td className="text-center">{idx + 1}</td>
                                        <td>{r.studentName}</td>
                                        <td className="text-center">
                                            <input
                                                type="checkbox"
                                                checked={!!r.isPresent}
                                                onChange={(e) => setRow(idx, { isPresent: e.target.checked })}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={r.note || ""}
                                                onChange={(e) => setRow(idx, { note: e.target.value })}
                                                placeholder="Ghi chú (tuỳ chọn)"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="box-footer text-right">
                    <button type="button" className="btn btn-default" onClick={() => nav(-1)} disabled={saving}>
                        Quay lại
                    </button>
                    <button
                        type="button"
                        className="btn btn-success"
                        style={{ marginLeft: 8 }}
                        disabled={saving || !canSave}
                        onClick={onSave}
                        title={!canSave && isTeacher ? "Chỉ được LƯU điểm danh cho buổi hôm nay" : undefined}
                    >
                        {saving ? "Đang lưu…" : "Lưu điểm danh"}
                    </button>
                </div>
            </div>
        </section>
    );
}
