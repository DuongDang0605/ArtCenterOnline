/* eslint-disable no-unused-vars */
// src/Template/ClassSchedule/ClassSchedulesPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { getSchedulesByClass, toggleSchedule, deleteSchedule } from "./schedules";
import ConfirmDialog from "../../component/ConfirmDialog";
import { useToasts } from "../../hooks/useToasts";
import extractErr from "../../utils/extractErr";

const VI_DOW = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const fmt = (t) => (t || "").slice(0, 5); // "HH:mm:ss" -> "HH:mm"

export default function ClassSchedulesPage() {
    const { classId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Toasts đồng bộ (giống ClassesPage)
    const { showError, showSuccess, Toasts } = useToasts();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    // nhận notice/flash từ trang khác và xoá state ngay sau đó
    useEffect(() => {
        const n = location?.state?.notice || location?.state?.flash;
        if (n) {
            showSuccess(String(n));
            setTimeout(() => navigate(location.pathname, { replace: true, state: {} }), 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ====== fetch dữ liệu ======
    async function load() {
        setLoading(true);
        try {
            const data = await getSchedulesByClass(classId);
            const list = (Array.isArray(data) ? data : []).filter(Boolean);
            setRows(list);
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [classId]);

    // ====== DataTables ======
    const tableRef = useRef(null);
    const dtRef = useRef(null);

    // Khởi tạo DT đúng 1 lần sau khi đã có dữ liệu (tránh “mất bảng”)
    useEffect(() => {
        if (loading) return;
        const $ = window.jQuery || window.$;
        if (!$ || !$.fn || !$.fn.DataTable) return;
        if (!tableRef.current || dtRef.current) return; // đã init rồi thì bỏ

        // ❌ KHÔNG xoá tbody thủ công ở đây để tránh clear mất bảng (đã gây lỗi ở bản cũ) :contentReference[oaicite:4]{index=4}

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
                        const isActive = !!row.isActive;
                        return `
              <div class="btn-group">
                <a href="/classes/${classId}/schedules/${id}/edit" class="btn btn-xs btn-primary" style="margin-right:6px">
                  <i class="fa fa-edit"></i> Sửa
                </a>
                <button class="btn btn-xs btn-default js-toggle" data-id="${id}" data-active="${isActive}" style="margin-right:6px">
                  ${isActive ? "Tắt" : "Bật"}
                </button>
                <button class="btn btn-xs btn-danger js-del" data-id="${id}">
                  <i class="fa fa-trash"></i> Xoá
                </button>
              </div>`;
                    },
                },
            ],
        });

        // Chỉ mở modal xác nhận — KHÔNG gọi API trực tiếp tại handler
        $(tableRef.current).on("click", ".js-toggle", function () {
            const id = Number(this.getAttribute("data-id"));
            const isActive = String(this.getAttribute("data-active")) === "true";
            setToggleCfm({ open: true, id, isActive, busy: false });
        });

        $(tableRef.current).on("click", ".js-del", function () {
            const id = Number(this.getAttribute("data-id"));
            setDelCfm({ open: true, id, busy: false });
        });

        return () => {
            if (dtRef.current && tableRef.current && $) {
                $(tableRef.current).off("click", ".js-toggle");
                $(tableRef.current).off("click", ".js-del");
                try { dtRef.current.destroy(true); } catch { /* ignore */ }
                dtRef.current = null;
            }
        };
        // Chỉ phụ thuộc loading (sau khi false) — KHÔNG phụ thuộc rows để tránh destroy/re-init gây mất bảng
    }, [loading, classId]);

    // Đồng bộ dữ liệu vào bảng sau các thao tác (Bật/Tắt/Xoá) — không đụng DOM thủ công
    useEffect(() => {
        if (!dtRef.current) return;
        dtRef.current.clear();
        dtRef.current.rows.add(rows.filter(Boolean));
        dtRef.current.draw(false);
    }, [rows]);

    // ====== XÁC NHẬN: Bật/Tắt & Xoá ======
    const [toggleCfm, setToggleCfm] = useState({ open: false, id: null, isActive: true, busy: false });
    const [delCfm, setDelCfm] = useState({ open: false, id: null, busy: false });

    async function proceedToggle() {
        setToggleCfm((p) => ({ ...p, busy: true }));
        try {
            const id = toggleCfm.id;
            const res = await toggleSchedule(id);
            const nextActive = res?.isActive ?? !toggleCfm.isActive;

            setRows((prev) =>
                prev.map((r) =>
                    (r.scheduleId ?? r.ScheduleId) === id ? { ...r, isActive: nextActive } : r
                )
            );
            showSuccess(nextActive ? "Đã bật lịch học." : "Đã tắt lịch học.");
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setToggleCfm({ open: false, id: null, isActive: true, busy: false });
        }
    }

    async function proceedDelete() {
        setDelCfm((p) => ({ ...p, busy: true }));
        try {
            const id = delCfm.id;
            await deleteSchedule(id);
            setRows((prev) => prev.filter((r) => (r.scheduleId ?? r.ScheduleId) !== id));
            showSuccess("Đã xoá lịch học.");
        } catch (e) {
            showError(extractErr(e));
        } finally {
            setDelCfm({ open: false, id: null, busy: false });
        }
    }

    const classNameHeader = rows[0]?.className || `#${classId}`;

    return (
        <>
            <section className="content-header">
                <h1>Lịch học của lớp {classNameHeader}</h1>
                <ol className="breadcrumb">
                    <li><Link to="/"><i className="fa fa-dashboard" /> Trang chủ</Link></li>
                    <li><Link to="/classes">Lớp học</Link></li>
                    <li className="active">Lịch học</li>
                </ol>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        <h3 className="box-title">Danh sách lịch</h3>
                        <div className="box-tools">
                            <Link
                                to={`/classes/${classId}/schedules/new`}
                                className="btn btn-sm btn-primary"
                                title="Thêm lịch"
                            >
                                <i className="fa fa-plus" /> Thêm lịch
                            </Link>
                        </div>
                    </div>

                    <div className="box-body">
                        {loading && <p className="text-muted">Đang tải…</p>}
                        {!loading && (
                            <div className="table-responsive">
                                <table ref={tableRef} className="table table-bordered table-hover" style={{ width: "100%" }} />
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Xác nhận Bật/Tắt */}
            <ConfirmDialog
                open={toggleCfm.open}
                type={toggleCfm.isActive ? "warning" : "primary"}
                title="Xác nhận"
                message={toggleCfm.isActive ? "Bạn sắp tắt lịch học này. Tiếp tục?" : "Bạn sắp bật lịch học này. Tiếp tục?"}
                confirmText={toggleCfm.isActive ? "Tắt" : "Bật"}
                cancelText="Hủy"
                onCancel={() => setToggleCfm({ open: false, id: null, isActive: true, busy: false })}
                onConfirm={proceedToggle}
                busy={toggleCfm.busy}
            />

            {/* Xác nhận Xoá */}
            <ConfirmDialog
                open={delCfm.open}
                type="danger"
                title="Xác nhận xoá lịch"
                message="Xoá vĩnh viễn lịch học này?"
                confirmText="Xoá"
                cancelText="Hủy"
                onCancel={() => setDelCfm({ open: false, id: null, busy: false })}
                onConfirm={proceedDelete}
                busy={delCfm.busy}
            />

            <Toasts />
        </>
    );
}
