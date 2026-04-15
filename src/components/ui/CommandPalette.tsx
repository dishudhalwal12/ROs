import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useWorkspace } from '@/hooks/use-workspace';
import { useUiStore } from '@/store/ui-store';

export function CommandPalette() {
  const navigate = useNavigate();
  const { searchItems } = useWorkspace();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const items = useMemo(() => {
    if (!deferredQuery) return searchItems.slice(0, 8);

    return searchItems
      .filter((item) => {
        const target = `${item.title} ${item.subtitle}`.toLowerCase();
        return target.includes(deferredQuery.toLowerCase());
      })
      .slice(0, 12);
  }, [deferredQuery, searchItems]);

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setCommandPaletteOpen(!commandPaletteOpen);
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [handleShortcut]);

  useEffect(() => {
    if (!commandPaletteOpen) {
      setQuery('');
    }
  }, [commandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="command-palette__search">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks, clients, projects, members"
          />
        </div>
        <div className="command-palette__results">
          {items.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              className="command-palette__item"
              onClick={() => {
                navigate(item.route);
                setCommandPaletteOpen(false);
              }}
            >
              <span>{item.title}</span>
              <small>{item.subtitle}</small>
            </button>
          ))}
          {items.length === 0 ? (
            <div className="command-palette__empty">No matches yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
