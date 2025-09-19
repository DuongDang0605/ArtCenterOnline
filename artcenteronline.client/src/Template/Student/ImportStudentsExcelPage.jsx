// src/Template/Student/ImportStudentsExcelPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    importStudentsExcel,
    commitImport,
    rollbackImport,
    downloadImportTemplate,
} from "./students";

const AUTO = 5000;

function useToast() {
    const [msg, setMsg] = useState("");
    const [left, setLeft] = useState(0);
    useEffect(() => {
        if (!msg) return;
        const start = Date.now();
        const iv = setInterval(() => {
            const t = Math.max(0, AUTO - (Date.now() - start));
            setLeft(t);
            if (t === 0) setMsg("");
        }, 100);
        return () => clearInterval(iv);
    }, [msg]);
    return {
        msg,
        left,
        show: (m) => {
            setMsg(m || "Đã xảy ra lỗi.");
            setLeft(AUTO);
        },
        hide: () => setMsg(""),
    };
}

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

export default function ImportStudentsExcelPage() {
    const nav = useNavigate();
    const toast = useToast();

    const [fileName, setFileName] = useState("");
    const [uploading, setUploading] = useState(false);
    const [stagingId, setStagingId] = useState("");
    const [errors, setErrors] = useState([]); // [{ row, message }]
    const [rows, setRows] = useState([]); // dữ liệu preview

    const [errPage, setErrPage] = useState(1);
    const errPageSize = 10;
    const totalErrPages = Math.max(1, Math.ceil(errors.length / errPageSize));
    const pagedErrors = errors.slice((errPage - 1) * errPageSize, errPage * errPageSize);

    const tableRef = useRef(null);
    const dtRef = useRef(null);
    const fileRef = useRef(null); // để reset input file

    // ---- Utils: DataTable ----
    const destroyDataTable = () => {
        const $ = window.jQuery || window.$;
        try {
            if ($?.fn?.DataTable && dtRef.current) {
                dtRef.current.destroy(true);
                dtRef.current = null;
            }
        } catch { /* empty */ }
    };

    // Chuẩn hoá item cho bảng preview — KHÔNG có "Số buổi còn lại"
    const normalizeItem = (x, i) => {
        const pick = (...keys) => keys.find((k) => x?.[k] !== undefined) ?? null;
        const id = x[pick("studentId", "StudentId", "id")] ?? i + 1;
        const name = x[pick("studentName", "StudentName", "name")] ?? "";
        const parent = x[pick("parentName", "ParentName")] ?? "";
        const phone = x[pick("phoneNumber", "PhoneNumber")] ?? "";
        const address = x[pick("address", "Address", "adress", "Adress")] ?? "";
        const email = x[pick("email", "Email")] ?? "";
        const startRaw = x[pick("ngayBatDauHoc", "startDate", "StartDate")] ?? "";
        let startDate = "";
        if (startRaw) {
            try {
                // BE trả ISO yyyy-MM-dd; render dd/MM/yyyy
                const [y, m, d] = String(startRaw).split("-").map(Number);
                if (y && m && d) {
                    startDate = `${String(d).padStart(2, "0")}/${String(m).padStart(
                        2,
                        "0"
                    )}/${y}`;
                } else {
                    const dt = new Date(startRaw);
                    startDate = isNaN(dt) ? String(startRaw) : dt.toLocaleDateString("vi-VN");
                }
            } catch {
                startDate = String(startRaw);
            }
        }
        const learned = x[pick("soBuoiHocDaHoc", "SoBuoiHocDaHoc")] ?? 0;
        const statusNum = (() => {
            const raw = x[pick("status", "Status")] ?? 1;
            if (typeof raw === "number") return raw ? 1 : 0;
            if (typeof raw === "boolean") return raw ? 1 : 0;
            const s = String(raw).trim().toLowerCase();
            return s === "1" || s === "active" || s === "đang học" ? 1 : 0;
        })();
        return { id, name, parent, phone, address, email, startDate, learned, statusNum };
    };

    useEffect(() => {
        setErrPage(1);
    }, [errors]);

    // Khởi tạo DataTable khi có rows
    useEffect(() => {
        const $ = window.jQuery || window.$;
        const el = tableRef.current;
        if (!rows.length || !$.fn?.DataTable || !el) {
            // Nếu không có rows → dọn bảng cũ nếu còn
            if (!rows.length) destroyDataTable();
            return;
        }

        if ($.fn.DataTable.isDataTable(el)) $(el).DataTable().destroy(true);

        const dt = $(el).DataTable({
            autoWidth: false,
            lengthChange: true,
            searching: true,
            ordering: true,
            paging: true,
            info: true,
            dom: "<'row'<'col-sm-6'l><'col-sm-6'f>>tr<'row'<'col-sm-5'i><'col-sm-7'p>>",
            language: {
                decimal: ",",
                thousands: ".",
                emptyTable: "Không có dữ liệu",
                info: "Hiển thị _START_–_END_ trên tổng _TOTAL_ dòng",
                infoEmpty: "Hiển thị 0–0 trên tổng 0 dòng",
                infoFiltered: "(lọc từ _MAX_ dòng)",
                lengthMenu: "Hiện _MENU_ dòng",
                loadingRecords: "Đang tải...",
                processing: "Đang xử lý...",
                search: "Tìm kiếm:",
                zeroRecords: "Không tìm thấy kết quả phù hợp",
                paginate: { first: "Đầu", last: "Cuối", next: "Sau", previous: "Trước" },
                aria: { sortAscending: ": sắp xếp tăng dần", sortDescending: ": sắp xếp giảm dần" },
            },
            columnDefs: [
                { targets: 0, width: 80 }, // ID
                { targets: 7, width: 120 }, // learned
                { targets: 8, width: 120 }, // status
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
            try {
                dt.destroy(true);
            } catch { /* empty */ }
            dtRef.current = null;
        };
    }, [rows]);

    // ---- Actions ----
    async function onDownloadTemplate() {
        try {
            const res = await downloadImportTemplate();
            const blob = new Blob([res.data], {
                type:
                    res.headers["content-type"] ||
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            // Ép tên phía client để tránh sai khác header
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "mau-import-hocvien.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (ex) {
            toast.show(extractErr(ex));
        }
    }

    function resetInputFile() {
        if (fileRef.current) fileRef.current.value = "";
        setFileName("");
    }

    async function onFileChanged(e) {
        const f = e.target.files?.[0];
        if (!f) return;

        // Nếu đang có staging cũ → rollback trước khi xử lý file mới
        if (stagingId) {
            try {
                await rollbackImport(stagingId);
            } catch {
                /* ignore */
            }
        }

        // Dọn trạng thái cũ
        destroyDataTable();
        setErrors([]);
        setRows([]);
        setStagingId("");
        setFileName(f.name);

        setUploading(true);
        try {
            const { stagingId: sid, items, errors } = await importStudentsExcel(f); // server parse + validate
            if (errors && errors.length) {
                setErrors(errors); // [{row, message}]
                return;
            }
            setStagingId(sid);
            setRows(items.map((x, i) => normalizeItem(x, i)));
        } catch (ex) {
            const errs = ex?.response?.data?.errors;
            if (Array.isArray(errs) && errs.length) setErrors(errs);
            else toast.show(extractErr(ex));
        } finally {
            setUploading(false);
        }
    }

    async function onConfirm() {
        if (!stagingId) return;
        try {
            await commitImport(stagingId);
            nav("/students", {
                state: { notice: `Đã nhập ${rows.length} học viên từ Excel.` },
            });
        } catch (ex) {
            const errs = ex?.response?.data?.errors;
            if (Array.isArray(errs) && errs.length) setErrors(errs);
            else toast.show(extractErr(ex));
        }
    }

    async function onRollback() {
        // Luôn cố gắng xóa staging trên BE nếu có
        if (stagingId) {
            try {
                await rollbackImport(stagingId);
            } catch {
                /* ignore */
            }
        }
        // Dọn sạch mọi thứ trên FE
        destroyDataTable();
        setRows([]);
        setErrors([]);
        setStagingId("");
        resetInputFile(); // cho phép chọn lại đúng file cũ
    }

    return (
        <div>
            <section className="content-header">
                <h1>NHẬP HỌC VIÊN TỪ EXCEL</h1>
                <ol className="breadcrumb">
                    <li>
                        <Link to="/">
                            <i className="fa fa-dashboard" /> Trang chủ
                        </Link>
                    </li>
                    <li>
                        <Link to="/students">Học viên</Link>
                    </li>
                    <li className="active">Nhập Excel</li>
                </ol>
            </section>

            <section className="content">
                <div className="box box-primary">
                    <div className="box-header with-border">
                        <h3 className="box-title">Tải file Excel</h3>
                    </div>
                    <div className="box-body">
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={onFileChanged}
                            disabled={uploading}
                        />
                        {fileName && (
                            <p className="text-muted" style={{ marginTop: 8 }}>
                                Đã chọn: <strong>{fileName}</strong>
                            </p>
                        )}

                        <div className="box-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
                            <p className="help-block" style={{ marginTop: 8 }}>
                                <button
                                    type="button"
                                    className="btn btn-link"
                                    onClick={onDownloadTemplate}
                                >
                                    <i className="fa fa-download" /> Tải file mẫu
                                </button>
                                <span className="text-muted" style={{ marginLeft: 8 }}>
                                    Hệ thống chấp nhận .xlsx, .xls, .csv. Định dạng ngày: dd/MM/yyyy.
                                </span>
                            </p>
                            {uploading && (
                                <p className="text-muted">
                                    <i className="fa fa-spinner fa-spin" /> Đang tải &amp; kiểm tra…
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Khối lỗi từ server: hiển thị số dòng cụ thể */}
                {errors.length > 0 && (
                    <div className="box box-danger">
                        <div className="box-header with-border">
                            <h3 className="box-title">Lỗi kiểm tra dữ liệu</h3>
                        </div>
                        <div className="box-body table-responsive">
                            <table className="table table-bordered">
                                <thead>
                                    <tr>
                                        <th>Dòng</th>
                                        <th>Lỗi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedErrors.map((er, i) => (
                                        <tr key={i}>
                                            <td>{er.row}</td>
                                            <td>{er.message}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Phân trang lỗi */}
                            {totalErrPages > 1 && (
                                <nav style={{ marginTop: 8 }}>
                                    <ul className="pagination pagination-sm no-margin">
                                        <li className={errPage === 1 ? "disabled" : ""}>
                                            <a
                                                href="#!"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (errPage > 1) setErrPage(errPage - 1);
                                                }}
                                            >
                                                « Trước
                                            </a>
                                        </li>
                                        {Array.from({ length: totalErrPages }, (_, idx) => (
                                            <li
                                                key={idx}
                                                className={errPage === idx + 1 ? "active" : ""}
                                            >
                                                <a
                                                    href="#!"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setErrPage(idx + 1);
                                                    }}
                                                >
                                                    {idx + 1}
                                                </a>
                                            </li>
                                        ))}
                                        <li className={errPage === totalErrPages ? "disabled" : ""}>
                                            <a
                                                href="#!"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (errPage < totalErrPages) setErrPage(errPage + 1);
                                                }}
                                            >
                                                Sau »
                                            </a>
                                        </li>
                                    </ul>
                                </nav>
                            )}

                            {/* Đóng = rollback để dọn staging + reset input */}
                            <button className="btn btn-default" onClick={onRollback}>
                                Đóng
                            </button>
                        </div>
                    </div>
                )}

                {/* Xem trước: KHÔNG có cột "Số buổi còn lại" */}
                {rows.length > 0 && (
                    <div className="box box-success">
                        <div className="box-header with-border">
                            <h3 className="box-title">Xem trước dữ liệu sẽ nhập</h3>
                        </div>
                        <div className="box-body">
                            <div className="table-responsive">
                                <table
                                    ref={tableRef}
                                    className="table table-bordered table-hover"
                                    style={{ width: "100%" }}
                                >
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Tên học viên</th>
                                            <th>Tên phụ huynh</th>
                                            <th>Số điện thoại</th>
                                            <th>Địa chỉ</th>
                                            <th>Email</th>
                                            <th>Ngày nhập học</th>
                                            <th>Số buổi đã học</th>
                                            <th>Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={r.id}>
                                                <td>{r.id}</td>
                                                <td>{r.name}</td>
                                                <td>{r.parent}</td>
                                                <td>{r.phone}</td>
                                                <td>{r.address}</td>
                                                <td>{r.email}</td>
                                                <td>{r.startDate}</td>
                                                <td>{r.learned}</td>
                                                <td>
                                                    <span
                                                        className={
                                                            "label " +
                                                            (r.statusNum === 1 ? "label-success" : "label-default")
                                                        }
                                                    >
                                                        {r.statusNum === 1 ? "Đang học" : "Ngừng học"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ marginTop: 12 }}>
                                <button className="btn btn-success" onClick={onConfirm}>
                                    <i className="fa fa-check" /> Xác nhận lưu
                                </button>{" "}
                                <button className="btn btn-default" onClick={onRollback}>
                                    Hủy
                                </button>{" "}
                               
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Toast lỗi nổi */}
            {toast.msg && (
                <div
                    className="alert alert-danger"
                    style={{
                        position: "fixed",
                        top: 70,
                        right: 16,
                        zIndex: 9999,
                        maxWidth: 420,
                        boxShadow: "0 4px 12px rgba(0,0,0,.15)",
                    }}
                >
                    <button type="button" className="close" onClick={toast.hide}>
                        <span>&times;</span>
                    </button>
                    {toast.msg}
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                        Tự ẩn sau {(toast.left / 1000).toFixed(1)}s
                    </div>
                    <div style={{ height: 3, background: "rgba(0,0,0,.08)", marginTop: 6 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${(toast.left / AUTO) * 100}%`,
                                transition: "width 100ms linear",
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
