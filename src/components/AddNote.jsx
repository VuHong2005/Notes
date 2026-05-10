import { useState, useEffect, useRef } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./notes.css";

function AddNote() {

    const [title, setTitle] = useState(() => localStorage.getItem("draft_title") || "");

    // blocks: mảng theo thứ tự hiển thị — { type:'text', id, content } hoặc { type:'table', id, rows }
    const [blocks, setBlocks] = useState(() => {
        const saved = localStorage.getItem("draft_blocks");
        if (!saved) return [{ type: "text", id: 1, content: "" }];
        const parsed = JSON.parse(saved);
        // Gộp text block liền kề khi load (dọn stale data)
        const merged = [];
        for (const b of parsed) {
            const last = merged[merged.length - 1];
            if (b.type === "text" && last?.type === "text") {
                last.content = [last.content, b.content].filter(Boolean).join("\n");
            } else {
                merged.push({ ...b });
            }
        }
        return merged.length ? merged : [{ type: "text", id: 1, content: "" }];
    });

    const [focusedBlockId, setFocusedBlockId] = useState(null);
    const [showTablePicker, setShowTablePicker] = useState(false);
    const [hoverCell, setHoverCell] = useState({ row: 0, col: 0 });
    const [folderName, setFolderName] = useState("");
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);
    useEffect(() => {
        if (!showMenu) return;
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showMenu]);

    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("theme", next ? "dark" : "light");
        setShowMenu(false);
    };

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Nếu tạo note từ trong folder, lấy folder_id từ query param
    const folderIdFromUrl = searchParams.get("folder_id");

    // Ref map để focus textarea theo block id
    const textAreaRefs = useRef({});
    // Ref để luôn đọc được blocks mới nhất trong event handler
    const blocksRef = useRef(blocks);
    useEffect(() => { blocksRef.current = blocks; }, [blocks]);

    useEffect(() => { localStorage.setItem("draft_title", title); }, [title]);
    useEffect(() => { localStorage.setItem("draft_blocks", JSON.stringify(blocks)); }, [blocks]);

    // Lấy tên folder để hiển thị trên nút back
    useEffect(() => {
        if (!folderIdFromUrl) return;
        supabase.from("folders").select("name").eq("id", folderIdFromUrl).single()
            .then(({ data }) => { if (data) setFolderName(data.name); });
    }, [folderIdFromUrl]);

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

    // Chèn bảng sau block đang focus
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

            // Block đang focus rỗng → thay thế bằng bảng (không giữ text rỗng phía trên)
            if (focused?.type === "text" && !focused.content.trim()) {
                return [...prev.slice(0, idx), newTable, newTextBlock, ...prev.slice(idx + 1)];
            }
            // Block có nội dung → chèn bảng sau nó
            return [...prev.slice(0, idx + 1), newTable, newTextBlock, ...prev.slice(idx + 1)];
        });
        setShowTablePicker(false);
    };

    const updateTextBlock = (id, content) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
    };

    const updateCell = (tableId, ri, ci, val) => {
        setBlocks(prev => prev.map(b =>
            b.id !== tableId ? b : {
                ...b,
                rows: b.rows.map((row, r) =>
                    r !== ri ? row : row.map((cell, c) => c === ci ? val : cell)
                )
            }
        ));
    };

    // Xóa bảng rồi gộp text block liền kề
    const deleteTable = (tableId) => {
        setBlocks(prev => {
            const without = prev.filter(b => b.id !== tableId);
            const merged = [];
            for (const b of without) {
                const last = merged[merged.length - 1];
                if (b.type === "text" && last?.type === "text") {
                    last.content = [last.content, b.content].filter(Boolean).join("\n");
                } else {
                    merged.push({ ...b });
                }
            }
            return merged.length ? merged : [{ type: "text", id: Date.now(), content: "" }];
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

    // Serialize blocks → markdown để lưu
    const blocksToMarkdown = () =>
        blocks.map(b => {
            if (b.type === "text") return b.content.trim();
            const [header, ...rest] = b.rows;
            return [
                "| " + header.join(" | ") + " |",
                "| " + header.map(() => "---").join(" | ") + " |",
                ...rest.map(row => "| " + row.join(" | ") + " |")
            ].join("\n");
        }).filter(Boolean).join("\n\n");

    const saveNote = async () => {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) { alert("Bạn chưa đăng nhập"); return; }

        const noteData = { title, content: blocksToMarkdown(), user_id: userData.user.id };
        // Nếu tạo từ trong folder thì gán folder_id
        if (folderIdFromUrl) noteData.folder_id = folderIdFromUrl;

        const { error } = await supabase.from("notes").insert([noteData]);
        if (error) { console.log(error); alert("Lỗi khi lưu note"); return; }

        localStorage.removeItem("draft_title");
        localStorage.removeItem("draft_blocks");
        // Quay lại folder nếu tạo từ folder, ngược lại về danh sách chung
        navigate(folderIdFromUrl ? `/folder/${folderIdFromUrl}` : "/notes");
    };

    return (
        <div className="notes-editor">

            <div className="notes-editor-topbar">
                <button className="notes-back-btn" onClick={() => {
                    localStorage.removeItem("draft_title");
                    localStorage.removeItem("draft_blocks");
                    navigate(folderIdFromUrl ? `/folder/${folderIdFromUrl}` : "/notes");
                }}>
                    <svg viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 1L2 8l6 7" />
                    </svg>
                    {folderIdFromUrl ? (folderName || "Thư mục") : "Ghi chú"}
                </button>
                <button className="notes-action-btn" onClick={saveNote}>Xong</button>
                <div className="topbar-menu-wrap" ref={menuRef}>
                    <button className="topbar-menu-btn" onClick={() => setShowMenu(v => !v)}>
                        <svg viewBox="0 0 18 6" fill="currentColor" width="18" height="6">
                            <circle cx="3" cy="3" r="1.5" />
                            <circle cx="9" cy="3" r="1.5" />
                            <circle cx="15" cy="3" r="1.5" />
                        </svg>
                    </button>
                    {showMenu && (
                        <div className="topbar-menu-dropdown" style={{ right: 0, left: "auto", minWidth: 220 }}>
                            <button className="topbar-menu-item" onClick={toggleTheme}>
                                <span>{isDark ? "Sử dụng nền sáng màu" : "Sử dụng nền tối màu"}</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/>
                                </svg>
                            </button>
                            <div className="topbar-menu-divider" />
                            <button className="topbar-menu-item" style={{ color: "#ff3b30" }} onClick={() => {
                                localStorage.removeItem("draft_title");
                                localStorage.removeItem("draft_blocks");
                                navigate(folderIdFromUrl ? `/folder/${folderIdFromUrl}` : "/notes");
                            }}>
                                <span>Xóa</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" strokeLinecap="round" /><path d="M9 6V4h6v2" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="notes-editor-body">

                <div className="notes-editor-date">
                    {new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>

                <input
                    className="notes-editor-title"
                    placeholder="Tiêu đề"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                />

                {/* Toolbar */}
                <div className="editor-toolbar">
                    <button className="toolbar-btn" onClick={() => setShowTablePicker(p => !p)} title="Chèn bảng">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
                            <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
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

                {/* Render blocks theo thứ tự */}
                {blocks.map(block => {
                    if (block.type === "text") {
                        return (
                            <textarea
                                key={block.id}
                                ref={el => { if (el) textAreaRefs.current[block.id] = el; }}
                                className="notes-editor-content"
                                style={{ minHeight: 60, overflow: "hidden" }}
                                placeholder="Bắt đầu nhập..."
                                value={block.content}
                                onFocus={() => setFocusedBlockId(block.id)}
                                onChange={e => {
                                    updateTextBlock(block.id, e.target.value);
                                    e.target.style.height = "auto";
                                    e.target.style.height = e.target.scrollHeight + "px";
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
                })}

            </div>
        </div>
    );
}

export default AddNote;
