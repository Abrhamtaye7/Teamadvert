import type { ReactNode } from "react";

type Step = {
  title: string;
  content: ReactNode;
  isValid: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  steps: Step[];
  current: number;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
};

export function WizardModal({ open, onClose, steps, current, onPrev, onNext, onSave }: Props) {
  if (!open) return null;
  const step = steps[current];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-primary">Step {current + 1} of {steps.length}</p>
            <h3 className="text-xl font-semibold">{step.title}</h3>
          </div>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
        </div>
        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">{step.content}</div>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-2">
            {steps.map((_, idx) => (
              <div key={idx} className={`h-2 w-8 rounded-full ${idx === current ? "bg-primary" : "bg-slate-200"}`}></div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onPrev} disabled={current === 0} className="btn bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Back</button>
            {current < steps.length - 1 && (
              <button onClick={onNext} disabled={!step.isValid} className="btn disabled:opacity-50">Next</button>
            )}
            {current === steps.length - 1 && (
              <button onClick={onSave} disabled={!step.isValid} className="btn disabled:opacity-50">
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
