import { useEffect, useRef } from 'react';
import { SendHorizontal } from 'lucide-react';

interface MessageComposerProps {
  draft: string;
  disabled?: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void | Promise<void>;
}

export function MessageComposer({
  draft,
  disabled = false,
  onDraftChange,
  onSend,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [draft]);

  return (
    <div className="message-composer">
      <textarea
        ref={textareaRef}
        rows={1}
        value={draft}
        disabled={disabled}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!draft.trim() || disabled) return;
            void onSend();
          }
        }}
        placeholder="Share an update, mention a teammate, or use @everyone to rally the whole channel."
      />
      <button
        type="button"
        className="primary-button message-composer__send"
        disabled={disabled || !draft.trim()}
        onClick={() => void onSend()}
      >
        <SendHorizontal size={16} />
        Send
      </button>
    </div>
  );
}
