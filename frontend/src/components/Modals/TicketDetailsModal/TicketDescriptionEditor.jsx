import { ImagePlus, Plus, Ticket, X } from 'lucide-react';
import {
  RichTextEditor,
  RichTextEditorContent,
  RichTextEditorImageOptions,
  RichTextEditorToolbar,
} from '@/components/ui/rich-text-editor';
import AiDescriptionPanel from '@/components/Tickets/AiDescriptionPanel';

export function TicketDescriptionEditor({
  isArchived,
  description,
  setDescription,
  descriptionSectionRef,
  descriptionInputRef,
  handleDescriptionImageHover,
  clearDescriptionImageHover,
  handleDescriptionImagePick,
  handleDescriptionImagePaste,
  uploadDescriptionImagesMutation,
  descriptionHoverZoom,
  previewImageUrl,
  setPreviewImageUrl,
  aiDescription,
  isSavePending,
}) {
  return (
    <section
      ref={descriptionSectionRef}
      className="relative rounded-2xl border border-border bg-card shadow-md overflow-hidden"
      onMouseMove={handleDescriptionImageHover}
      onMouseLeave={clearDescriptionImageHover}
    >
      <RichTextEditor
        value={description}
        onChange={(html) => setDescription(html)}
        onPasteImage={handleDescriptionImagePaste}
        className="min-h-[220px] border-0 rounded-none divide-y-0 sm:min-h-[300px] lg:min-h-[360px]"
        editable={!isArchived}
      >
        <div className="flex flex-col gap-2 border-b border-separator bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
          <div className="flex shrink-0 items-center gap-2">
            <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Description
            </span>
          </div>
          {!isArchived && (
            <div className="min-w-0 flex items-center gap-2 justify-end">
              <input
                ref={descriptionInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleDescriptionImagePick}
                data-test="ticket-modal-description-image-file-input"
              />
              <button
                type="button"
                onClick={() => descriptionInputRef.current?.click()}
                disabled={uploadDescriptionImagesMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                data-test="ticket-modal-description-upload-button"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                Upload
              </button>
              <RichTextEditorImageOptions />
              <div className="min-w-0 max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch] pb-0.5 sm:pb-0">
                <div className="w-max">
                  <RichTextEditorToolbar className="w-max flex-nowrap whitespace-nowrap p-0 sm:flex-wrap" />
                </div>
              </div>
            </div>
          )}
        </div>
        <RichTextEditorContent className="p-3 sm:p-4" data-test="ticket-modal-description-input" />
      </RichTextEditor>

      {descriptionHoverZoom && (
        <button
          type="button"
          data-description-image-zoom
          data-test="ticket-modal-description-image-zoom-button"
          className="fixed z-[230] flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
          style={{
            top: `${descriptionHoverZoom.top}px`,
            left: `${descriptionHoverZoom.left}px`,
          }}
          onClick={() => {
            setPreviewImageUrl(descriptionHoverZoom.src);
            clearDescriptionImageHover();
          }}
          aria-label="Preview description image"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[220] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-card p-2"
            onClick={() => setPreviewImageUrl(null)}
            aria-label="Close image preview"
            data-test="ticket-modal-description-preview-close-button"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          <img
            src={previewImageUrl}
            alt="Description preview"
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <AiDescriptionPanel
        isVisible={!isArchived && aiDescription.isPromptPanelVisible}
        promptLength={aiDescription.promptLength}
        canGenerateDescription={aiDescription.canGenerateDescription}
        isGeneratingDescription={aiDescription.isGeneratingDescription}
        isDescriptionDraftActive={aiDescription.isDescriptionDraftActive}
        onGenerate={() => aiDescription.generateDescription({ showToast: true })}
        onAccept={aiDescription.acceptGeneratedDescription}
        onCancel={aiDescription.cancelGeneratedDescription}
        disabled={isSavePending || isArchived}
      />
    </section>
  );
}
