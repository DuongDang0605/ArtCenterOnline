// src/Template/Reports/AttendanceExportPage.jsx
import React, { useEffect, useState } from "react";
import { getClasses } from "../Class/classes";
import { exportAttendanceMatrix } from "../../api/reports";

// ========== Helpers ==========
const pad2 = (n) => String(n).padStart(2, "0");

function d2input(d) {
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    return `${y}-${m}-${dd}`;
}
function isoToDMY(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
}
function dmyToISO(dmy) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dmy || "");
    if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3];
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return `${y}-${pad2(mo)}-${pad2(d)}`;
}
function firstLastOfCurrentMonth() {
    const now = new Date();
    return {
        first: new Date(now.getFullYear(), now.getMonth(), 1),
        last: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
}

export default function AttendanceExportPage() {
    const { first } = firstLastOfCurrentMonth();
    const today = new Date();

    const [classes, setClasses] = useState([]);
    const [classId, setClassId] = useState("");

    // Dùng 2 state: *Text* cho UI dd/MM/yyyy, *ISO* cho API yyyy-MM-dd
    const [fromISO, setFromISO] = useState(d2input(first));
    const [toISO, setToISO] = useState(d2input(today));
    const [fromText, setFromText] = useState(isoToDMY(d2input(first)));
    const [toText, setToText] = useState(isoToDMY(d2input(today)));

    const [includeCanceled, setIncludeCanceled] = useState(true);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getClasses();
                if (!alive) return;
                setClasses(Array.isArray(data) ? data : []);
            } catch (e) {
                if (!alive) return;
                setErr(e?.message || "Không tải được danh sách lớp");
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    async function onExport(e) {
        e.preventDefault();
        setErr("");

        if (!classId) {
            setErr("Vui lòng chọn lớp.");
            return;
        }
        if (!fromISO || !toISO) {
            setErr("Định dạng ngày không hợp lệ (dd/mm/yyyy).");
            return;
        }
        if (fromISO > toISO) {
            setErr("Từ ngày phải <= Đến ngày.");
            return;
        }

        setBusy(true);
        try {
            const res = await exportAttendanceMatrix({
                classId,
                from: fromISO,
                to: toISO,
                includeCanceled,
            });

            // Lấy tên file từ header nếu có
            const cd = res.headers?.["content-disposition"] || res.headers?.get?.("content-disposition");
            let filename = `attendance_${classId}_${fromISO}_${toISO}.xlsx`;
            if (cd) {
                const m = /filename[^;=\n]*=\s*(?:UTF-8''|")?([^;\n"]+)/i.exec(cd);
                if (m && m[1]) filename = decodeURIComponent(m[1]);
            }

            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            setErr(e?.message || "Xuất file thất bại");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <section className="content-header">
                <h1>Xuất điểm danh</h1>
                <small>Trích xuất ma trận Attendance theo lớp &amp; khoảng thời gian (Excel)</small>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">Bộ lọc</h3>
                    </div>
                    <div className="box-body">
                        {err && <div className="alert alert-danger">{err}</div>}

                        <form className="form-inline" onSubmit={onExport}>
                            <div className="form-group" style={{ marginRight: 12 }}>
                                <label style={{ marginRight: 6 }}>Lớp</label>
                                <select
                                    className="form-control"
                                    value={classId}
                                    onChange={(e) => setClassId(e.target.value)}
                                    required
                                >
                                    <option value="">— Chọn lớp —</option>
                                    {classes.map((c) => (
                                        <option key={c.classID} value={c.classID}>
                                            {c.className}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginRight: 12 }}>
                                <label style={{ marginRight: 6 }}>Từ ngày</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="dd/mm/yyyy"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={fromText}
                                    onChange={(e) => {
                                        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                        let out = digits;
                                        if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                        else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                        setFromText(out);
                                        const iso = dmyToISO(out);
                                        setFromISO(iso ?? "");
                                    }}
                                    onBlur={() => {
                                        const iso = dmyToISO(fromText);
                                        if (iso) setFromText(isoToDMY(iso));
                                    }}
                                />
                            </div>

                            <div className="form-group" style={{ marginRight: 12 }}>
                                <label style={{ marginRight: 6 }}>Đến ngày</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="dd/mm/yyyy"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={toText}
                                    onChange={(e) => {
                                        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                                        let out = digits;
                                        if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                        else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                        setToText(out);
                                        const iso = dmyToISO(out);
                                        setToISO(iso ?? "");
                                    }}
                                    onBlur={() => {
                                        const iso = dmyToISO(toText);
                                        if (iso) setToText(isoToDMY(iso));
                                    }}
                                />
                            </div>

                            <div className="checkbox" style={{ marginRight: 12 }}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={includeCanceled}
                                        onChange={(e) => setIncludeCanceled(e.target.checked)}
                                    />{" "}
                                    Bao gồm buổi hủy
                                </label>
                            </div>

                            {/* Nút hành động – hạ xuống một chút cho đều hàng */}
                            <div className="form-group" style={{ marginTop: 6 }}>
                                <button type="submit" className="btn btn-primary" disabled={busy}>
                                    {busy ? "Đang xuất..." : "Xuất Excel"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        </>
    );
}
