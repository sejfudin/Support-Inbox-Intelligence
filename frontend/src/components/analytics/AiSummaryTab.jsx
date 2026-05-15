import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export default function AiSummaryTab({ aiSummary, generateAiSummary, onGenerateAiSummary }) {
  return (
    <div className="app-panel px-5 py-5 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="app-kicker mb-3">AI Summary</div>
          <h2 className="text-2xl font-semibold tracking-tight">Generated Summary</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Generate a short personal summary from your recent assigned tickets.
          </p>
        </div>

        <Button onClick={onGenerateAiSummary} disabled={generateAiSummary.isPending}>
          <Sparkles className="h-4 w-4" />
          {generateAiSummary.isPending ? 'Generating...' : 'Generate Summary'}
        </Button>
      </div>

      {generateAiSummary.isError ? (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {generateAiSummary.error?.response?.data?.message ||
            generateAiSummary.error?.message ||
            'Failed to generate summary.'}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-border/70 bg-white/70 p-5">
        {aiSummary?.summary ? (
          <>
            <p className="text-sm leading-7 text-foreground">{aiSummary.summary}</p>
            {aiSummary.generatedAt ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Generated {new Date(aiSummary.generatedAt).toLocaleString()}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No AI summary generated yet for this session.
          </p>
        )}
      </div>
    </div>
  );
}
