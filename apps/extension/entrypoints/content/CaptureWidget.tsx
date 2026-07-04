import { useRef, useState } from 'react';
import type { Source } from '@memoris/shared';
import { uuid } from '../../lib/uuid.js';
import { Popover } from './Popover.js';

export interface CaptureWidgetProps {
  selection: string;
  context?: string;
  source: Source;
  rect: { top: number; left: number; bottom: number; right: number };
  onClose: () => void;
}

/**
 * On a text selection we show a small Memoris icon (like Google Translate). Only when the user
 * clicks it do we open the popover and call the gateway — so we never burn an AI lookup on a
 * selection the user just wanted to copy.
 */
export function CaptureWidget({ selection, context, source, rect, onClose }: CaptureWidgetProps) {
  const [opened, setOpened] = useState(false);
  const captureId = useRef(uuid()).current;

  if (opened) {
    return (
      <Popover
        captureId={captureId}
        selection={selection}
        context={context}
        source={source}
        rect={rect}
        onClose={onClose}
      />
    );
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(rect.bottom + 6, window.innerHeight - 36),
    left: Math.min(rect.right + 6, window.innerWidth - 40),
    zIndex: 2147483647,
  };
  return (
    <button
      style={style}
      onClick={() => setOpened(true)}
      title="Translate & remember with Memoris"
      className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-lg ring-2 ring-white hover:bg-indigo-500"
    >
      M
    </button>
  );
}
