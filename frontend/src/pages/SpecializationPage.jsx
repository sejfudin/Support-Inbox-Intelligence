import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PageHeading from '@/components/PageHeading';
import { PageShell, PageSection } from '@/components/PageShell';
import { useSpecializedCandidates } from '@/queries/specializations';
import { AssignSpecializationModal } from '@/components/interns/specialization/AssignSpecializationModal';
import { formatDate } from '@/helpers/date';

const tableHeadClass =
  'h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground';
const tableCellClass = 'px-4 py-4';

export default function SpecializationPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const { data, isPending, isError } = useSpecializedCandidates({ page, limit: 20 });

  const specializations = data?.specializations ?? [];
  const pagination = data?.pagination;
  const totalMatching = pagination?.total ?? 0;

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          kicker="Programme management"
          title="Specialization"
          subtitle="Confirm an intern's focus position and pair them with a dedicated mentor."
          actions={
            <Button
              type="button"
              onClick={() => setAssignModalOpen(true)}
              data-test="assign-specialization-button"
            >
              <Plus className="h-4 w-4" />
              Assign specialization
            </Button>
          }
        />

        <div className="app-panel overflow-hidden pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 md:px-6">
            <p className="text-sm text-muted-foreground">
              {isPending
                ? 'Loading specializations...'
                : `${totalMatching} specialized intern${totalMatching === 1 ? '' : 's'}`}
            </p>
          </div>

          {isError && (
            <p className="p-6 text-sm text-destructive" data-test="specializations-error">
              Failed to load specializations.
            </p>
          )}
          {isPending && (
            <p className="p-6 text-sm text-muted-foreground">Loading specializations...</p>
          )}
          {!isPending && !isError && (
            <div className="overflow-x-auto">
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow className="bg-secondary/60">
                    <TableHead className={tableHeadClass}>Intern</TableHead>
                    <TableHead className={tableHeadClass}>Position</TableHead>
                    <TableHead className={tableHeadClass}>Mentor</TableHead>
                    <TableHead className={tableHeadClass}>Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specializations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        No specializations assigned yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {specializations.map((specialization) => (
                    <TableRow
                      key={specialization._id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() =>
                        specialization.user?._id && navigate(`/user/${specialization.user._id}`)
                      }
                      data-test={`specialization-row-${specialization._id}`}
                    >
                      <TableCell className={tableCellClass}>
                        <p className="font-semibold text-foreground">
                          {specialization.user?.fullname || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {specialization.user?.email || '-'}
                        </p>
                      </TableCell>
                      <TableCell className={tableCellClass}>
                        {specialization.declaredPosition?.name ? (
                          <Badge variant="outline">{specialization.declaredPosition.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        {specialization.secondaryPosition?.name && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            2nd: {specialization.secondaryPosition.name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={tableCellClass}>
                        {specialization.secondaryMentor?.fullname || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className={`${tableCellClass} whitespace-nowrap text-muted-foreground`}>
                        {formatDate(specialization.specializationAssignedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  data-test="specializations-prev-page-button"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  data-test="specializations-next-page-button"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageSection>

      <AssignSpecializationModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
      />
    </PageShell>
  );
}
