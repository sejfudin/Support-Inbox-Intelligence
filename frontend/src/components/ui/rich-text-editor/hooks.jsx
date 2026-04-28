import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  UndoIcon,
} from "lucide-react"

import { _useRichTextEditorContext } from "./context"

const getActiveHeading = (editor) => {
  if (editor.isActive("heading")) {
    const level = editor.getAttributes("heading").level
    if (level === 5 || level === 6) {
      return "P"
    }
    return `H${level}`
  }

  return "P"
}

function useHeading() {
  const { editor } = _useRichTextEditorContext()

  if (!editor) return { headings: [], activeHeading: "P" }

  const activeHeading = getActiveHeading(editor)

  const headings = [
    {
      label: "P",
      action: () => editor.chain().focus().setParagraph().run(),
      disabled: false,
      shortcut: "⌘+Alt+0",
    },
    {
      label: "H1",
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      disabled: !editor.can().chain().focus().toggleHeading({ level: 1 }).run(),
      shortcut: "⌘+Alt+1",
    },
    {
      label: "H2",
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      disabled: !editor.can().chain().focus().toggleHeading({ level: 2 }).run(),
      shortcut: "⌘+Alt+2",
    },
    {
      label: "H3",
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      disabled: !editor.can().chain().focus().toggleHeading({ level: 3 }).run(),
      shortcut: "⌘+Alt+3",
    },
    {
      label: "H4",
      action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
      disabled: !editor.can().chain().focus().toggleHeading({ level: 4 }).run(),
      shortcut: "⌘+Alt+4",
    },
  ]

  return { headings, activeHeading }
}

function useToolbarItems() {
  const { editor } = _useRichTextEditorContext()

  if (!editor) return []

  const toolbarItemGroup = [
    {
      id: 1,
      items: [
        {
          icon: BoldIcon,
          tooltip: "Bold",
          shortcut: `⌘+B`,
          isActive: editor.isActive("bold"),
          onClick: () => editor.chain().focus().toggleBold().run(),
        },
        {
          icon: ItalicIcon,
          tooltip: "Italic",
          shortcut: `⌘+I`,
          isActive: editor.isActive("italic"),
          onClick: () => editor.chain().focus().toggleItalic().run(),
          disabled: !editor.can().chain().focus().toggleItalic().run(),
        },
        {
          icon: StrikethroughIcon,
          tooltip: "Strike",
          shortcut: `⌘+Shift+S`,
          isActive: editor.isActive("strike"),
          onClick: () => editor.chain().focus().toggleStrike().run(),
          disabled: !editor.can().chain().focus().toggleStrike().run(),
        },
      ],
    },
    {
      id: 2,
      items: [
        {
          icon: ListIcon,
          tooltip: "Bullet List",
          shortcut: `⌘+Shift+8`,
          isActive: editor.isActive("bulletList"),
          onClick: () => editor.chain().focus().toggleBulletList().run(),
          disabled: !editor.can().chain().focus().toggleBulletList().run(),
        },
        {
          icon: ListOrderedIcon,
          tooltip: "Numbered List",
          shortcut: `⌘+Shift+7`,
          isActive: editor.isActive("orderedList"),
          onClick: () => editor.chain().focus().toggleOrderedList().run(),
          disabled: !editor.can().chain().focus().toggleOrderedList().run(),
        },
        {
          icon: CodeIcon,
          tooltip: "Code",
          shortcut: `⌘+E`,
          isActive: editor.isActive("code"),
          onClick: () => editor.chain().focus().toggleCode().run(),
          disabled: !editor.can().chain().focus().toggleCode().run(),
        },
        {
          icon: QuoteIcon,
          tooltip: "Quote",
          shortcut: `⌘+Shift+B`,
          isActive: editor.isActive("blockquote"),
          onClick: () => editor.chain().focus().toggleBlockquote().run(),
          disabled: !editor.can().chain().focus().toggleBlockquote().run(),
        },
      ],
    },
    {
      id: 3,
      items: [
        {
          icon: UndoIcon,
          tooltip: "Undo",
          shortcut: `⌘+Z`,
          isActive: false,
          onClick: () => editor.chain().focus().undo().run(),
          disabled: !editor.can().chain().focus().undo().run(),
        },
        {
          icon: RedoIcon,
          tooltip: "Redo",
          shortcut: `⌘+Shift+Z`,
          isActive: false,
          onClick: () => editor.chain().focus().redo().run(),
          disabled: !editor.can().chain().focus().redo().run(),
        },
      ],
    },
  ]

  return toolbarItemGroup
}

export { useHeading as _useHeading, useToolbarItems as _useToolbarItems }
