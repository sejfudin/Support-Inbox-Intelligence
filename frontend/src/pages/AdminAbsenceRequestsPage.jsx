import { useState } from 'react';
import PageHeading from '@/components/PageHeading';
import { Tabs, TabsList, TabsTrigger, TabsCount, TabsContent } from '@/components/ui/tabs';
import { PagePanel } from '@/components/PageShell';
import AttendanceRequestQueue from '@/components/attendance/AttendanceRequestQueue';
import { AttendanceLimitsPanel } from '@/components/attendance/AttendanceLimitsPanel';
import { useAttendanceRequests } from '@/queries/attendanceRequests';
import { useAttendanceRequestSettings } from '@/queries/attendanceRequestSettings';

function RailStat({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-separator py-2.5 last:border-b-0 last:pb-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Time-away requests, and the limits that bound them — one admin page.
 *
 * Deciding a request and setting how many days may be asked for are the same job
 * done a minute apart, so they are two tabs rather than a tab buried in the
 * attendance report and a panel at the bottom of the admin's own profile, which is
 * where they used to live. Attendance keeps the reports; this page owns the
 * requests.
 *
 * Only the limits tab takes a side rail. The queue is a work surface — every pixel
 * of its width goes to the row you are deciding — while the limits are four numbers
 * that are read far more often than they are changed, and the questions they raise
 * ("who does this hit?", "where does it bite?") are worth answering beside them.
 */
export default function AdminAbsenceRequestsPage() {
  const [tab, setTab] = useState('queue');

  // Shares its query key with the queue's default fetch, so the two are one
  // request — this only exists so the tab can carry the count.
  const { data: requestData } = useAttendanceRequests({ status: 'pending' });
  const pendingCount = requestData?.pendingCount ?? 0;

  // Likewise one request with the limits panel's own fetch.
  const { data: settings } = useAttendanceRequestSettings();
  const customisedCount = settings?.types?.filter((entry) => !entry.isDefault).length ?? 0;

  // The line on the right of the tab band — what this tab is, in the fewest words
  // that still tell you whether it needs you.
  const bandNote =
    tab === 'limits'
      ? 'Applies to every hub'
      : tab === 'history'
        ? 'Every request already decided'
        : pendingCount > 0
          ? `${pendingCount} waiting on a decision`
          : 'Nothing waiting on a decision';

  return (
    <div className="app-page">
      <div className="app-page-content pb-0">
        <PageHeading
          crumb="Admin"
          title="Absence requests"
          subtitle="Decide time-away requests and set how many days interns can ask for."
        />

        <Tabs value={tab} onValueChange={setTab}>
          {/* Genuinely tabs, not a switcher: deciding a request and setting the
              limits are different jobs on different data, so the page becomes a
              different page. The band carries the closing hairline, so the strip
              itself drops its own — otherwise the line is drawn twice. */}
          <div className="-mx-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-separator bg-card px-6">
            <TabsList className="border-b-0" data-test="absence-requests-tabs">
              <TabsTrigger value="queue" data-test="absence-requests-tab-queue">
                Queue
                {/* The count is the whole point of surfacing it on the tab: a
                    request nobody notices goes stale on the day it was for. */}
                {pendingCount > 0 && <TabsCount>{pendingCount}</TabsCount>}
              </TabsTrigger>
              <TabsTrigger value="history" data-test="absence-requests-tab-history">
                History
              </TabsTrigger>
              <TabsTrigger value="limits" data-test="absence-requests-tab-limits">
                Request limits
              </TabsTrigger>
            </TabsList>

            <span className="my-2 text-[12.5px] text-muted-foreground">{bandNote}</span>
          </div>

          <div className="py-[18px]">
            <TabsContent value="queue">
              <AttendanceRequestQueue />
            </TabsContent>

            <TabsContent value="history">
              <AttendanceRequestQueue mode="history" />
            </TabsContent>

            <TabsContent value="limits">
              <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_19rem]">
                <AttendanceLimitsPanel />

                <div className="space-y-3.5">
                  <PagePanel className="px-4 py-4 md:px-5">
                    <h3 className="text-[13.5px] font-semibold">Who this affects</h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                      Every intern on the platform, from the next request they raise.
                    </p>
                    <div className="mt-3">
                      <RailStat label="Limits changed from default" value={customisedCount} />
                      <RailStat label="Waiting on a decision" value={pendingCount} />
                    </div>
                  </PagePanel>

                  <PagePanel className="px-4 py-4 md:px-5">
                    <h3 className="text-[13.5px] font-semibold">Where limits are enforced</h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                      Interns see the remaining allowance when they raise a request, and the request
                      form refuses anything over it. Requests already decided keep what they were
                      granted.
                    </p>
                  </PagePanel>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
