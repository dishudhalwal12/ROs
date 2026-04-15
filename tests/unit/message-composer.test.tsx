import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { MessageComposer } from '@/features/messages/MessageComposer';

describe('MessageComposer', () => {
  it('sends on Enter when there is a draft', () => {
    const onSend = vi.fn();
    render(
      <MessageComposer
        draft="Need the new tracker polish"
        onDraftChange={() => undefined}
        onSend={onSend}
      />,
    );

    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      code: 'Enter',
    });

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn();
    render(
      <MessageComposer draft="Line one" onDraftChange={() => undefined} onSend={onSend} />,
    );

    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      code: 'Enter',
      shiftKey: true,
    });

    expect(onSend).not.toHaveBeenCalled();
  });
});
