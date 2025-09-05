// src/Template/Class/ClassStudentsInClassPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getStudentsInClass, setClassStudentActive } from "../Class/classStudents";
import { getClass } from "../Class/classes";

export default function ClassStudentsInClassPage() {
    const { classId } = useParams();
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [classInfo, setClassInfo] = useState(null);

    const tableRef = useRef(null);
    const dtRef = useRef(null);

    const normalize = (x, i) => {
        const studentId = x.StudentId ?? x.studentId ?? i;
        const name = x.StudentName ?? x.studentName ?? "";
        const parent = x.ParentName ?? x.parentName ?? "";
        const phone = x.PhoneNumber ?? x.phoneNumber ?? "";
        const address = x.Adress ?? x.Address ?? "";
        const startRaw = x.StartDate ?? x.startDate ?? x.ngayBatDauHoc;
        const startDate = startRaw ? new Date(startRaw).toLocaleDateString("vi-VN") : "";
        const joinedRaw = x.JoinedDate ?? x.joinedDate;
        const joinedDate = joinedRaw ? new Date(joinedRaw).toLocaleDateString("vi-VN") : "";
        const isActive = !!(x.IsActive ?? x.isActive);
        return { studentId, name, parent, phone, address, startDate, joinedDate, isActive };
    };

    // Load data
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [list, cls] = await Promise.all([
                    getStudentsInClass(classId),
                    getClass(classId),
                ]);

                if (!alive) return;

                // Chuẩn hoá classInfo để header render tên lớp
                const className = cls?.className ?? cls?.ClassName ?? `#${classId}`;
                setClassInfo({ classId, className });

                // Chuẩn hoá danh sách
                const arr = Array.isArray(list) ? list : [];
                setRows(arr.map(normalize));
            } catch (e) {
                if (alive) setErr(e?.message || "Fetch failed");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [classId]);


    // DataTable (destroy không truyền true + delay init 1 nhịp)
    useEffect(() => {
        if (loading || err) return;
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!el || !$.fn?.DataTable) return;

        if ($.fn.DataTable.isDataTable(el)) {
            try { $(el).DataTable().destroy(); } catch {/* empty */ }
        }

        const timer = setTimeout(() => {
            const dt = $(el).DataTable({
                autoWidth: false,
                lengthChange: true,
                searching: true,
                ordering: true,
                paging: true,
                info: true,
                dom: "<'row'<'col-sm-6'l><'col-sm-6'f>>tr<'row'<'col-sm-5'i><'col-sm-7'p>>",
                language: {
                    search: "Tìm kiếm:",
                    lengthMenu: "Hiện _MENU_ dòng",
                    info: "Hiển thị _START_-_END_ / _TOTAL_ dòng",
                    paginate: { previous: "Trước", next: "Sau" },
                    zeroRecords: "Không có dữ liệu",
                },
                columnDefs: [
                    { targets: 0, width: 80 },
                    { targets: -1, width: 160, orderable: false },
                ],
            });

            dt.columns.adjust();
            dtRef.current = dt;

            const onResize = () => dt.columns.adjust();
            window.addEventListener("resize", onResize);
            const obs = new MutationObserver(() => dt.columns.adjust());
            obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });

            // cleanup cho lần re-init sau
            return () => {
                window.removeEventListener("resize", onResize);
                obs.disconnect();
            };
        }, 0);

        return () => {
            clearTimeout(timer);
            try { $(el).DataTable().destroy(); } catch {/* empty */ }
            dtRef.current = null;
        };
    }, [loading, err, rows]);

    const toggleActive = async (studentId, curr) => {
        try {
            await setClassStudentActive(classId, studentId, !curr);
            setRows(prev =>
                prev.map(r => r.studentId === studentId ? { ...r, isActive: !curr } : r)
            );
        } catch (e) {
            alert(e?.message || "Cập nhật IsActive thất bại");
        }
    };

    return (
        <>
            <section className="content-header">
                <h1>Học viên trong lớp  {classInfo?.className}</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Trang chủ</a></li>
                    <li><Link to="/classes">Lớp học</Link></li>
                    <li className="active">Danh sách học viên</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border" style={{ display: "flex", justifyContent: "space-between" }}>
                        <h3 className="box-title">Danh sách (có thể bật/tắt IsActive)</h3>
                        <div className="box-tools" style={{ display: "flex", gap: 8 }}>
                            <Link to={`/classes/${classId}/available-students`} className="btn btn-success btn-sm">
                                <i className="fa fa-user-plus" /> Thêm học viên
                            </Link>
                            <button className="btn btn-default btn-sm" onClick={() => navigate(-1)}>
                                <i className="fa fa-arrow-left" /> Quay lại
                            </button>
                        </div>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}
                        {err && <p className="text-red">Lỗi: {err}</p>}

                        {!loading && !err && (
                            <div className="table-responsive">
                                <table
                                    id="ClassStudentsTable"
                                    ref={tableRef}
                                    className="table table-bordered table-hover"
                                    style={{ width: "100%" }}
                                >
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Tên học viên</th>
                                            <th>Tên phụ huynh</th>
                                            <th>SĐT</th>
                                            <th>Địa chỉ</th>
                                            <th>Ngày nhập học</th>
                                            <th>Ngày vào lớp</th>
                                            <th>IsActive</th>
                                            <th>Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map(r => (
                                            <tr key={r.studentId}>
                                                <td>{r.studentId}</td>
                                                <td>{r.name}</td>
                                                <td>{r.parent}</td>
                                                <td>{r.phone}</td>
                                                <td>{r.address}</td>
                                                <td>{r.startDate}</td>
                                                <td>{r.joinedDate}</td>
                                                <td>
                                                    <span className={`label ${r.isActive ? "label-success" : "label-default"}`}>
                                                        {r.isActive ? "Đang học" : "Ngừng học"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className={`btn btn-xs ${r.isActive ? "btn-warning" : "btn-success"}`}
                                                        onClick={() => toggleActive(r.studentId, r.isActive)}
                                                    >
                                                        <i className="fa fa-toggle-on" /> {r.isActive ? "Tắt" : "Bật"}
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
