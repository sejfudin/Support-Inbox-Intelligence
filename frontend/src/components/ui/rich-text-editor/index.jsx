import * as React from "react"
import { EditorContent } from "@tiptap/react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import { _RichTextEditorProvider, _useRichTextEditorContext } from "./context";
import { _RichTextEditorToolbar } from "./toolbar"

function RichTextEditor({
  children,
  className,
  ...props
}) {
  return (
    <_RichTextEditorProvider {...props}>
      <div
        data-slot="rich-text-editor"
        className={cn(
          "flex h-[200px] flex-col divide-y rounded-lg border",
          "has-[.ProseMirror:focus-visible]:border-ring has-[.ProseMirror:focus-visible]:ring-ring/50 has-[.ProseMirror:focus-visible]:ring-[3px]",
          // disabled state
          "has-[[data-slot='rich-text-editor-content']>div[contenteditable='false']]:opacity-50",
          "has-[[data-slot='rich-text-editor-content']>div[contenteditable='false']]:pointer-events-none",
          className
        )}>
        {children}
      </div>
    </_RichTextEditorProvider>
  );
}

RichTextEditor.displayName = "RichTextEditor"

function RichTextEditorContent({
  className
}) {
  const { editor } = _useRichTextEditorContext()

  if (!editor) return null

  return (
    <ScrollArea
      className={cn("min-h-0 flex-1", // Make entire visual area of the editor clickable.
      "[&>[data-radix-scroll-area-viewport]>:first-child]:h-full")}>
      <EditorContent
        data-slot="rich-text-editor-content"
        className={cn(
          "prose prose-sm dark:prose-invert text-foreground h-full w-full max-w-none",
          // placeholder when editor is empty
          "[&_p.is-editor-empty:first-child::before]:text-muted-foreground [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          className
        )}
        editor={editor} />
    </ScrollArea>
  );
}

RichTextEditorContent.displayName = "RichTextEditorContent"

export {
  RichTextEditor,
  RichTextEditorContent,
  _RichTextEditorToolbar as RichTextEditorToolbar,
}
