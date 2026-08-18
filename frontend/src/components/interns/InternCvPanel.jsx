import { useRef } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PagePanel } from '@/components/PageShell';
import { useDeleteMyCv, useMyInternProfile, useUploadMyCv } from '@/queries/interns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const countLabel = (count) => `${count} ${count === 1 ? 'technology' : 'technologies'}`;
const nameList = (technologies) => technologies.map((t) => t.name).join(', ');

// Rail buttons: the flat card's 34px control, not the default 40px.
const ACTION_CLASS = 'h-[34px] rounded-[var(--r-control)] px-[13px] text-[12.5px]';

export function InternCvPanel({ className }) {
  const fileRef = useRef(null);
  const { data: intern } = useMyInternProfile();
  const { mutate: uploadCv, isPending: isUploading } = useUploadMyCv();
  const { mutate: deleteCv, isPending: isDeleting } = useDeleteMyCv();

  const hasCv = Boolean(intern?.cvUrl);

  const handleCvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadCv(file, {
      onSuccess: (data) => {
        const added = data?.addedTechnologies || [];
        // Replacing a CV drops what the previous scan added and the new one no longer mentions,
        // so say what went away too — otherwise technologies vanish from the list beside this
        // card with no explanation.
        const removed = data?.removedTechnologies || [];
        const changes = [];
        if (added.length) changes.push(`added ${countLabel(added.length)}: ${nameList(added)}`);
        if (removed.length) {
          changes.push(`removed ${countLabel(removed.length)}: ${nameList(removed)}`);
        }
        toast.success(changes.length ? `CV uploaded — ${changes.join('; ')}` : 'CV uploaded');
      },
      onError: (err) => toast.error(err?.response?.data?.message || 'Failed to upload CV'),
    });
    e.target.value = '';
  };

  return (
    // A flex column so the actions can take the slack: this card shares a grid row
    // with the Position card, and whichever of the two is shorter is stretched to
    // the other's height. Buttons floating mid-card is what that would otherwise
    // look like.
    <PagePanel className={cn('flex flex-col px-[18px] pb-[18px] pt-[15px]', className)}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[var(--r-tile)] bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="app-card-title">CV</h2>
          {/* The stored file is a generated path, not the name the intern picked, and
              nothing records when it landed — so this line reports whether a CV is on
              file and stops there rather than showing an identifier they'd not
              recognise. */}
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {hasCv ? 'PDF on file' : 'No CV uploaded yet'}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-[1.5] text-muted-foreground">
        We scan your PDF and add the technologies we recognise. Replacing it re-scans — anything you
        added yourself stays.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleCvUpload}
        data-test="my-internship-cv-input"
      />

      {hasCv ? (
        <>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-3.5">
            <Button
              type="button"
              variant="outline"
              asChild
              className={ACTION_CLASS}
              data-test="my-internship-cv-view-button"
            >
              <a href={intern.cvUrl} target="_blank" rel="noreferrer">
                View CV
              </a>
            </Button>
            <Button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className={ACTION_CLASS}
              data-test="my-internship-cv-upload-button"
            >
              {isUploading ? 'Uploading…' : 'Replace CV'}
            </Button>
          </div>
          {/* Deleting is rarer than replacing and destroys the scan, so it keeps the
              quietest treatment on the card rather than a third equal button. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isDeleting}
            onClick={() =>
              deleteCv(undefined, {
                onSuccess: () => toast.success('CV removed'),
                onError: (err) =>
                  toast.error(err?.response?.data?.message || 'Failed to remove CV'),
              })
            }
            className="mt-1.5 h-7 w-full text-[11.5px] font-normal text-muted-foreground hover:text-[hsl(var(--tone-danger-fg))]"
            data-test="my-internship-cv-delete-button"
          >
            {isDeleting ? 'Removing…' : 'Remove CV'}
          </Button>
        </>
      ) : (
        <div className="mt-auto pt-3.5">
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className={cn('w-full', ACTION_CLASS)}
            data-test="my-internship-cv-upload-button"
          >
            {isUploading ? 'Uploading…' : 'Upload CV'}
          </Button>
        </div>
      )}
    </PagePanel>
  );
}
