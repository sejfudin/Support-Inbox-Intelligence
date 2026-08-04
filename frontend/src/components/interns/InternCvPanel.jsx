import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { PagePanel } from '@/components/PageShell';
import { useDeleteMyCv, useMyInternProfile, useUploadMyCv } from '@/queries/interns';
import { toast } from 'sonner';

const countLabel = (count) => `${count} ${count === 1 ? 'technology' : 'technologies'}`;
const nameList = (technologies) => technologies.map((t) => t.name).join(', ');

export function InternCvPanel() {
  const fileRef = useRef(null);
  const { data: intern } = useMyInternProfile();
  const { mutate: uploadCv, isPending: isUploading } = useUploadMyCv();
  const { mutate: deleteCv, isPending: isDeleting } = useDeleteMyCv();

  const handleCvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadCv(file, {
      onSuccess: (data) => {
        const added = data?.addedTechnologies || [];
        // Replacing a CV drops what the previous scan added and the new one no longer mentions,
        // so say what went away too — otherwise technologies vanish from the list below with
        // no explanation.
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
    <PagePanel className="px-5 py-6 md:px-6">
      <h3 className="text-base font-semibold text-foreground">CV</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a PDF resume for mentors. We&apos;ll scan it and add any technologies we recognize to
        your list below — you can still add more manually. Replacing your CV re-scans it, so
        technologies the new CV no longer mentions are removed; anything you added yourself stays.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleCvUpload}
        data-test="my-internship-cv-input"
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          data-test="my-internship-cv-upload-button"
        >
          {isUploading ? 'Uploading...' : intern?.cvUrl ? 'Replace CV' : 'Upload CV'}
        </Button>
        {intern?.cvUrl && (
          <>
            <Button
              type="button"
              variant="outline"
              asChild
              data-test="my-internship-cv-view-button"
            >
              <a href={intern.cvUrl} target="_blank" rel="noreferrer">
                View CV
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() =>
                deleteCv(undefined, {
                  onSuccess: () => toast.success('CV removed'),
                  onError: (err) =>
                    toast.error(err?.response?.data?.message || 'Failed to remove CV'),
                })
              }
              data-test="my-internship-cv-delete-button"
            >
              Remove
            </Button>
          </>
        )}
      </div>
    </PagePanel>
  );
}
