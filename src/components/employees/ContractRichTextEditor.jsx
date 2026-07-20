import { useEffect, useRef } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Redo2, RemoveFormatting, Underline, Undo2 } from "lucide-react";

const ALLOWED_TAGS = new Set(["P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI"]);
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META"]);

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function toEditorHtml(value) {
  const text = String(value || "");
  if (/<\/?(?:p|div|br|strong|b|em|i|u|ul|ol|li)\b/i.test(text)) return text;
  return text.split(/\r?\n/).map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`).join("");
}

export function sanitizeContractHtml(value) {
  if (typeof document === "undefined") return String(value || "");
  const template = document.createElement("template");
  template.innerHTML = toEditorHtml(value);
  for (const element of [...template.content.querySelectorAll("*")].reverse()) {
    if (DROP_TAGS.has(element.tagName)) {
      element.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    const alignment = element.style?.textAlign;
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
    if (["left", "center", "right", "justify"].includes(alignment)) element.style.textAlign = alignment;
  }
  return template.innerHTML;
}

function ToolbarButton({ title, command, value, editorRef, children }) {
  const execute = () => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return <button type="button" title={title} onMouseDown={(event) => event.preventDefault()} onClick={execute} className="rounded-md p-1.5 text-slate-600 transition hover:bg-violet-100 hover:text-violet-700">{children}</button>;
}

export default function ContractRichTextEditor({ label, value, onChange }) {
  const editorRef = useRef(null);
  const lastEmittedRef = useRef("");

  useEffect(() => {
    const nextHtml = sanitizeContractHtml(value);
    if (editorRef.current && nextHtml !== lastEmittedRef.current && editorRef.current.innerHTML !== nextHtml) editorRef.current.innerHTML = nextHtml;
  }, [value]);

  const emitChange = () => {
    const nextHtml = sanitizeContractHtml(editorRef.current?.innerHTML || "");
    lastEmittedRef.current = nextHtml;
    onChange(nextHtml);
  };

  const cleanEditor = () => {
    const nextHtml = sanitizeContractHtml(editorRef.current?.innerHTML || "");
    if (editorRef.current && editorRef.current.innerHTML !== nextHtml) editorRef.current.innerHTML = nextHtml;
    lastEmittedRef.current = nextHtml;
    onChange(nextHtml);
  };

  const pastePlainText = (event) => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
  };

  return <div className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-sm">
    <div className="border-b border-violet-100 bg-violet-50/70 px-3 py-2 text-xs font-black uppercase tracking-wide text-violet-800">{label}</div>
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-white px-2 py-1.5">
      <ToolbarButton title="Hoàn tác" command="undo" editorRef={editorRef}><Undo2 size={16} /></ToolbarButton>
      <ToolbarButton title="Làm lại" command="redo" editorRef={editorRef}><Redo2 size={16} /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton title="In đậm" command="bold" editorRef={editorRef}><Bold size={16} /></ToolbarButton>
      <ToolbarButton title="In nghiêng" command="italic" editorRef={editorRef}><Italic size={16} /></ToolbarButton>
      <ToolbarButton title="Gạch chân" command="underline" editorRef={editorRef}><Underline size={16} /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton title="Căn trái" command="justifyLeft" editorRef={editorRef}><AlignLeft size={16} /></ToolbarButton>
      <ToolbarButton title="Căn giữa" command="justifyCenter" editorRef={editorRef}><AlignCenter size={16} /></ToolbarButton>
      <ToolbarButton title="Căn phải" command="justifyRight" editorRef={editorRef}><AlignRight size={16} /></ToolbarButton>
      <ToolbarButton title="Căn đều hai bên" command="justifyFull" editorRef={editorRef}><AlignJustify size={16} /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton title="Danh sách dấu đầu dòng" command="insertUnorderedList" editorRef={editorRef}><List size={16} /></ToolbarButton>
      <ToolbarButton title="Danh sách đánh số" command="insertOrderedList" editorRef={editorRef}><ListOrdered size={16} /></ToolbarButton>
      <ToolbarButton title="Xóa định dạng" command="removeFormat" editorRef={editorRef}><RemoveFormatting size={16} /></ToolbarButton>
    </div>
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      onInput={emitChange}
      onBlur={cleanEditor}
      onPaste={pastePlainText}
      className="min-h-44 max-h-80 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:min-h-[1.25rem] [&_ul]:ml-6 [&_ul]:list-disc"
    />
  </div>;
}
