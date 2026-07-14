import { useRef } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PagePanel } from '@/components/PageShell';
import { useDeleteMyCv, useMyInternProfile, useUploadMyCv } from '@/queries/interns';
import { toast } from 'sonner';

export function InternSelfServicePanel() {
  const fileRef = useRef(null);
  const { data: intern, isPending, isError } = useMyInternProfile();
  const { mutate: uploadCv, isPending: isUploading } = useUploadMyCv();
  const { mutate: deleteCv, isPending: isDeleting } = useDeleteMyCv();

  const handleCvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadCv(file, {
      onSuccess: () => toast.success('CV uploaded'),
      onError: (err) => toast.error(err?.response?.data?.message || 'Failed to upload CV'),
    });
    e.target.value = '';
  };

  if (isPending) {
    return (
      <PagePanel className="px-5 py-6 text-sm text-muted-foreground md:px-6">
        Loading internship profile...
      </PagePanel>
    );
  }

  if (isError || !intern) {
    return (
      <PagePanel className="px-5 py-6 text-sm text-destructive md:px-6">
        No internship profile found. Contact your programme admin.
      </PagePanel>
    );
  }

  return (
    <div className="space-y-6">
      <PagePanel className="px-5 py-6 md:px-6">
        <h2 className="text-lg font-semibold text-foreground">Internship programme</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep your CV up to date for placement tracking.
        </p>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="font-medium text-foreground">{intern.internshipType?.name}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize text-foreground">{intern.status}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
            <dt className="text-muted-foreground">Start date</dt>
            <dd className="font-medium text-foreground">
              {intern.startDate ? format(new Date(intern.startDate), 'MMM d, yyyy') : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
            <dt className="text-muted-foreground">Primary mentor</dt>
            <dd className="font-medium text-foreground">{intern.primaryMentor?.fullname || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3 sm:col-span-2">
            <dt className="text-muted-foreground">Secondary mentor</dt>
            <dd className="font-medium text-foreground">
              {intern.secondaryMentor?.fullname || '—'}
            </dd>
          </div>
        </dl>
      </PagePanel>

      <PagePanel className="px-5 py-6 md:px-6">
        <h3 className="text-base font-semibold text-foreground">CV</h3>
        <p className="mt-1 text-sm text-muted-foreground">Upload a PDF resume for mentors.</p>
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
            {isUploading ? 'Uploading...' : intern.cvUrl ? 'Replace CV' : 'Upload CV'}
          </Button>
          {intern.cvUrl && (
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
    </div>
  );
}
