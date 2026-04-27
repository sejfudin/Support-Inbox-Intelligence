import * as React from "react"
import Placeholder from "@tiptap/extension-placeholder"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit";

const RichTextEditorContext =
  React.createContext(null)

function useRichTextEditorContext() {
  const context = React.useContext(RichTextEditorContext)

  if (!context) {
    throw new Error("useRichTextEditorContext must be used within a <RichTextEditor />")
  }

  return context
}

const RichTextEditorProvider = ({
  children,
  ...options
}) => {
  const editorUpdateTimeoutRef = React.useRef(null)

  const onUpdate = React.useCallback(({
    editor
  }) => {
    if (editorUpdateTimeoutRef.current) {
      clearTimeout(editorUpdateTimeoutRef.current)
    }
    editorUpdateTimeoutRef.current = setTimeout(() => {
      options.onChange(editor.getHTML())
    }, 100)
  }, [options.onChange])

  React.useEffect(() => {
    return () => {
      if (editorUpdateTimeoutRef.current) {
        clearTimeout(editorUpdateTimeoutRef.current)
      }
    };
  }, [])

  const defaultExtensions = React.useMemo(() => [
    StarterKit,
    Placeholder.configure({
      placeholder: options.placeholder || "",
    }),
  ], [options.placeholder])

  const editor = useEditor({
    ...options,
    extensions: [...defaultExtensions, ...(options.extensions || [])],
    content: options.value, // Set initial content; subsequent updates handled via effect below
    onUpdate: onUpdate,
    immediatelyRender:
      options.immediatelyRender !== undefined
        ? options.immediatelyRender
        : false,
    editorProps: {
      ...(options.editorProps || {}),
      attributes: {
        ...(options.editorProps?.attributes || {}),
        class:
          "focus:outline-none focus-visible:outline-none [&>*:first-child]:mt-0 max-w-none h-full px-4 py-2",
      },
    },
  }, [options.placeholder])

  // This useEffect ensures that the editor's content stays in sync with the external value prop.
  // It updates the editor only when the value changes externally and the editor is not focused,
  // preventing cursor jumps or overwriting user input during editing.
  React.useEffect(() => {
    if (editor && editor.getHTML() !== options.value) {
      if (!editor.isFocused) {
        editor.commands.setContent(options.value, false)
      }
    }
  }, [editor, options.value])

  return (
    <RichTextEditorContext.Provider value={{ editor }}>
      {children}
    </RichTextEditorContext.Provider>
  );
}

export {
  RichTextEditorProvider as _RichTextEditorProvider,
  useRichTextEditorContext as _useRichTextEditorContext,
}
