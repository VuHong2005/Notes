import { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate } from "react-router-dom";
import MoveFolderModal from "./MoveFolderModal";
import "./notes.css";

function toLocal(dateStr) {
    if (!dateStr) return null;
    const s = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : dateStr + "Z";
    return new Date(s);
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = toLocal(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const noteDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today - noteDay) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Hôm qua";
    if (diffDays < 7) return d.toLocaleDateString("vi-VN", { weekday: "long" });
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function stripMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/^\|.*\|$/gm, "[Bảng]")
        .replace(/\|[-:| ]+\|/g, "")
        .replace(/#{1,6}\s*/g, "")
        .replace(/\*{1,2}(.+?)\*{1,2}/g, "$1")
        .replace(/`{1,3}(.+?)`{1,3}/g, "$1")
        .replace(/\[(.+?)\]\(.+?\)/g, "$1")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/\n+/g, " ")
        .trim();
}

function groupNotes(notes, field = "created_at") {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const groups = [], groupMap = {};
    const getLabel = (dateStr) => {
        if (!dateStr) return "Khác";
        const d = toLocal(dateStr);
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.floor((today - day) / 86400000);
        if (diff === 0) return "Hôm nay";
        if (diff === 1) return "Hôm qua";
        if (diff < 7) return "7 ngày trước";
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "Tháng này";
        if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("vi-VN", { month: "long" });
        return String(d.getFullYear());
    };
    const ORDER = ["Hôm nay", "Hôm qua", "7 ngày trước", "Tháng này"];
    
    // Đảm bảo field hợp lệ cho ngày
    const groupField = (field === "title") ? "created_at" : field;

    for (const note of notes) {
        const label = getLabel(note[groupField]);
        if (!groupMap[label]) { 
            groupMap[label] = { label, items: [] }; 
            groups.push(groupMap[label]); 
        }
        groupMap[label].items.push(note);
    }
    
    groups.sort((a, b) => {
        const ai = ORDER.indexOf(a.label), bi = ORDER.indexOf(b.label);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        // Sắp xếp các tháng/năm ngược lại (mới hơn lên trên)
        return b.label.localeCompare(a.label);
    });
    return groups;
}

function NotesList() {
    const [notes, setNotes] = useState([]);
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    // Menu 3 chấm topbar
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);
    useEffect(() => {
        if (!showMenu) return;
        const handler = (e) => { 
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
                setShowSortMenu(false);
                setShowGroupMenu(false);
            } 
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [showMenu]);

    // Menu 3 chấm của từng note
    const [openNoteMenuId, setOpenNoteMenuId] = useState(null);
    const [noteMenuPos, setNoteMenuPos] = useState({ top: 0, right: 0 });
    const noteMenuRef = useRef(null);
    useEffect(() => {
        if (!openNoteMenuId) return;
        const handler = (e) => { if (noteMenuRef.current && !noteMenuRef.current.contains(e.target)) setOpenNoteMenuId(null); };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [openNoteMenuId]);

    const openNoteMenu = (note, e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setNoteMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        setOpenNoteMenuId(openNoteMenuId === note.id ? null : note.id);
    };

    const togglePin = async (note) => {
        setOpenNoteMenuId(null);
        const next = !note.pinned;
        await supabase.from("notes").update({ pinned: next }).eq("id", note.id);
        setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: next } : n));
    };

    // Di chuyển note sang folder khác
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveNote, setMoveNote] = useState(null);

    const openMoveModal = (note) => {
        setOpenNoteMenuId(null);
        setMoveNote(note);
        setShowMoveModal(true);
    };

    const moveToFolder = async (folderId) => {
        await supabase.from("notes").update({ folder_id: folderId }).eq("id", moveNote.id);
        setNotes(prev => prev.filter(n => n.id !== moveNote.id));
        setShowMoveModal(false);
        setMoveNote(null);
    };

    const deleteNote = async (note) => {
        setOpenNoteMenuId(null);
        await supabase.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", note.id);
        setNotes(prev => prev.filter(n => n.id !== note.id));
    };

    // Chế độ xem
    const [viewMode, setViewMode] = useState(() => localStorage.getItem("notes_view_mode") || "list");
    const toggleViewMode = () => {
        const next = viewMode === "list" ? "gallery" : "list";
        setViewMode(next);
        localStorage.setItem("notes_view_mode", next);
        setShowMenu(false);
    };

    // Sắp xếp
    const [sortField, setSortField] = useState(() => localStorage.getItem("notes_sort_field") || "default");
    const [sortDir, setSortDir]     = useState(() => localStorage.getItem("notes_sort_dir")   || "desc");
    const [showSortMenu, setShowSortMenu] = useState(false);
    const SORT_FIELDS = [
        { key: "default",    label: "Mặc định (Ngày sửa)" },
        { key: "updated_at", label: "Ngày sửa" },
        { key: "created_at", label: "Ngày tạo" },
        { key: "title",      label: "Tiêu đề" },
    ];
    const setSortFieldAndSave = (key) => { setSortField(key); localStorage.setItem("notes_sort_field", key); };
    const setSortDirAndSave   = (dir) => { setSortDir(dir);   localStorage.setItem("notes_sort_dir",   dir); };
    const sortLabel = SORT_FIELDS.find(f => f.key === sortField)?.label || "Mặc định (Ngày sửa)";

    // Nhóm theo ngày
    const [groupByDate, setGroupByDate] = useState(() => localStorage.getItem("notes_group_by_date") || "default");
    const [showGroupMenu, setShowGroupMenu] = useState(false);
    const GROUP_OPTIONS = [
        { key: "default", label: "Mặc định (Bật)" },
        { key: "on",      label: "Bật" },
        { key: "off",     label: "Tắt" },
    ];
    const setGroupByDateAndSave = (key) => { setGroupByDate(key); localStorage.setItem("notes_group_by_date", key); };
    const isGrouped = groupByDate !== "off";

    // Chế độ chọn nhiều
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const toggleSelect = (id) => {
        setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    };
    const enterSelectMode = () => { setSelectMode(true); setSelectedIds(new Set()); setShowMenu(false); };
    const exitSelectMode  = () => { setSelectMode(false); setSelectedIds(new Set()); };
    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        await supabase.from("notes").update({ deleted_at: new Date().toISOString() }).in("id", [...selectedIds]);
        setNotes(prev => prev.filter(n => !selectedIds.has(n.id)));
        exitSelectMode();
    };

    useEffect(() => {
        const saved = localStorage.getItem("theme");
        const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", dark);
    }, []);

    useEffect(() => {
        supabase.from("notes").select("*").is("deleted_at", null).is("folder_id", null)
            .order("created_at", { ascending: false })
            .then(({ data }) => setNotes(data || []));
    }, []);

    const filteredNotes = notes
        .filter(n =>
            n.title?.toLowerCase().includes(search.toLowerCase()) ||
            n.content?.toLowerCase().includes(search.toLowerCase())
        )
        .slice()
        .sort((a, b) => {
            const field = sortField === "default" ? "updated_at" : sortField;
            let va = a[field] || a.created_at || "", vb = b[field] || b.created_at || "";
            if (field === "title") { 
                va = (a.title || "").toLowerCase(); 
                vb = (b.title || "").toLowerCase(); 
                return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va); 
            }
            const da = new Date(va).getTime() || 0, db = new Date(vb).getTime() || 0;
            return sortDir === "asc" ? da - db : db - da;
        });

    const pinnedNotes   = filteredNotes.filter(n => n.pinned);
    const unpinnedNotes = filteredNotes.filter(n => !n.pinned);

    // Render 1 note item (list mode)
    const renderListItem = (note) => {
        const checked = selectedIds.has(note.id);
        const displayDate = sortField === "title" ? note.created_at : (sortField === "default" ? note.updated_at : note[sortField]);

        if (selectMode) {
            return (
                <div key={note.id} className={`notes-list-item${checked ? " selected" : ""}`} onClick={() => toggleSelect(note.id)}>
                    <div className={`select-circle${checked ? " checked" : ""}`}>
                        {checked && <svg viewBox="0 0 14 14" fill="none" width="14" height="14"><path d="M2.5 7l3.5 3.5 5.5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <div className="notes-item-body">
                        <div className="notes-item-title-row">
                            <span className="notes-item-title">{note.title || "Ghi chú mới"}</span>
                            <span className="notes-item-date">{formatDate(displayDate)}</span>
                        </div>
                        <div className="notes-item-preview">{stripMarkdown(note.content) || "Không có nội dung"}</div>
                    </div>
                </div>
            );
        }
        return (
            <div key={note.id} className="notes-list-item" style={{ cursor: "pointer" }} onClick={() => navigate(`/note/${note.id}`)}>
                <div className="notes-item-body">
                    <div className="notes-item-title-row">
                        <span className="notes-item-title">{note.title || "Ghi chú mới"}</span>
                        <span className="notes-item-date">{formatDate(displayDate)}</span>
                    </div>
                    <div className="notes-item-preview">{stripMarkdown(note.content) || "Không có nội dung"}</div>
                </div>
                <button className="note-dots-btn" onClick={e => openNoteMenu(note, e)}>⋮</button>
                <span className="notes-item-chevron">›</span>
            </div>
        );
    };

    // Render 1 note item (gallery mode)
    const renderGalleryItem = (note) => {
        const checked = selectedIds.has(note.id);
        return (
            <div key={note.id} className={`notes-gallery-card${checked ? " selected" : ""}`}
                onClick={() => selectMode ? toggleSelect(note.id) : navigate(`/note/${note.id}`)}>
                {selectMode && (
                    <div className={`select-circle gallery${checked ? " checked" : ""}`}>
                        {checked && <svg viewBox="0 0 14 14" fill="none" width="12" height="12"><path d="M2.5 7l3.5 3.5 5.5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                )}
                {!selectMode && (
                    <button className="note-dots-btn note-dots-gallery" onClick={e => openNoteMenu(note, e)}>⋮</button>
                )}
                <div className="notes-gallery-preview">{stripMarkdown(note.content) || ""}</div>
                <div className="notes-gallery-footer">
                    <div className="notes-gallery-title">{note.title || "Ghi chú mới"}</div>
                    <div className="notes-gallery-date">{formatDate(sortField === "title" ? note.created_at : (sortField === "default" ? note.updated_at : note[sortField]))}</div>
                </div>
            </div>
        );
    };

    const renderGroup = (items) => viewMode === "gallery"
        ? <div className="notes-gallery-grid">{items.map(renderGalleryItem)}</div>
        : <div className="notes-list-card">{items.map(renderListItem)}</div>;

    return (
        <div className="notes-app">

            {/* ---- Topbar ---- */}
            <div className="notes-topbar">
                <button className="notes-back-btn" onClick={() => navigate("/")}>
                    <svg viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 1L2 8l6 7"/>
                    </svg>
                    Thư mục
                </button>

                <div className="topbar-menu-wrap" ref={menuRef}>
                    <button className="topbar-menu-btn" onClick={() => setShowMenu(v => !v)}>
                        <svg viewBox="0 0 18 6" fill="currentColor" width="18" height="6">
                            <circle cx="3" cy="3" r="1.5" />
                            <circle cx="9" cy="3" r="1.5" />
                            <circle cx="15" cy="3" r="1.5" />
                        </svg>
                    </button>

                    {showMenu && (
                        <div className="topbar-menu-dropdown">
                            <button className="topbar-menu-item" onClick={toggleViewMode}>
                                <span>{viewMode === "list" ? "Xem dưới dạng bộ sưu tập" : "Xem dưới dạng danh sách"}</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
                                    {viewMode === "list" ? (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>) : (<path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />)}
                                </svg>
                            </button>
                            <div className="topbar-menu-divider" />
                            <button className="topbar-menu-item" onClick={enterSelectMode}>
                                <span>Chọn ghi chú</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <div className="topbar-menu-divider" />
                            <div className="topbar-menu-item" onClick={() => setShowSortMenu(v => !v)}>
                                <div className="topbar-menu-item-sub">
                                    <span>Sắp xếp theo</span>
                                    <span className="topbar-menu-sub-label">{sortLabel}</span>
                                </div>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M3 6h18M7 12h10M11 18h2" strokeLinecap="round" />
                                </svg>
                            </div>
                            {showSortMenu && (
                                <div className="sort-submenu" onClick={e => e.stopPropagation()}>
                                    {SORT_FIELDS.map(f => (
                                        <button key={f.key} className="sort-submenu-item" onClick={() => setSortFieldAndSave(f.key)}>
                                            <span className="sort-check">{sortField === f.key ? "✓" : ""}</span>
                                            <span>{f.label}</span>
                                        </button>
                                    ))}
                                    <div className="topbar-menu-divider" style={{ margin: "4px 0" }} />
                                    {[{ key: "desc", label: "Mới nhất trước" }, { key: "asc", label: "Cũ nhất trước" }].map(d => (
                                        <button key={d.key} className="sort-submenu-item" onClick={() => setSortDirAndSave(d.key)}>
                                            <span className="sort-check">{sortDir === d.key ? "✓" : ""}</span>
                                            <span>{d.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="topbar-menu-divider" />
                            <div className="topbar-menu-item" onClick={() => setShowGroupMenu(v => !v)}>
                                <div className="topbar-menu-item-sub">
                                    <span>Nhóm theo ngày</span>
                                    <span className="topbar-menu-sub-label">{GROUP_OPTIONS.find(o => o.key === groupByDate)?.label}</span>
                                </div>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                                </svg>
                            </div>
                            {showGroupMenu && (
                                <div className="sort-submenu" onClick={e => e.stopPropagation()}>
                                    {GROUP_OPTIONS.map(o => (
                                        <button key={o.key} className="sort-submenu-item" onClick={() => setGroupByDateAndSave(o.key)}>
                                            <span className="sort-check">{groupByDate === o.key ? "✓" : ""}</span>
                                            <span>{o.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ---- Header ---- */}
            <div className="notes-list-header">
                <h1>Ghi chú</h1>
                {selectMode && <button className="select-cancel-btn" onClick={exitSelectMode}>Hủy</button>}
            </div>

            {/* ---- Tìm kiếm ---- */}
            <div className="notes-search-wrap">
                <input className="notes-search" placeholder="Tìm kiếm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* ---- Danh sách notes ---- */}
            {filteredNotes.length === 0 ? (
                <div className="notes-empty">Không tìm thấy ghi chú</div>
            ) : (
                <>
                    {/* Ghim */}
                    {pinnedNotes.length > 0 && (
                        <>
                            <div className="notes-section-label">Đã ghim</div>
                            {renderGroup(pinnedNotes)}
                        </>
                    )}

                    {/* Còn lại */}
                    {unpinnedNotes.length > 0 && (
                        (isGrouped ? groupNotes(unpinnedNotes, sortField === "default" ? "updated_at" : sortField) : [{ label: null, items: unpinnedNotes }])
                        .map(({ label, items }) => (
                            <div key={label ?? "__all__"}>
                                {label && <div className="notes-section-label">{label}</div>}
                                {renderGroup(items)}
                            </div>
                        ))
                    )}
                </>
            )}

            <div style={{ height: 80 }} />

            {/* ---- Bottom Bar ---- */}
            <div className="notes-bottombar">
                {selectMode ? (
                    <>
                        <span className="notes-count">{selectedIds.size > 0 ? `${selectedIds.size} đã chọn` : "Chưa chọn"}</span>
                        <button className={`select-delete-btn${selectedIds.size === 0 ? " disabled" : ""}`} onClick={deleteSelected} disabled={selectedIds.size === 0}>Xóa</button>
                    </>
                ) : (
                    <>
                        <div style={{ width: 40 }} />
                        <span className="notes-count">{filteredNotes.length} ghi chú</span>
                        <button className="notes-compose-btn" onClick={() => navigate("/add")}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {/* ---- Dropdown menu của note ---- */}
            {openNoteMenuId && (
                <div ref={noteMenuRef} className="folder-dropdown" style={{ position: "fixed", top: noteMenuPos.top, right: noteMenuPos.right }}>
                    <button className="folder-dropdown-item" onClick={() => togglePin(notes.find(n => n.id === openNoteMenuId))}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                        </svg>
                        {notes.find(n => n.id === openNoteMenuId)?.pinned ? "Bỏ ghim" : "Ghim"}
                    </button>
                    <div className="folder-dropdown-divider" />
                    <button className="folder-dropdown-item" onClick={() => openMoveModal(notes.find(n => n.id === openNoteMenuId))}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                            <path d="M12 11v6M9 14l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Di chuyển mục
                    </button>
                    <div className="folder-dropdown-divider" />
                    <button className="folder-dropdown-item danger" onClick={() => deleteNote(notes.find(n => n.id === openNoteMenuId))}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" strokeLinecap="round" /><path d="M9 6V4h6v2" />
                        </svg>
                        Xóa ghi chú
                    </button>
                </div>
            )}

            {/* ---- Modal di chuyển folder ---- */}
            {showMoveModal && (
                <MoveFolderModal
                    note={moveNote}
                    currentFolderId={null}
                    onMove={moveToFolder}
                    onClose={() => { setShowMoveModal(false); setMoveNote(null); }}
                />
            )}

        </div>
    );
}

export default NotesList;
