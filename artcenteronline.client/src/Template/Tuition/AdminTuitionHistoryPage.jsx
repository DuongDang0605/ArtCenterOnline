// src/Template/Tuition/AdminTuitionHistoryPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { adminListTuitionRequests } from "../../api/tuition";
import extractErr from "../../utils/extractErr";
import { useToasts } from "../../hooks/useToasts";
import { getStudents } from "../Student/students"; // dùng cho autocomplete tên HS

function fmt(dt) {
    if (!dt) return "";
    return new Date(dt).toLocaleString("vi-VN", { hour12: false });
}
function parseDMY(s) {
    // dd/MM/yyyy -> Date | null
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || "").trim());
    if (!m) return null;
    const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3]);
    const t = new Date(y, mo, d);
    return (t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d) ? t : null;
}
function sameOrAfter(a, b) { return a >= b; }
function sameOrBefore(a, b) { return a <= b; }

const STATUS_OPTIONS = [
    { value: "notpending", text: "Tất cả" },
    { value: "Approved", text: "Đã duyệt" },
    { value: "Rejected", text: "Từ chối" },
    { value: "Canceled", text: "Tự hủy" },
];

function badge(s) {
    if (s === "Approved") return <span className="label label-success">Đã duyệt</span>;
    if (s === "Rejected") return <span className="label label-danger">Từ chối</span>;
    if (s === "Canceled") return <span className="label label-default">Tự hủy</span>;
    if (s === "Pending") return <span className="label label-warning">Chờ duyệt</span>;
    return s;
}

export default function AdminTuitionHistoryPage() {
    const [rawRows, setRawRows] = useState([]);
    const [status, setStatus] = useState("notpending");
    const [loading, setLoading] = useState(true);

    // Toasts đồng bộ với AddClassPage
    const { showError, showSuccess, Toasts } = useToasts();
    const navigate = useNavigate();
    const location = useLocation();

    // Nhận notice (khi điều hướng về)
    useEffect(() => {
        const notice = location.state?.notice;
        if (notice) {
            showSuccess(notice);
            navigate(".", { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ==== Bộ lọc theo thời gian (text) ====
    const [fromText, setFromText] = useState("");
    const [toText, setToText] = useState("");
    const fromDate = useMemo(() => parseDMY(fromText), [fromText]);
    const toDate = useMemo(() => {
        const d = parseDMY(toText);
        if (!d) return null;
        // đến hết ngày
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    }, [toText]);

    // ==== Bộ lọc tên học sinh (autocomplete) ====
    const [students, setStudents] = useState([]);
    const [query, setQuery] = useState("");
    const [studentId, setStudentId] = useState("");
    const [openDrop, setOpenDrop] = useState(false);
    const [hoverIndex, setHoverIndex] = useState(-1);
    const autoRef = useRef(null);

    function getStudentId(st) { return st?.studentId ?? st?.StudentId ?? st?.id; }
    function getStudentName(st) {
        return st?.studentName ?? st?.StudentName ?? st?.fullName ?? st?.name ?? "(không tên)";
    }

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await getStudents();
                if (alive) setStudents(Array.isArray(data) ? data : []);
            } catch (e) {
                if (alive) showError(extractErr(e) || "Không tải được danh sách học viên.");
            }
        })();
        return () => { alive = false; };
    }, [showError]);

    useEffect(() => {
        const onDocClick = (e) => {
            if (!autoRef.current) return;
            if (!autoRef.current.contains(e.target)) {
                setOpenDrop(false); setHoverIndex(-1);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const arr = students.filter((st) => {
            const name = getStudentName(st).toLowerCase();
            const idStr = String(getStudentId(st) ?? "").toLowerCase();
            return name.includes(q) || idStr.includes(q);
        });
        return arr.slice(0, 12);
    }, [students, query]);

    function selectStudent(st) {
        const id = getStudentId(st);
        if (id == null) return;
        setStudentId(String(id));
        setQuery(getStudentName(st));
        setOpenDrop(false);
        setHoverIndex(-1);
    }

    // ==== Phân trang (client-side) ====
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Load dữ liệu theo trạng thái (server-side)
    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            try {
                const { data } = await adminListTuitionRequests(status);
                if (!alive) return;
                setRawRows(Array.isArray(data) ? data : []);
                setPage(1); // reset về trang 1 khi đổi bộ lọc server
            } catch (e) {
                if (alive) showError(extractErr(e) || "Có lỗi xảy ra.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [status, showError]);

    // Áp dụng các bộ lọc client-side
    const filteredRows = useMemo(() => {
        let arr = rawRows;

        // lọc theo tên học sinh
        if (studentId) {
            arr = arr.filter((r) => String(r.studentId ?? r.StudentId ?? r.sid ?? "") === String(studentId));
        } else if (query.trim()) {
            const q = query.trim().toLowerCase();
            arr = arr.filter((r) =>
                String(r.studentName ?? r.name ?? "").toLowerCase().includes(q)
            );
        }

        // lọc theo khoảng thời gian (createdAtUtc)
        if (fromDate) {
            arr = arr.filter((r) => {
                const d = new Date(r.createdAtUtc);
                return sameOrAfter(d, fromDate);
            });
        }
        if (toDate) {
            arr = arr.filter((r) => {
                const d = new Date(r.createdAtUtc);
                return sameOrBefore(d, toDate);
            });
        }

        return arr;
    }, [rawRows, studentId, query, fromDate, toDate]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const pageRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredRows.slice(start, start + pageSize);
    }, [filteredRows, page, pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    return (
        <>
            <section className="content-header">
                <h1>Quản lý nộp học phí — Lịch sử</h1>
            </section>

            <section className="content">
                <div className="box">
                    <div className="box-header with-border">
                        {/* CSS chỉ để trình bày label nằm TRÊN control */}
                        <style>{`
                            .filters-grid{
                                display:grid;
                                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                                gap:12px;
                                align-items:end;
                            }
                            .filters-grid .filter-col label{
                                display:block;
                                font-weight:600;
                                margin-bottom:4px;
                            }
                            .filters-grid .filter-col .form-control{
                                width:100%;
                            }
                            .filters-grid .filter-col .dropdown{ position:relative; }
                            .filters-grid .filter-col .dropdown .form-control{ width:100% !important; }
                            .filters-grid .filter-col .dropdown .dropdown-menu{
                                width:100%;
                            }
                        `}</style>

                        <div className="filters-grid">
                            {/* Trạng thái */}
                            <div className="filter-col">
                                <label>Trạng thái</label>
                                <select
                                    className="form-control"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                >
                                    {STATUS_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.text}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Từ ngày */}
                            <div className="filter-col">
                                <label>Từ ngày</label>
                                <input
                                    className="form-control"
                                    placeholder="dd/MM/yyyy"
                                    value={fromText}
                                    onChange={(e) => { setFromText(e.target.value); setPage(1); }}
                                />
                            </div>

                            {/* Đến ngày */}
                            <div className="filter-col">
                                <label>Đến ngày</label>
                                <input
                                    className="form-control"
                                    placeholder="dd/MM/yyyy"
                                    value={toText}
                                    onChange={(e) => { setToText(e.target.value); setPage(1); }}
                                />
                            </div>

                            {/* Autocomplete tên học viên */}
                            <div className="filter-col" ref={autoRef}>
                                <label>Học viên</label>
                                <div className="dropdown">
                                    <input
                                        className="form-control"
                                        placeholder="Nhập tên học viên…"
                                        value={query}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setQuery(v);
                                            setOpenDrop(true);
                                            setStudentId(""); // khi gõ lại text -> bỏ chọn id
                                            setPage(1);
                                        }}
                                        onFocus={() => { if (query.trim()) setOpenDrop(true); }}
                                        onKeyDown={(e) => {
                                            if (!openDrop || suggestions.length === 0) return;
                                            if (e.key === "ArrowDown") { e.preventDefault(); setHoverIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
                                            if (e.key === "ArrowUp") { e.preventDefault(); setHoverIndex((i) => Math.max(i - 1, 0)); }
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                const pick = suggestions[hoverIndex] || suggestions[0];
                                                if (pick) selectStudent(pick);
                                            }
                                            if (e.key === "Escape") setOpenDrop(false);
                                        }}
                                    />
                                    {/* nút clear nhanh */}
                                    {query && (
                                        <button
                                            type="button"
                                            className="btn btn-link"
                                            onClick={() => { setQuery(""); setStudentId(""); setOpenDrop(false); setPage(1); }}
                                            style={{ position: "absolute", right: 0, top: 0 }}
                                            title="Xóa tìm kiếm"
                                        >
                                            ×
                                        </button>
                                    )}
                                    {openDrop && suggestions.length > 0 && (
                                        <ul
                                            className="dropdown-menu"
                                            style={{
                                                display: "block", maxHeight: 260, overflowY: "auto", left: 0, top: "100%"
                                            }}
                                        >
                                            {suggestions.map((st, idx) => {
                                                const id = getStudentId(st);
                                                return (
                                                    <li
                                                        key={id}
                                                        className={idx === hoverIndex ? "active" : ""}
                                                        onMouseEnter={() => setHoverIndex(idx)}
                                                    >
                                                        <a href="#!" onClick={(e) => { e.preventDefault(); selectStudent(st); }}>
                                                            <strong>{getStudentName(st)}</strong>
                                                            <span className="text-muted"> &nbsp;•&nbsp; ID: {id}</span>
                                                        </a>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* Page size */}
                            <div className="filter-col">
                                <label>Hiển thị</label>
                                <select
                                    className="form-control"
                                    value={pageSize}
                                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                                >
                                    {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}/trang</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="box-body table-responsive">
                        {loading ? (
                            <div className="p-3">Đang tải…</div>
                        ) : pageRows.length === 0 ? (
                            <div className="p-3">Không có bản ghi.</div>
                        ) : (
                            <>
                                <table className="table table-bordered table-hover">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Học viên</th>
                                            <th>Email</th>
                                            <th>Ngày gửi</th>
                                            <th>Trạng thái</th>
                                                    <th>Ngày xử lý</th>
                                            <th>Lý do từ chối</th>
                                            <th>Chi tiết</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map((r, i) => (
                                            <tr key={r.id}>
                                                <td>{(page - 1) * pageSize + i + 1}</td>
                                                <td>{r.studentName}</td>
                                                <td>{r.email}</td>
                                                <td>{fmt(r.createdAtUtc)}</td>
                                                <td>{badge(r.status)}</td>
                                                <td>{fmt(r.reviewedAtUtc)}</td>
                                                <td>{r.rejectReason || ""}</td>
                                                <td>
                                                    <Link className="btn btn-xs btn-default" to={`/admin/tuition/requests/${r.id}`}>
                                                        Xem
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Pagination */}
                                <nav aria-label="Pager" style={{ marginTop: 8 }}>
                                    <ul className="pagination pagination-sm no-margin pull-right">
                                        <li className={page === 1 ? "disabled" : ""}>
                                            <a href="#!" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}>
                                                « Trước
                                            </a>
                                        </li>
                                        {Array.from({ length: totalPages }, (_, idx) => (
                                            <li key={idx} className={page === idx + 1 ? "active" : ""}>
                                                <a href="#!" onClick={(e) => { e.preventDefault(); setPage(idx + 1); }}>
                                                    {idx + 1}
                                                </a>
                                            </li>
                                        ))}
                                        <li className={page === totalPages ? "disabled" : ""}>
                                            <a href="#!" onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}>
                                                Sau »
                                            </a>
                                        </li>
                                    </ul>
                                </nav>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* Toasts dùng chung (success + error) */}
            <Toasts />
        </>
    );
}
