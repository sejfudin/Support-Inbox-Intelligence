import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PagePanel } from '@/components/PageShell';
import {
  useDeleteMyCv,
  useMyInternProfile,
  useUpdateMyTechnologies,
  useUploadMyCv,
} from '@/queries/interns';
import { useTechnologies } from '@/queries/technologies';
import { getInternStatusLabel } from '@/helpers/internProfile';
import { toast } from 'sonner';

export function InternSelfServicePanel() {
  const fileRef = useRef(null);
  const { data: intern, isPending, isError } = useMyInternProfile();
  const { data: technologies = [] } = useTechnologies();
  const { mutate: saveTechnologies, isPending: isSavingTech } = useUpdateMyTechnologies();
  const { mutate: uploadCv, isPending: isUploading } = useUploadMyCv();
  const { mutate: deleteCv, isPending: isDeleting } = useDeleteMyCv();

  const [selectedTech, setSelectedTech] = useState([]);

  useEffect(() => {
    if (!intern) return;
    setSelectedTech((intern.selfTechnologies || []).map((t) => t._id || t));
  }, [intern]);

  const toggleTech = (id) => {
    setSelectedTech((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleSaveTechnologies = () => {
    saveTechnologies(selectedTech, {
      onSuccess: () => toast.success('Technologies updated'),
      onError: (err) =>
        toast.error(err?.response?.data?.message || 'Failed to update technologies'),
    });
  };

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
          Keep your declared technologies and CV up to date for placement tracking.
        </p>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="font-medium text-foreground">{intern.internshipType?.name}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium text-foreground">{getInternStatusLabel(intern.status)}</dd>
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

      <PagePanel className="px-5 py-6 md:px-6">
        <h3 className="text-base font-semibold text-foreground">Declared technologies</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the placement tracks you are working toward.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {technologies.map((tech) => (
            <label
              key={tech._id}
              className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <Checkbox
                checked={selectedTech.includes(tech._id)}
                onCheckedChange={() => toggleTech(tech._id)}
                data-test={`my-internship-tech-${tech.slug}-checkbox`}
              />
              {tech.name}
            </label>
          ))}
        </div>
        <Button
          type="button"
          className="mt-5"
          disabled={isSavingTech}
          onClick={handleSaveTechnologies}
          data-test="my-internship-technologies-save-button"
        >
          {isSavingTech ? 'Saving...' : 'Save technologies'}
        </Button>
      </PagePanel>
    </div>
  );
}
