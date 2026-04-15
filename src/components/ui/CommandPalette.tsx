import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useWorkspace } from '@/hooks/use-workspace';
import { SIDEBAR_NAV } from '@/lib/constants';
import { useUiStore } from '@/store/ui-store';

type CommandPaletteEntry = {
  id: string;
  type: 'page' | 'task' | 'client' | 'project' | 'member';
  title: string;
  subtitle: string;
  route: string;
};

function matchesQuery(title: string, subtitle: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const normalizedTitle = title.toLowerCase();
  const normalizedSubtitle = subtitle.toLowerCase();
  const combined = `${normalizedTitle} ${normalizedSubtitle}`;
  if (combined.includes(normalizedQuery)) return true;

  const titleWords = normalizedTitle.split(/[^a-z0-9]+/).filter(Boolean);
  const acronym = titleWords.map((word) => word[0]).join('');
  return acronym.startsWith(normalizedQuery);
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { searchItems } = useWorkspace();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const pageItems = useMemo<CommandPaletteEntry[]>(
    () =>
      SIDEBAR_NAV.map((entry) => ({
        id: entry.to,
        type: 'page',
        title: entry.label,
        subtitle: 'Jump to page',
        route: entry.to,
      })),
    [],
  );

  const items = useMemo<CommandPaletteEntry[]>(() => {
    const entityItems: CommandPaletteEntry[] = searchItems;

    if (!deferredQuery.trim()) {
      return [...pageItems, ...entityItems].slice(0, 14);
    }

    const matchedPages = pageItems.filter((item) =>
      matchesQuery(item.title, item.subtitle, deferredQuery),
    );

    const matchedEntities = entityItems.filter((item) =>
      matchesQuery(item.title, item.subtitle, deferredQuery),
    );

    return [...matchedPages, ...matchedEntities].slice(0, 14);
  }, [deferredQuery, pageItems, searchItems]);

  function selectTopResult() {
    const topResult = items[0];
    if (!topResult) return;

    setQuery('');
    navigate(topResult.route);
    setCommandPaletteOpen(false);
  }

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (commandPaletteOpen) {
        setQuery('');
      }
      setCommandPaletteOpen(!commandPaletteOpen);
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onClick={() => {
        setQuery('');
        setCommandPaletteOpen(false);
      }}
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
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              selectTopResult();
            }}
            placeholder="Search pages, tasks, clients, projects, members"
          />
        </div>
        <div className="command-palette__results">
          {items.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              className="command-palette__item"
              onClick={() => {
                setQuery('');
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
