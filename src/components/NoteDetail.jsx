import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../services/supabaseClient";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MoveFolderModal from "./MoveFolderModal";
import "./notes.css";

function toLocal(dateStr) {
    if (!dateStr) return null;
    const s = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : dateStr + "Z";
    return new Date(s);
}

function formatSmartDate(dateStr) {
    if (!dateStr) return "";
    const d = toLocal(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const noteDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today - noteDay) / 86400000);
    const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 0) return `Hôm nay lúc ${time}`;
    if (diffDays === 1) return `Hôm qua lúc ${time}`;
    if (diffDays < 7) return `${d.toLocaleDateString("vi-VN", { weekday: "long" })} lúc ${time}`;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Chuyển chuỗi markdown thành mảng blocks (text + table xen kẽ)
function parseMarkdownToBlocks(markdown) {
    if (!markdown?.trim()) return [{ type: "text", id: Date.now(), content: "" }];

    const lines = markdown.split("\n");
    const result = [];
    let textLines = [];
    let i = 0;

    // Dòng separator của bảng: | --- | --- | (phải có ít nhất 1 dấu gạch ngang)
    const isSeparator = (l) => l.includes("-") && /^\|[\s\-:|]+\|/.test(l.trim());
    const isTableRow  = (l) => l.trim().startsWith("|");

    const flushText = () => {
        // Strip trailing spaces ("  ") từ soft-break markdown trước khi đưa vào textarea
        const content = textLines.join("\n").replace(/ {2}$/gm, "").trim();
        if (content) result.push({ type: "text", id: Date.now() + result.length, content });
        textLines = [];
    };

    while (i < lines.length) {
        const line     = lines[i];
        const nextLine = lines[i + 1] ?? "";

        // Bắt đầu bảng: dòng hiện tại có | và dòng kế là separator
        if (isTableRow(line) && isSeparator(nextLine)) {
            flushText();

            // Thu thập tất cả dòng của bảng
            const tableLines = [];
            while (i < lines.length && isTableRow(lines[i])) {
                tableLines.push(lines[i]);
                i++;
            }

            // Bỏ dòng separator, chuyển mỗi dòng còn lại thành mảng ô
            const rows = tableLines
                .filter(l => !isSeparator(l))
                .map(l => l.trim()
                    .replace(/^\||\|$/g, "")   // bỏ | đầu/cuối
                    .split("|")
                    .map(cell => cell.trim())
                );

            if (rows.length > 0) {
                result.push({ type: "table", id: Date.now() + result.length * 100, rows });
            }
        } else {
            textLines.push(line);
            i++;
        }
    }

    flushText();

    if (result.length === 0) return [{ type: "text", id: Date.now(), content: "" }];

    // Luôn đảm bảo block cuối là text để người dùng có thể gõ bên dưới bảng
    if (result[result.length - 1].type !== "text") {
        result.push({ type: "text", id: Date.now() + result.length * 999, content: "" });
    }

    return result;
}

function NoteDetail() {

    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [title, setTitle] = useState("");
    const [createdAt, setCreatedAt] = useState(null);
    const [folderId, setFolderId] = useState(location.state?.folderId || null);
    const [folderName, setFolderName] = useState(location.state?.folderName || "");
    const [pinned, setPinned] = useState(false);

    // Theme sáng/tối
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("theme", next ? "dark" : "light");
        setShowNoteMenu(false);
    };

    // Menu 3 chấm topbar
    const [showNoteMenu, setShowNoteMenu] = useState(false);
    const noteMenuRef = useRef(null);
    useEffect(() => {
        if (!showNoteMenu) return;
        const handler = (e) => { if (noteMenuRef.current && !noteMenuRef.current.contains(e.target)) setShowNoteMenu(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showNoteMenu]);

    // Di chuyển note
    const [showMoveModal, setShowMoveModal] = useState(false);

    // Tìm trong ghi chú
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchIdx, setSearchIdx] = useState(0);
    const searchInputRef = useRef(null);
    useEffect(() => {
        if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
    }, [showSearch]);

    // Mặc định view mode để thấy bảng render đẹp, bấm "Sửa" để chỉnh
    const [editing, setEditing] = useState(false);

    // blocks: mảng các phần tử theo thứ tự hiển thị thực tế
    // { type: 'text', id, content } hoặc { type: 'table', id, rows }
    const [blocks, setBlocks] = useState([]);

    // Markdown gốc để render ở view mode (không đổi khi đang edit)
    const [savedMarkdown, setSavedMarkdown] = useState("");

    const matchCount = searchQuery.trim()
        ? (savedMarkdown.replace(/#{1,6}\s*/g, "").replace(/\*{1,2}(.+?)\*{1,2}/g, "$1")
            .match(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length
        : 0;

    const findInNote = (backward = false) => {
        if (!searchQuery.trim()) return;
        window.find(searchQuery, false, backward, true);
        setSearchIdx(i => (backward ? Math.max(0, i - 1) : Math.min(matchCount - 1, i + 1)));
    };

    // Vào edit mode: parse markdown → visual blocks (hoặc khôi phục từ localStorage)
    const enterEditMode = () => {
        const saved = localStorage.getItem(`note_blocks_${id}`);
        if (saved) {
            // Khôi phục blocks chưa lưu (F5 giữa chừng)
            const parsed = JSON.parse(saved);
            const merged = [];
            for (const block of parsed) {
                const last = merged[merged.length - 1];
                if (block.type === "text" && last?.type === "text") {
                    last.content = [last.content, block.content].filter(Boolean).join("\n");
                } else {
                    merged.push({ ...block });
                }
            }
            // Nếu merged rỗng, parse lại từ savedMarkdown thay vì tạo block mới
            setBlocks(merged.length ? merged : parseMarkdownToBlocks(savedMarkdown));
        } else {
            // Parse markdown thành blocks để hiển thị bảng trực quan
            setBlocks(parseMarkdownToBlocks(savedMarkdown));
        }
        setEditing(true);
    };

    // ID của text block đang focus
    const [focusedBlockId, setFocusedBlockId] = useState(null);

    // Ref map để focus textarea theo block id
    const textAreaRefs = useRef({});

    // Auto-resize tất cả textarea chỉ khi bật edit mode lần đầu
    useEffect(() => {
        if (!editing) return;
        setTimeout(() => {
            Object.values(textAreaRefs.current).forEach(el => {
                if (!el) return;
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
            });
        }, 0);
    }, [editing]);

    // Ref để luôn đọc được blocks mới nhất trong event handler
    const blocksRef = useRef(blocks);
    useEffect(() => { blocksRef.current = blocks; }, [blocks]);

    const [showTablePicker, setShowTablePicker] = useState(false);
    const [hoverCell, setHoverCell] = useState({ row: 0, col: 0 });

    useEffect(() => {
        supabase
            .from("notes")
            .select("*")
            .eq("id", id)
            .single()
            .then(({ data }) => {
                setTitle(data.title);
                setCreatedAt(data.created_at);
                setSavedMarkdown(data.content || "");
                setPinned(data.pinned || false);
                if (data.folder_id) {
                    setFolderId(data.folder_id);
                    supabase.from("folders").select("name").eq("id", data.folder_id).single()
                        .then(({ data: f }) => { if (f) setFolderName(f.name); });
                }
            });
    }, [id]);

    const togglePin = async () => {
        const next = !pinned;
        setPinned(next);
        setShowNoteMenu(false);
        await supabase.from("notes").update({ pinned: next }).eq("id", id);
    };

    // Lưu blocks vào localStorage khi đang edit để không mất khi F5
    useEffect(() => {
        if (editing && blocks.length > 0) {
            localStorage.setItem(`note_blocks_${id}`, JSON.stringify(blocks));
        }
    }, [blocks, id, editing]);

    // Focus text block ngay sau bảng (dùng khi Enter ở ô cuối)
    const focusBlockAfterTable = (tableId) => {
        const cur = blocksRef.current;
        const tIdx = cur.findIndex(b => b.id === tableId);
        for (let i = tIdx + 1; i < cur.length; i++) {
            if (cur[i].type === "text") {
                setTimeout(() => {
                    const el = textAreaRefs.current[cur[i].id];
                    if (el) { el.focus(); el.selectionStart = 0; el.selectionEnd = 0; }
                }, 0);
                break;
            }
        }
    };

    // Chèn bảng ngay sau text block đang focus
    // Nếu block trước rỗng → thay thế luôn (không để text rỗng phía trên bảng)
    const insertTable = (numRows, numCols) => {
        const emptyRow = () => Array(numCols).fill("");
        const newTable     = { type: "table", id: Date.now(),     rows: [emptyRow(), ...Array.from({ length: numRows - 1 }, emptyRow)] };
        const newTextBlock = { type: "text",  id: Date.now() + 1, content: "" };

        setBlocks(prev => {
            let idx = prev.findIndex(b => b.id === focusedBlockId);

            // Chưa focus block nào → dùng block cuối cùng làm mặc định
            if (idx === -1) idx = prev.length - 1;

            const focused = prev[idx];

            // Block đang focus rỗng → thay thế bằng bảng
            if (focused?.type === "text" && !focused.content.trim()) {
                return [...prev.slice(0, idx), newTable, newTextBlock, ...prev.slice(idx + 1)];
            }
            return [...prev.slice(0, idx + 1), newTable, newTextBlock, ...prev.slice(idx + 1)];
        });
        setShowTablePicker(false);
    };

    // Cập nhật nội dung một text block
    const updateTextBlock = (blockId, content) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content } : b));
    };

    // Cập nhật một ô trong table block
    const updateCell = (tableId, rowIdx, colIdx, val) => {
        setBlocks(prev => prev.map(b =>
            b.id !== tableId ? b : {
                ...b,
                rows: b.rows.map((row, ri) =>
                    ri !== rowIdx ? row : row.map((cell, ci) => ci === colIdx ? val : cell)
                )
            }
        ));
    };

    // Xóa table block rồi gộp các text block liền kề thành 1
    const deleteTable = (tableId) => {
        setBlocks(prev => {
            const withoutTable = prev.filter(b => b.id !== tableId);

            // Gộp text block liền kề
            const merged = [];
            for (const block of withoutTable) {
                const last = merged[merged.length - 1];
                if (block.type === "text" && last?.type === "text") {
                    last.content = [last.content, block.content].filter(Boolean).join("\n");
                } else {
                    merged.push({ ...block });
                }
            }

            return merged.length === 0
                ? [{ type: "text", id: Date.now(), content: "" }]
                : merged;
        });
    };

    // Xử lý phím trong ô bảng
    const handleCellKeyDown = (e, tableId, ri, ci, rows) => {
        const isFirstCell = ri === 0 && ci === 0;
        const isLastCell  = ri === rows.length - 1 && ci === rows[0].length - 1;
        const cell = rows[ri][ci];

        // Backspace ở ô đầu tiên khi rỗng → xóa bảng
        if (e.key === "Backspace" && isFirstCell && cell === "") {
            e.preventDefault();
            deleteTable(tableId);
        }
        // Enter ở ô cuối cùng → nhảy xuống text block bên dưới
        if (e.key === "Enter" && isLastCell) {
            e.preventDefault();
            focusBlockAfterTable(tableId);
        }
    };

    // Chuyển tất cả blocks thành markdown theo đúng thứ tự để lưu
    const blocksToMarkdown = () => {
        return blocks.map(b => {
            if (b.type === "text") {
                // Đổi \n → "  \n" để ReactMarkdown giữ nguyên xuống dòng (<br>)
                return b.content.trim().replace(/\n/g, "  \n");
            }
            const [header, ...rest] = b.rows;
            return [
                "| " + header.join(" | ") + " |",
                "| " + header.map(() => "---").join(" | ") + " |",
                ...rest.map(row => "| " + row.join(" | ") + " |")
            ].join("\n");
        }).filter(Boolean).join("\n\n");
    };

    const saveNote = async () => {
        const fullContent = blocksToMarkdown();

        await supabase
            .from("notes")
            .update({ title, content: fullContent })
            .eq("id", id);

        setSavedMarkdown(fullContent);
        // Reset về 1 text block chứa toàn bộ nội dung vừa lưu
        setBlocks([{ type: "text", id: Date.now(), content: fullContent }]);
        localStorage.removeItem(`note_blocks_${id}`);
        setEditing(false);
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const deleteNote = async () => {
        // Soft-delete: đánh dấu deleted_at thay vì xóa hẳn
        await supabase
            .from("notes")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);
        localStorage.removeItem(`note_blocks_${id}`);
        navigate(folderId ? `/folder/${folderId}` : "/notes");
    };

    const backLabel = location.state?.backLabel ?? (folderId ? (folderName || "Thư mục") : "Ghi chú");
    const backPath  = location.state?.backTo   ?? (folderId ? `/folder/${folderId}` : "/notes");

    return (

        <div className="notes-editor">

            <div className="notes-editor-topbar">
                <button className="notes-back-btn" onClick={() => navigate(backPath)}>
                    <svg viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 1L2 8l6 7" />
                    </svg>
                    {backLabel}
                </button>
                <div className="notes-topbar-actions">
                    {editing && (
                        <button className="notes-action-btn" onClick={saveNote}>Xong</button>
                    )}
                    <div className="topbar-menu-wrap" ref={noteMenuRef}>
                        <button className="topbar-menu-btn" onClick={() => setShowNoteMenu(v => !v)}>
                            <svg viewBox="0 0 18 6" fill="currentColor" width="18" height="6">
                                <circle cx="3" cy="3" r="1.5" />
                                <circle cx="9" cy="3" r="1.5" />
                                <circle cx="15" cy="3" r="1.5" />
                            </svg>
                        </button>
                        {showNoteMenu && (
                            <div className="topbar-menu-dropdown" style={{ right: 0, left: "auto", minWidth: 220 }}>
                                <button className="topbar-menu-item" onClick={togglePin}>
                                    <span>{pinned ? "Bỏ ghim" : "Ghim"}</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                                    </svg>
                                </button>
                                <div className="topbar-menu-divider" />
                                <button className="topbar-menu-item" onClick={() => { setShowNoteMenu(false); setShowSearch(true); setSearchQuery(""); setSearchIdx(0); }}>
                                    <span>Tìm trong ghi chú</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                                    </svg>
                                </button>
                                <div className="topbar-menu-divider" />
                                <button className="topbar-menu-item" onClick={() => { setShowNoteMenu(false); setShowMoveModal(true); }}>
                                    <span>Di chuyển ghi chú</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                                    </svg>
                                </button>
                                <div className="topbar-menu-divider" />
                                <button className="topbar-menu-item" onClick={toggleTheme}>
                                    <span>{isDark ? "Sử dụng nền sáng màu" : "Sử dụng nền tối màu"}</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                        <circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/>
                                    </svg>
                                </button>
                                <div className="topbar-menu-divider" />
                                <button className="topbar-menu-item" style={{ color: "#ff3b30" }} onClick={() => { setShowNoteMenu(false); setShowDeleteConfirm(true); }}>
                                    <span>Xóa</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" strokeLinecap="round" /><path d="M9 6V4h6v2" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showSearch && (
                <div className="note-search-bar">
                    <button className="note-search-close" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>
                        <svg viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="16">
                            <path d="M8 1L2 8l6 7"/>
                        </svg>
                    </button>
                    <input
                        ref={searchInputRef}
                        className="note-search-input"
                        placeholder="Tìm trong ghi chú"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSearchIdx(0); }}
                        onKeyDown={e => e.key === "Enter" && findInNote(e.shiftKey)}
                    />
                    {searchQuery.trim() && (
                        <span className="note-search-count">{matchCount > 0 ? `${searchIdx + 1}/${matchCount}` : "0 kết quả"}</span>
                    )}
                    <button className="note-search-nav" onClick={() => findInNote(true)} disabled={!matchCount}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="note-search-nav" onClick={() => findInNote(false)} disabled={!matchCount}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                </div>
            )}

            <div className="notes-editor-body">

                <div className="notes-editor-date">{formatSmartDate(createdAt)}</div>

                {/* Title */}
                {editing ? (
                    <input
                        className="notes-editor-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                ) : (
                    <h2 className="notes-view-title" onClick={() => enterEditMode()}>
                        {title}
                    </h2>
                )}

                {/* Toolbar — luôn render để không gây layout shift khi bật edit */}
                <div className="editor-toolbar" style={{ visibility: editing ? "visible" : "hidden" }}>
                    <button
                        className="toolbar-btn"
                        onClick={() => setShowTablePicker(prev => !prev)}
                        title="Chèn bảng"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="3" y1="15" x2="21" y2="15" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                            <line x1="15" y1="3" x2="15" y2="21" />
                        </svg>
                    </button>
                    {showTablePicker && (
                        <>
                            <div className="table-picker-backdrop" onClick={() => setShowTablePicker(false)} />
                            <div className="table-picker-popup">
                                <div className="table-picker-label">{hoverCell.row + 1} × {hoverCell.col + 1}</div>
                                <div className="table-picker-grid">
                                    {Array.from({ length: 5 }, (_, row) =>
                                        Array.from({ length: 5 }, (_, col) => (
                                            <div
                                                key={`${row}-${col}`}
                                                className={`table-picker-cell${row <= hoverCell.row && col <= hoverCell.col ? " active" : ""}`}
                                                onMouseEnter={() => setHoverCell({ row, col })}
                                                onClick={() => insertTable(row + 1, col + 1)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Content */}
                {editing ? (
                    blocks.map(block => {
                        if (block.type === "text") {
                            return (
                                <textarea
                                    key={block.id}
                                    ref={el => { if (el) textAreaRefs.current[block.id] = el; }}
                                    className="notes-editor-content"
                                    style={{ minHeight: 60, overflow: "hidden" }}
                                    value={block.content}
                                    onFocus={() => setFocusedBlockId(block.id)}
                                    onChange={(e) => {
                                        updateTextBlock(block.id, e.target.value);
                                        const el = e.target;
                                        const scrollY = window.scrollY;
                                        el.style.height = "auto";
                                        el.style.height = el.scrollHeight + "px";
                                        window.scrollTo(0, scrollY);
                                    }}
                                />
                            );
                        }
                        return (
                            <div key={block.id} className="editor-table-wrap">
                                <table className="editor-table">
                                    <thead>
                                        <tr>
                                            {block.rows[0].map((cell, ci) => (
                                                <th key={ci}>
                                                    <input
                                                        className="editor-table-cell"
                                                        value={cell}
                                                        onChange={e => updateCell(block.id, 0, ci, e.target.value)}
                                                        onKeyDown={e => handleCellKeyDown(e, block.id, 0, ci, block.rows)}
                                                    />
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {block.rows.slice(1).map((row, ri) => (
                                            <tr key={ri}>
                                                {row.map((cell, ci) => (
                                                    <td key={ci}>
                                                        <input
                                                            className="editor-table-cell"
                                                            value={cell}
                                                            onChange={e => updateCell(block.id, ri + 1, ci, e.target.value)}
                                                            onKeyDown={e => handleCellKeyDown(e, block.id, ri + 1, ci, block.rows)}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })
                ) : (
                    <div className="markdown-body" onClick={() => enterEditMode()} style={{ cursor: "text" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {savedMarkdown}
                        </ReactMarkdown>
                    </div>
                )}

            </div>

            {showMoveModal && (
                <MoveFolderModal
                    note={{ title, content: savedMarkdown }}
                    currentFolderId={folderId}
                    onMove={async (newFolderId) => {
                        await supabase.from("notes").update({ folder_id: newFolderId }).eq("id", id);
                        setFolderId(newFolderId);
                        setShowMoveModal(false);
                        navigate(newFolderId ? `/folder/${newFolderId}` : "/notes");
                    }}
                    onClose={() => setShowMoveModal(false)}
                />
            )}

            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-delete-title">Xóa ghi chú?</div>
                        <div className="modal-delete-desc">Ghi chú này sẽ bị xóa vĩnh viễn.</div>
                        <div className="modal-delete-actions">
                            <button className="modal-delete-cancel" onClick={() => setShowDeleteConfirm(false)}>
                                Hủy
                            </button>
                            <button className="modal-delete-confirm" onClick={deleteNote}>
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default NoteDetail;
