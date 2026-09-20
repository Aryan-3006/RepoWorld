import { Check, LoaderCircle } from 'lucide-react';
import type { AnalysisStage } from '@/types/repository';

export function AnalysisProgress({ stages }: { stages: AnalysisStage[] }) {
  return (
    <div className="mt-12 border-l border-border pl-6">
      {stages.map((stage, index) => (
        <div key={stage.id} className="relative pb-7 last:pb-0">
          <span className={`absolute -left-[31px] top-0 flex h-[13px] w-[13px] items-center justify-center rounded-full border ${stage.status === 'complete' ? 'border-primary bg-primary text-background' : stage.status === 'active' ? 'border-primary bg-background text-primary' : 'border-border bg-background text-muted-foreground'}`}>
            {stage.status === 'complete' ? <Check className="h-2.5 w-2.5" /> : stage.status === 'active' ? <LoaderCircle className="h-2.5 w-2.5 animate-spin" /> : <span className="h-1 w-1 rounded-full bg-muted-foreground" />}
          </span>
          <div className="flex items-baseline justify-between gap-4">
            <p className={`text-sm ${stage.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>{stage.label}</p>
            <span className="mono text-[9px] uppercase tracking-wider text-muted-foreground">{stage.status === 'complete' ? 'done' : stage.status === 'active' ? 'running' : 'queued'}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{stage.detail}</p>
          {index < stages.length - 1 && <div className="absolute bottom-1 left-[-25px] h-6 border-l border-dashed border-border" />}
        </div>
      ))}
    </div>
  );
}