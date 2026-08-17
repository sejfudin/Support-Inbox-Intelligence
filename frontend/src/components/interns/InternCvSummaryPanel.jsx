import { format } from 'date-fns';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInternCvSummary, useGenerateInternCvSummary } from '@/queries/interns';

/**
 * The CV the intern uploaded themselves, and an AI read of it.
 *
 * The file had no home on this profile at all before: the "CV / Résumé" panel
 * below is the *internal* CV — a Drive link an admin or mentor adds — and the
 * intern's own uploaded PDF was reachable only from their side of the app. So
 * this panel carries both the link to it and the summary, which is also the only
 * arrangement in which the summary is checkable: a reader who doubts a sentence
 * in it needs the document one click away, not on another screen.
 *
 * ── What the summary deliberately is not ─────────────────────────────────────
 *
 * It describes the document; it does not assess the person. The prompt
 * (`server/prompts/internCvPrompts.js`) forbids scoring, ranking and fit
 * judgements, and this panel is built to match: no chip, no score, no verdict —
 * prose, with the provenance line under it. The profile already carries three
 * assessments (readiness, evaluations, mentor notes) and every one of them was
 * written by someone who worked with this intern. A machine's opinion rendered
 * in the same visual language would be read as a fourth of equal standing.
 *
 * Generated on demand, never on page load: it costs a download, a text
 * extraction and a model call. The button is the consent, and the result is
 * cached server-side against the CV it read, so it is generated once per CV
 * rather than once per viewer.
 */
export function InternCvSummaryPanel({ userId, cvUrl }) {
  const { data, isPending, isError } = useInternCvSummary(userId);
  const generate = useGenerateInternCvSummary(userId);

  // `hasCv` comes off the summary payload rather than the link, because the
  // server is the one that knows whether a file is still on storage. With no CV
  // there is nothing to summarise, so the panel says so rather than showing a
  // button that can only fail.
  const cvOnFile = data?.hasCv ?? Boolean(cvUrl);
  const summary = data?.summary;
  const isStale = Boolean(data?.isStale);

  return (
    <section className="space-y-3" data-test="intern-cv-summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="app-card-title flex items-center gap-1.5">
            Uploaded CV
          </h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            The candidate’s own CV file, with an AI summary of what it says — a description of the
            document, not an assessment of them.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {cvUrl && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 text-[12.5px]"
              data-test="intern-cv-open"
            >
              <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open CV
              </a>
            </Button>
          )}
          {cvOnFile && (
            <Button
              type="button"
              size="sm"
              variant={summary ? 'outline' : 'default'}
              className="gap-1.5 text-[12.5px]"
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
              data-test="intern-cv-summary-generate"
            >
              <RefreshCw
                className={generate.isPending ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
                aria-hidden="true"
              />
              {generate.isPending ? 'Reading the CV…' : summary ? 'Regenerate' : 'Summarise CV'}
            </Button>
          )}
        </div>
      </div>

      {isPending ? (
        <p className="text-[12.5px] text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-[12.5px] text-[hsl(var(--tone-danger-fg))]">Could not load the CV summary.</p>
      ) : !cvOnFile ? (
        <p className="rounded-[var(--r-control)] border border-dashed border-border/70 px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          No CV uploaded yet — nothing to summarise.
        </p>
      ) : summary ? (
        <div className="space-y-2 rounded-[var(--r-control)] border border-separator bg-muted/20 px-4 py-3">
          {/* A summary written from a CV that has since been replaced still says
              something true about a document this intern submitted, so it stays
              readable — but it must not be mistaken for a read of the current
              file, which is what the badge and the regenerate button are for. */}
          {isStale && (
            <Badge variant="warning" className="text-[10.5px]">
              Describes an earlier CV
            </Badge>
          )}
          <p className="whitespace-pre-wrap text-[13px] leading-[1.6] text-foreground">{summary}</p>
          {data?.generatedAt && (
            <p className="text-[11.5px] text-muted-foreground/75">
              Generated {format(new Date(data.generatedAt), 'd MMM yyyy')} · AI-written from the CV
              text, may be incomplete
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-[var(--r-control)] border border-dashed border-border/70 px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          Not summarised yet.
        </p>
      )}
    </section>
  );
}
