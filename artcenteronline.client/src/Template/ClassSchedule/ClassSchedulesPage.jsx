/* eslint-disable no-unused-vars */
// src/Template/ClassSchedule/ClassSchedulesPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { getSchedulesByClass, toggleSchedule, deleteSchedule } from "./schedules";

const VI_DOW = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const fmt = (t) => (t || "").slice(0, 5); // "HH:mm:ss" -> "HH:mm"

function extractErr(e) {
    const r = e?.response;
    return (
        r?.data?.message ||
        r?.data?.detail ||
        r?.data?.title ||
        (typeof r?.data === "string" ? r.data : null) ||
        e?.message ||
        "Có lỗi xảy ra."
    );
}

export default function ClassSchedulesPage() {
    const { classId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [notice, setNotice] = useState(location.state?.notice || "");

    const tableRef = useRef(null);
    const dtRef = useRef(null);

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const data = await getSchedulesByClass(classId);
            const list = (Array.isArray(data) ? data : []).filter(Boolean);
            setRows(list);
        } catch (e) {
            setErr(extractErr(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        if (location.state?.notice) {
            setTimeout(() => {
                navigate(".", { replace: true, state: {} });
            }, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classId]);

    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(""), 4000);
        return () => clearTimeout(t);
    }, [notice]);

    // Init DataTables
    useEffect(() => {
        if (loading || err) return;
        const $ = window.jQuery || window.$;
        if (!$ || !$.fn || !$.fn.DataTable) return;
        if (!tableRef.current || dtRef.current) return;

        tableRef.current.querySelector("tbody").innerHTML = "";

        dtRef.current = $(tableRef.current).DataTable({
            data: rows,
            paging: true,
            searching: false,
            ordering: false,
            responsive: true,
            autoWidth: false,
            language: { emptyTable: "Không có lịch học" },
            columnDefs: [{ targets: "_all", defaultContent: "" }],
            columns: [
                { title: "ID", data: null, width: 80, render: (row) => row.scheduleId ?? row.ScheduleId },
                { title: "Thứ", data: null, render: (row) => VI_DOW[row.dayOfWeek ?? row.DayOfWeek] },
                { title: "Bắt đầu", data: null, render: (row) => fmt(row.startTime ?? row.StartTime) },
                { title: "Kết thúc", data: null, render: (row) => fmt(row.endTime ?? row.EndTime) },
                {
                    title: "Giáo viên",
                    data: null,
                    render: (row) => {
                        const t =
                            row.teacherName ??
                            row.teacherFullName ??
                            row.teacher?.fullName ??
                            (row.teacherId != null ? `#${row.teacherId}` : "-");
                        return t || "-";
                    },
                },
                { title: "Ghi chú", data: null, render: (row) => row.note || "-" },
                {
                    title: "Trạng thái",
                    data: null,
                    render: (row) =>
                        row.isActive
                            ? '<span class="label label-success">Đang dùng</span>'
                            : '<span class="label label-default">Tắt</span>',
                },
                {
                    title: "Hành động",
                    data: null,
                    orderable: false,
                    searchable: false,
                    width: 260,
                    render: (row) => {
                        const id = row.scheduleId ?? row.ScheduleId;
                        return `
              <div class="btn-group">
                <a href="/classes/${classId}/schedules/${id}/edit" class="btn btn-xs btn-primary" style="margin-right:6px">
                  <i class="fa fa-edit"></i> Sửa
                </a>
                <button class="btn btn-xs btn-default js-toggle" data-id="${id}" style="margin-right:6px">
                  ${row.isActive ? "Tắt" : "Bật"}
                </button>
                <button class="btn btn-xs btn-danger js-del" data-id="${id}">
                  <i class="fa fa-trash"></i> Xoá
                </button>
              </div>`;
                    },
                },
            ],
        });

        $(tableRef.current).on("click", ".js-toggle", async function () {
            const id = Number(this.getAttribute("data-id"));
            try {
                const res = await toggleSchedule(id);
                setRows((prev) =>
                    prev.map((r) =>
                        (r.scheduleId ?? r.ScheduleId) === id ? { ...r, isActive: res?.isActive ?? !r.isActive } : r
                    )
                );
            } catch (e) {
                alert(extractErr(e));
            }
        });

        $(tableRef.current).on("click", ".js-del", async function () {
            const id = Number(this.getAttribute("data-id"));
            if (!window.confirm("Xoá lịch này?")) return;
            try {
                await deleteSchedule(id);
                setRows((prev) => prev.filter((r) => (r.scheduleId ?? r.ScheduleId) !== id));
            } catch (e) {
                alert(extractErr(e));
            }
        });
    }, [loading, err, rows, classId]);

    useEffect(() => {
        if (dtRef.current) {
            dtRef.current.clear();
            dtRef.current.rows.add(rows.filter(Boolean));
            dtRef.current.draw(false);
        }
    }, [rows]);

    useEffect(() => {
        return () => {
            const $ = window.jQuery || window.$;
            if (dtRef.current && tableRef.current && $) {
                $(tableRef.current).off("click", ".js-toggle");
                $(tableRef.current).off("click", ".js-del");
                dtRef.current.destroy(true);
                dtRef.current = null;
            }
        };
    }, []);

    const classNameHeader = rows[0]?.className || `#${classId}`;

    if (loading) {
        return (
            <section className="content">
                <div className="box">
                    <div className="box-body">Đang tải…</div>
                </div>
            </section>
        );
    }

    return (
        <>
            {/* Toast thành công (tự ẩn sau 4s) */}
            {notice && (
                <div
                    className="alert alert-success"
                    style={{
                        position: "fixed",
                        top: 70,
                        right: 16,
                        zIndex: 9999,
                        maxWidth: 420,
                        boxShadow: "0 4px 12px rgba(0,0,0,.15)",
                    }}
                >
                    <button type="button" className="close" onClick={() => setNotice("")} aria-label="Close" style={{ marginLeft: 8 }}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                    {notice}
                </div>
            )}

            {/* KHÔNG bọc thêm .content-wrapper */}
            <section className="content-header">
                <h1>Lịch học của lớp {classNameHeader}</h1>
                <ol className="breadcrumb">
                    <li><Link to="/">Trang chủ</Link></li>
                    <li className="active">Lịch học</li>
                </ol>
            </section>

            <section className="content">
                {err && <div className="alert alert-danger">{err}</div>}

                <div className="box">
                    <div className="box-header with-border">
                        <Link className="btn btn-primary" to={`/classes/${classId}/schedules/new`}>
                            <i className="fa fa-plus" /> Thêm lịch
                        </Link>
                        <Link to={`/classes`} className="btn btn-default" style={{ marginLeft: 10 }}>
                            Quay lại
                        </Link>
                    </div>

                    <div className="box-body table-responsive">
                        <table ref={tableRef} className="table table-hover" style={{ width: "100%" }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 80 }}>ID</th>
                                    <th>Thứ</th>
                                    <th>Bắt đầu</th>
                                    <th>Kết thúc</th>
                                    <th>Giáo viên</th>
                                    <th>Ghi chú</th>
                                    <th>Trạng thái</th>
                                    <th style={{ width: 260 }}>Hành động</th>
                                </tr>
                            </thead>
                            <tbody /> {/* DataTables sẽ render */}
                        </table>
                    </div>
                </div>
            </section>
        </>
    );
}
