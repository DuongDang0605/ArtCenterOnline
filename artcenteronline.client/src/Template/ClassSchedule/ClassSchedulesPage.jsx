// src/Template/ClassSchedule/ClassSchedulesPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSchedulesByClass, deleteSchedule, toggleSchedule } from "./schedules";

const VI_DOW = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const fmt = (t) => (t || "").slice(0, 5); // "HH:mm:ss" -> "HH:mm"

export default function ClassSchedulesPage() {
    const { classId } = useParams();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const tableRef = useRef(null);
    const dtRef = useRef(null);

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const data = await getSchedulesByClass(classId);
            console.log("Schedules:", data);
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setErr(e?.message || "Fetch failed");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [classId]);

    // Khởi tạo DataTable 1 lần
    useEffect(() => {
        if (!loading && !err && tableRef.current) {
            const $ = window.jQuery || window.$;
            if ($?.fn?.DataTable && !dtRef.current) {
                dtRef.current = $(tableRef.current).DataTable({
                    autoWidth: false,
                    lengthChange: true,
                    searching: true,
                    ordering: true,
                    paging: true,
                    info: true,
                    dom: "<'row'<'col-sm-6'l><'col-sm-6'f>>tr<'row'<'col-sm-5'i><'col-sm-7'p>>",
                    language: {
                        search: "Tìm kiếm:", lengthMenu: "Hiện _MENU_ dòng",
                        info: "Hiển thị _START_-_END_ / _TOTAL_ dòng",
                        paginate: { previous: "Trước", next: "Sau" },
                        zeroRecords: "Không có dữ liệu",
                    },
                });
            }
        }
        return () => {
            if (dtRef.current) {
                try { dtRef.current.destroy(true); } catch { /* empty */ }
                dtRef.current = null;
            }
        };
    }, [loading, err]);

    // Cập nhật dữ liệu vào DataTable khi rows thay đổi
    useEffect(() => {
        if (dtRef.current) {
            dtRef.current.clear();
            rows.forEach((x) => {
                dtRef.current.row.add([
                    x.scheduleId,
                    VI_DOW[x.dayOfWeek],
                    fmt(x.startTime),
                    fmt(x.endTime),
                    x.note || "-",
                    x.isActive
                        ? '<span class="label label-success">Active</span>'
                        : '<span class="label label-default">Inactive</span>',
                    `
            <a href="/classes/${classId}/schedules/${x.scheduleId}/edit" class="btn btn-xs btn-primary" style="margin-right:6px">
              <i class="fa fa-edit"></i> Sửa
            </a>
            <button class="btn btn-xs btn-warning btn-toggle" data-id="${x.scheduleId}" style="margin-right:6px">
              <i class="fa fa-toggle-on"></i> Bật/Tắt
            </button>
            <button class="btn btn-xs btn-danger btn-delete" data-id="${x.scheduleId}">
              <i class="fa fa-trash"></i> Xoá
            </button>
          `,
                ]);
            });
            dtRef.current.draw(false);
        }
    }, [rows, classId]);

    // Gắn sự kiện nút toggle/delete sau khi vẽ
    useEffect(() => {
        if (!dtRef.current) return;
        const $ = window.jQuery || window.$;
        const table = $(tableRef.current);

        const onToggleClick = async (e) => {
            const id = e.target.closest("button")?.dataset.id;
            if (id) {
                try { await toggleSchedule(id); await load(); } catch (err) { alert(err); }
            }
        };
        const onDeleteClick = async (e) => {
            const id = e.target.closest("button")?.dataset.id;
            if (id && confirm("Xoá lịch học này?")) {
                try { await deleteSchedule(id); await load(); } catch (err) { alert(err); }
            }
        };

        table.on("click", ".btn-toggle", onToggleClick);
        table.on("click", ".btn-delete", onDeleteClick);

        return () => {
            table.off("click", ".btn-toggle", onToggleClick);
            table.off("click", ".btn-delete", onDeleteClick);
        };
    }, [rows]);

    return (
        <>
            <section className="content-header">
                <h1>Lịch học theo tuần · Lớp #{classId}</h1>
                <ol className="breadcrumb">
                    <li><a href="#"><i className="fa fa-dashboard" /> Home</a></li>
                    <li><Link to="/classes">Class</Link></li>
                    <li className="active">Schedules</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <Link to={`/classes/${classId}/schedules/new`} className="btn btn-primary">
                            <i className="fa fa-plus" /> Thêm lịch học
                        </Link>
                        <Link to="/classes" className="btn btn-default" style={{ marginLeft: 8 }}>
                            <i className="fa fa-arrow-left" /> Quay lại danh sách lớp
                        </Link>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}
                        {err && <p className="text-red">Lỗi: {err}</p>}

                        {!loading && !err && (
                            <div className="table-responsive">
                                <table ref={tableRef} className="table table-bordered table-hover" style={{ width: "100%" }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 80 }}>ID</th>
                                            <th>Thứ</th>
                                            <th>Bắt đầu</th>
                                            <th>Kết thúc</th>
                                            <th>Ghi chú</th>
                                            <th>Trạng thái</th>
                                            <th style={{ width: 260 }}>Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
