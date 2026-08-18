import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

/**
 * The mockup's "Performance summary" tab: a copy block with the generate action
 * on its right, then the summary itself — a dashed empty slot until one exists.
 */
export default function AiSummaryTab({ aiSummary, generateAiSummary, onGenerateAiSummary }) {
  return (
    <section className="app-card px-[18px] pb-[18px] pt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-5">
        <div className="max-w-[520px]">
          <h2 className="text-[14px] font-semibold leading-tight text-foreground">
            Generated summary
          </h2>
          <p className="mt-[3px] text-pretty text-[12.5px] leading-[1.5] text-muted-foreground">
            A short written summary of your recent assigned tickets, cycle time and delivery pace.
          </p>
        </div>

        <Button
          onClick={onGenerateAiSummary}
          disabled={generateAiSummary.isPending}
          className="flex-none"
          data-test="analytics-ai-generate-button"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {generateAiSummary.isPending ? 'Generating…' : 'Generate summary'}
        </Button>
      </div>

      {generateAiSummary.isError ? (
        <div className="mt-3.5 rounded-[var(--r-tile)] border border-destructive/20 bg-destructive/10 px-4 py-3 text-[12.5px] text-[hsl(var(--tone-danger-fg))]">
          {generateAiSummary.error?.response?.data?.message ||
            generateAiSummary.error?.message ||
            'Failed to generate summary.'}
        </div>
      ) : null}

      {aiSummary?.summary ? (
        <div className="mt-3.5 rounded-[var(--r-tile)] border border-separator px-[18px] py-4">
          <p className="text-[12.5px] leading-[1.6] text-foreground">{aiSummary.summary}</p>
          {aiSummary.generatedAt ? (
            <p className="mt-3 text-[11px] text-muted-foreground/75">
              Generated {new Date(aiSummary.generatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3.5 rounded-[var(--r-tile)] border border-dashed border-border px-[18px] py-[34px] text-center text-[12.5px] text-muted-foreground/75">
          Nothing generated yet — use Generate summary above, and it will appear here.
        </div>
      )}
    </section>
  );
}
