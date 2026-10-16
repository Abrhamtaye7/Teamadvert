type Props = {
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  children?: React.ReactNode;
  saveLabel?: string;
};

export default function RecordingWizard({ title = "New Record", isOpen, onClose, onSave, children, saveLabel = "Save" }: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[95%] max-w-4xl rounded bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto">{children}</div>

        <div className="mt-3 flex justify-end gap-2">
          <button className="btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="btn bg-primary text-white"
            onClick={() => {
              onSave?.();
            }}
            type="button"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
