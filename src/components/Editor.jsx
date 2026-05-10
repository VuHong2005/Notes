import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

export default function Editor({ content, setContent }) {

    const editor = useEditor({
        extensions: [
            StarterKit,
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: content,
        onUpdate: ({ editor }) => {
            setContent(editor.getHTML());
        },
    });

    if (!editor) return null;

    return (
        <div>
            {/* toolbar */}
            <div className="toolbar">
                <button onClick={() =>
                    editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run()
                }>
                    📊 Bảng
                </button>
            </div>

            <EditorContent editor={editor} />
        </div>
    );
}