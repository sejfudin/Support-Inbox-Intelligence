import * as React from 'react';
import { EditorContent } from '@tiptap/react';

import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

import { _RichTextEditorProvider, _useRichTextEditorContext } from './context';
import { _RichTextEditorImageOptions, _RichTextEditorToolbar } from './toolbar';

function RichTextEditor({ children, className, ...props }) {
  return (
    <_RichTextEditorProvider {...props}>
      <div
        data-slot="rich-text-editor"
        className={cn(
          'flex min-h-[200px] flex-col divide-y divide-separator rounded-lg border',
          'has-[.ProseMirror:focus-visible]:border-ring has-[.ProseMirror:focus-visible]:ring-ring/50 has-[.ProseMirror:focus-visible]:ring-[3px]',
          // disabled state
          "has-[[data-slot='rich-text-editor-content']>div[contenteditable='false']]:opacity-50",
          "has-[[data-slot='rich-text-editor-content']>div[contenteditable='false']]:pointer-events-none",
          className
        )}
      >
        {children}
      </div>
    </_RichTextEditorProvider>
  );
}

RichTextEditor.displayName = 'RichTextEditor';

function RichTextEditorContent({ className, 'data-test': dataTest = 'rte-content-input', ...props }) {
  const { editor } = _useRichTextEditorContext();

  if (!editor) return null;

  return (
    <ScrollArea
      className={cn(
        'min-h-0 flex-1', // Make entire visual area of the editor clickable.
        '[&>[data-radix-scroll-area-viewport]>:first-child]:h-full'
      )}
    >
      <EditorContent
        data-test={dataTest}
        data-slot="rich-text-editor-content"
        className={cn(
          'prose prose-sm dark:prose-invert text-foreground h-full w-full max-w-none',
          '[&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md',
          'sm:[&_img:not([data-size])]:max-w-md',
          'sm:[&_img[data-size=sm]]:max-w-xs sm:[&_img[data-size=md]]:max-w-md sm:[&_img[data-size=lg]]:max-w-lg',
          '[&_img[data-align=left]]:ml-0 [&_img[data-align=left]]:mr-auto',
          '[&_img[data-align=center]]:mx-auto',
          '[&_img[data-align=right]]:ml-auto [&_img[data-align=right]]:mr-0',
          // placeholder when editor is empty
          '[&_p.is-editor-empty:first-child::before]:text-muted-foreground [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          className
        )}
        editor={editor}
        {...props}
      />
    </ScrollArea>
  );
}

RichTextEditorContent.displayName = 'RichTextEditorContent';

export {
  RichTextEditor,
  RichTextEditorContent,
  _RichTextEditorToolbar as RichTextEditorToolbar,
  _RichTextEditorImageOptions as RichTextEditorImageOptions,
};
