// src/Template/Session/SessionAttendancePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import http from "../../api/http";

export default function SessionAttendancePage() {
    const nav = useNavigate();
    const { id: sessionId } = useParams();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");

    const [meta, setMeta] = useState(null); // thông tin buổi học
    const [rows, setRows] = useState([]);   // danh sách học viên + trạng thái
    const [q, setQ] = useState("");         // ô tìm kiếm theo tên

    // Tải meta + roster (dùng axios -> tự gắn Authorization)
    useEffect(() => {
        let alive = true;
        async function load() {
            setLoading(true);
            setErr("");
            setOk("");
            try {
                // 1) Thông tin buổi học
                const { data: mJson } = await http.get(`/ClassSessions/${sessionId}`);
                // 2) Roster + điểm danh hiện có
                const { data: rJson } = await http.get(`/classsessions/${sessionId}/students`);

                if (!alive) return;

                setMeta(mJson || null);
                const mapped = (rJson || []).map((x, i) => ({
                    idx: i + 1,
                    studentId: x.studentId,
                    studentName: x.studentName,
                    isPresent: x.isPresent, // true | false | null
                    note: x.note ?? "",
                }));
                setRows(mapped);
            } catch (e) {
                setErr(e?.response?.data?.message || e?.message || "Tải dữ liệu thất bại.");
            } finally {
                if (alive) setLoading(false);
            }
        }
        load();
        return () => (alive = false);
    }, [sessionId]);

    // Lọc theo ô tìm kiếm
    const filtered = useMemo(() => {
        const k = q.trim().toLowerCase();
        if (!k) return rows;
        return rows.filter((r) => r.studentName?.toLowerCase().includes(k));
    }, [rows, q]);

    // Đổi 1 ô
    function updateRow(studentId, patch) {
        setRows((prev) =>
            prev.map((r) => (r.studentId === studentId ? { ...r, ...patch } : r))
        );
    }

    // Đánh dấu tất cả có mặt / vắng
    function markAll(val) {
        setRows((prev) => prev.map((r) => ({ ...r, isPresent: !!val })));
    }

    async function save() {
        setSaving(true);
        setErr("");
        setOk("");
        try {
            const payload = rows.map((r) => ({
                studentId: r.studentId,
                isPresent: !!r.isPresent, // null -> false
                note: r.note ?? "",
            }));
            const { data } = await http.post(`/classsessions/${sessionId}/attendance`, payload);
            setOk(data?.message || "Lưu điểm danh thành công.");
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || "Lưu điểm danh thất bại.";
            setErr(msg);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <section className="content">
                <div className="box box-primary">
                    <div className="box-body">
                        <i className="fa fa-spinner fa-spin" /> Đang tải...
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="content">
            <div className="box box-primary">
                <div className="box-header with-border">
                    <h3 className="box-title">Điểm danh buổi học</h3>
                    <div className="box-tools pull-right">
                        <button className="btn btn-default btn-sm" onClick={() => nav(-1)}>
                            Quay lại
                        </button>{" "}
                        <button className="btn btn-success btn-sm" onClick={() => markAll(true)}>
                            Tất cả có mặt
                        </button>{" "}
                        <button className="btn btn-warning btn-sm" onClick={() => markAll(false)}>
                            Tất cả vắng
                        </button>
                    </div>
                </div>

                <div className="box-body">
                    {/* Thông báo lỗi/ok */}
                    {err && (
                        <div className="alert alert-danger">
                            {String(err).startsWith("Session ") ? null : <i className="fa fa-exclamation-triangle" />} {err}
                        </div>
                    )}
                    {ok && (
                        <div className="alert alert-success">
                            <i className="fa fa-check" /> {ok}
                        </div>
                    )}

                    {/* Thanh tìm kiếm + nút lưu */}
                    <div className="row" style={{ marginBottom: 15 }}>
                        <div className="col-sm-8">
                            <div className="form-inline">
                                <div className="form-group" style={{ width: "100%" }}>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Tìm theo tên học viên..."
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="col-sm-4 text-right">
                            <button className="btn btn-default" onClick={() => nav(-1)} disabled={saving}>
                                Hủy
                            </button>{" "}
                            <button className="btn btn-primary" onClick={save} disabled={saving || rows.length === 0}>
                                {saving ? <i className="fa fa-spinner fa-spin" /> : <i className="fa fa-save" />} Lưu điểm danh
                            </button>
                        </div>
                    </div>

                    {/* Bảng danh sách */}
                    <div className="table-responsive">
                        <table className="table table-bordered table-hover">
                            <thead>
                                <tr>
                                    <th style={{ width: 70 }}>STT</th>
                                    <th>Học viên</th>
                                    <th style={{ width: 120, textAlign: "center" }}>Có mặt</th>
                                    <th>Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center text-muted">
                                            Không có dữ liệu
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((r, i) => (
                                        <tr key={r.studentId}>
                                            <td>{r.idx ?? i + 1}</td>
                                            <td>{r.studentName}</td>
                                            <td style={{ textAlign: "center" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!r.isPresent}
                                                    onChange={(e) => updateRow(r.studentId, { isPresent: e.target.checked })}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={r.note ?? ""}
                                                    onChange={(e) => updateRow(r.studentId, { note: e.target.value })}
                                                    placeholder="Ghi chú..."
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Tổng kết */}
                    <div className="text-muted">
                        Tổng: {rows.length} học viên • Có mặt: {rows.filter((x) => !!x.isPresent).length}
                    </div>
                </div>
            </div>

            {/* Meta buổi học (giữ nguyên thông tin, không thay UI) */}
            {meta && (
                <div className="box box-default">
                    <div className="box-body">
                        <div><b>Lớp:</b> {meta.className}</div>
                        <div>
                            <b>Ngày:</b> {meta.sessionDate} • <b>Giờ:</b> {meta.startTime}–{meta.endTime}
                        </div>
                        <div><b>Giáo viên:</b> {meta.teacherName || "(N/A)"} {meta.mainTeacherId && meta.mainTeacherId !== meta.teacherId ? "(thay GV)" : ""}</div>
                        {meta.note && <div><b>Ghi chú buổi:</b> {meta.note}</div>}
                    </div>
                </div>
            )}
        </section>
    );
}
