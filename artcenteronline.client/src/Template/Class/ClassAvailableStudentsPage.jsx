// src/Template/Class/ClassAvailableStudentsPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { addStudentToClass, addStudentsToClassBatch } from "./classStudents";
import { getActiveStudentsNotInClass } from "../Student/Students";
import { getClass } from "../Class/classes";
import { useAuth } from "../../auth/authCore";

export default function ClassAvailableStudentsPage() {
    const { classId } = useParams();
    const navigate = useNavigate();

    const auth = useAuth() || {};
    const roles = auth.roles || [];
    const isAdmin = auth.isAdmin ?? roles.includes("Admin");
    const isLoggedIn = !!auth?.user || !!auth?.token;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [classInfo, setClassInfo] = useState(null);
    const tableRef = useRef(null);
    const dtRef = useRef(null);

    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/login", { replace: true, state: { flash: "Vui lòng đăng nhập để tiếp tục." } });
            return;
        }
        if (!isAdmin) {
            setErr("Bạn không có quyền thực hiện thao tác này (chỉ Admin).");
            setLoading(false);
        }
    }, [isLoggedIn, isAdmin, navigate]);

    // Chuẩn hoá item
    const normalize = (x, i) => {
        const pick = (...keys) => keys.find((k) => x?.[k] !== undefined) ?? null;
        const id = x[pick("studentId", "StudentId", "studentID", "StudentID", "id")] ?? i;
        const name = x[pick("studentName", "StudentName", "name")] ?? "";
        const parent = x[pick("parentName", "ParentName")] ?? "";
        const phone = x[pick("phoneNumber", "PhoneNumber", "PhoneNumer")] ?? "";
        const address = x[pick("address", "Address", "adress", "Adress")] ?? "";
        const startRaw = x[pick("ngayBatDauHoc", "startDate", "StartDate")];
        let startDate = "";
        if (startRaw) {
            try {
                const d = new Date(startRaw);
                startDate = isNaN(d) ? String(startRaw) : d.toLocaleDateString("vi-VN");
            } catch {
                startDate = String(startRaw);
            }
        }
        return { id, name, parent, phone, address, startDate };
    };

    // Load data (chỉ Admin)
    useEffect(() => {
        if (!isLoggedIn || !isAdmin) return;
        let alive = true;
        (async () => {
            try {
                const data = await getActiveStudentsNotInClass(classId);
                const cls = await getClass(classId);
                const ClassName = cls?.ClassName ?? cls?.className;
                setClassInfo({ classId, ClassName });
                if (!alive) return;
                const arr = Array.isArray(data) ? data : [];
                setRows(arr.map((x, i) => normalize(x, i)));
            } catch (e) {
                if (alive) {
                    const s = e?.response?.status;
                    if (s === 401) {
                        navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                        return;
                    }
                    setErr(e?.userMessage || e?.message || "Fetch failed");
                }
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [classId, isLoggedIn, isAdmin, navigate]);

    // DataTable (AdminLTE)
    useEffect(() => {
        if (loading || err || !isAdmin) return;
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!el || !$.fn?.DataTable) return;

        const $table = $(el);
        if ($.fn.DataTable.isDataTable(el)) {
            try { $table.DataTable().destroy(); } catch { /* ignore */ }
        }

        const dt = $table.DataTable({
            autoWidth: false,
            lengthChange: true,
            searching: true,
            ordering: true,
            paging: true,
            info: true,
            pageLength: 10,
            dom: "<'row'<'col-sm-6'l><'col-sm-6'f>>tr<'row'<'col-sm-5'i><'col-sm-7'p>>",
            language: {
                search: "Tìm kiếm:",
                lengthMenu: "Hiện _MENU_ dòng",
                info: "Hiển thị _START_-_END_ / _TOTAL_ dòng",
                paginate: { previous: "Trước", next: "Sau" },
                zeroRecords: "Không có dữ liệu",
            },
            columnDefs: [
                { targets: 0, width: 30, orderable: false },
                { targets: -1, width: 140, orderable: false },
            ],
        });

        dt.columns.adjust();
        dtRef.current = dt;

        const onResize = () => dt.columns.adjust();
        window.addEventListener("resize", onResize);
        const obs = new MutationObserver(() => dt.columns.adjust());
        obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });

        return () => {
            window.removeEventListener("resize", onResize);
            obs.disconnect();
            try { dt.destroy(); } catch { /* ignore */ }
            dtRef.current = null;
        };
    }, [loading, err, rows, isAdmin]);

    // Actions
    const toggleSelect = (id, checked) => {
        const next = new Set(selected);
        if (checked) next.add(id);
        else next.delete(id);
        setSelected(next);
    };

    const handleAddOne = async (id) => {
        try {
            if (!isAdmin) { alert("Bạn không có quyền thực hiện thao tác này (chỉ Admin)."); return; }
            await addStudentToClass(classId, id);
            const cls = await getClass(classId);
            navigate("/classes", {
                replace: true,
                state: { flash: `Đã thêm 1 học viên vào lớp ${cls.className}` },
            });
        } catch (e) {
            if (e?.response?.status === 401) {
                navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                return;
            }
            alert(e?.userMessage || e?.message || "Thêm học viên thất bại");
        }
    };

    const handleAddSelected = async () => {
        if (selected.size === 0) return;
        try {
            if (!isAdmin) { alert("Bạn không có quyền thực hiện thao tác này (chỉ Admin)."); return; }
            const count = selected.size;
            const cls = await getClass(classId);
            await addStudentsToClassBatch(classId, Array.from(selected));
            navigate("/classes", {
                replace: true,
                state: { flash: `Đã thêm ${count} học viên vào lớp ${cls.className}` },
            });
        } catch (e) {
            if (e?.response?.status === 401) {
                navigate("/login", { replace: true, state: { flash: "Phiên đăng nhập đã hết hạn." } });
                return;
            }
            alert(e?.userMessage || e?.message || "Thêm hàng loạt thất bại");
        }
    };

    return (
        <>
            <section className="content-header">
                <h1>Học viên chưa thuộc lớp {classInfo?.ClassName}</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li><Link to="/classes">Lớp học</Link></li>
                    <li className="active">Thêm học viên vào lớp</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border" style={{ display: "flex", justifyContent: "space-between" }}>
                        <h3 className="box-title">Danh sách (chỉ “Đang học” & chưa thuộc lớp)</h3>
                        <div className="box-tools" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button className="btn btn-success btn-sm" onClick={handleAddSelected} disabled={!isAdmin || selected.size === 0}>
                                <i className="fa fa-user-plus" /> Thêm ({selected.size}) đã chọn
                            </button>
                            <button className="btn btn-default btn-sm" onClick={() => navigate(-1)}>
                                <i className="fa fa-arrow-left" /> Quay lại
                            </button>
                        </div>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}
                        {err && <p className="text-red" style={{ whiteSpace: "pre-wrap" }}>Lỗi: {err}</p>}

                        {!loading && !err && isAdmin && (
                            <div className="table-responsive">
                                <table
                                    id="AvailableStudentsTable"
                                    ref={tableRef}
                                    className="table table-bordered table-hover"
                                    style={{ width: "100%" }}
                                >
                                    <thead>
                                        <tr>
                                            <th>
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => {
                                                        const ckd = e.target.checked;
                                                        if (ckd) setSelected(new Set(rows.map((r) => r.id)));
                                                        else setSelected(new Set());
                                                    }}
                                                    checked={rows.length > 0 && selected.size === rows.length}
                                                    aria-label="Chọn tất cả"
                                                />
                                            </th>
                                            <th>ID</th>
                                            <th>Tên học viên</th>
                                            <th>Tên phụ huynh</th>
                                            <th>Số điện thoại</th>
                                            <th>Địa chỉ</th>
                                            <th>Ngày nhập học</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={r.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(r.id)}
                                                        onChange={(e) => toggleSelect(r.id, e.target.checked)}
                                                        aria-label={`Chọn ${r.name}`}
                                                    />
                                                </td>
                                                <td>{r.id}</td>
                                                <td>{r.name}</td>
                                                <td>{r.parent}</td>
                                                <td>{r.phone}</td>
                                                <td>{r.address}</td>
                                                <td>{r.startDate}</td>
                                                <td>
                                                    <button className="btn btn-xs btn-success" onClick={() => handleAddOne(r.id)} disabled={!isAdmin}>
                                                        <i className="fa fa-user-plus" /> Thêm
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
