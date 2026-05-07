import * as React from 'react';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const RichTextImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({
          'data-align': attributes.align || 'center',
        }),
      },
      size: {
        default: 'md',
        parseHTML: (element) => element.getAttribute('data-size') || 'md',
        renderHTML: (attributes) => ({
          'data-size': attributes.size || 'md',
        }),
      },
    };
  },
});

const RichTextEditorContext = React.createContext(null);

function useRichTextEditorContext() {
  const context = React.useContext(RichTextEditorContext);

  if (!context) {
    throw new Error('useRichTextEditorContext must be used within a <RichTextEditor />');
  }

  return context;
}

const RichTextEditorProvider = ({ children, onPasteImage, ...options }) => {
  const editorUpdateTimeoutRef = React.useRef(null);
  const editorRef = React.useRef(null);
  const onPasteImageRef = React.useRef(onPasteImage);

  React.useEffect(() => {
    onPasteImageRef.current = onPasteImage;
  }, [onPasteImage]);

  const onUpdate = React.useCallback(
    ({ editor }) => {
      if (editorUpdateTimeoutRef.current) {
        clearTimeout(editorUpdateTimeoutRef.current);
      }
      editorUpdateTimeoutRef.current = setTimeout(() => {
        options.onChange(editor.getHTML());
      }, 100);
    },
    [options.onChange]
  );

  React.useEffect(() => {
    return () => {
      if (editorUpdateTimeoutRef.current) {
        clearTimeout(editorUpdateTimeoutRef.current);
      }
    };
  }, []);

  const defaultExtensions = React.useMemo(
    () => [
      StarterKit,
      RichTextImage,
      Placeholder.configure({
        placeholder: options.placeholder || '',
      }),
    ],
    [options.placeholder]
  );

  const editor = useEditor(
    {
      ...options,
      extensions: [...defaultExtensions, ...(options.extensions || [])],
      content: options.value, // Set initial content; subsequent updates handled via effect below
      onUpdate: onUpdate,
      immediatelyRender:
        options.immediatelyRender !== undefined ? options.immediatelyRender : false,
      editorProps: {
        ...(options.editorProps || {}),
        handlePaste: (view, event, slice) => {
          const items = Array.from(event?.clipboardData?.items || []);
          const imageFiles = items
            .filter((item) => item?.type?.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter(Boolean);

          if (imageFiles.length === 0) {
            const externalHandlePaste = options.editorProps?.handlePaste;
            return externalHandlePaste ? externalHandlePaste(view, event, slice) : false;
          }

          if (typeof onPasteImageRef.current !== 'function') {
            return false;
          }

          const runUpload = async () => {
            for (const file of imageFiles) {
              try {
                const imageUrl = await onPasteImageRef.current(file);
                if (!imageUrl) continue;

                editorRef.current?.chain().focus().setImage({ src: imageUrl }).run();
              } catch (error) {
                console.error('[rich-text-editor] failed to paste image:', error);
              }
            }
          };

          void runUpload();
          return true;
        },
        attributes: {
          ...(options.editorProps?.attributes || {}),
          class:
            'focus:outline-none focus-visible:outline-none [&>*:first-child]:mt-0 max-w-none h-full px-4 py-2',
        },
      },
    },
    [options.placeholder]
  );

  React.useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // This useEffect ensures that the editor's content stays in sync with the external value prop.
  // It updates the editor only when the value changes externally and the editor is not focused,
  // preventing cursor jumps or overwriting user input during editing.
  React.useEffect(() => {
    if (editor && editor.getHTML() !== options.value) {
      if (!editor.isFocused) {
        editor.commands.setContent(options.value, false);
      }
    }
  }, [editor, options.value]);

  return (
    <RichTextEditorContext.Provider value={{ editor }}>{children}</RichTextEditorContext.Provider>
  );
};

export {
  RichTextEditorProvider as _RichTextEditorProvider,
  useRichTextEditorContext as _useRichTextEditorContext,
};
