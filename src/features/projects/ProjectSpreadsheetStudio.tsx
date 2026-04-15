import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  BarChart3,
  Download,
  ExternalLink,
  Link2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { formatRelativeTime } from '@/lib/format';
import {
  normalizeSpreadsheetUrl,
  parseCsvText,
  stringifyCsvText,
  type ParsedCsvTable,
} from '@/lib/csv';

interface SpreadsheetDataset {
  headers: string[];
  rows: string[][];
  sourceType: 'blank' | 'file' | 'link';
  sourceLabel: string;
  sourceUrl?: string;
  importedAt: string;
  updatedAt: string;
}

interface ProjectSpreadsheetStudioProps {
  projectId: string;
  projectName: string;
}

const CHART_COLORS = ['#2f4bde', '#5f83ff', '#ef9b68', '#f3c86b', '#5bb59a', '#9174f8'];
const STORAGE_KEY_PREFIX = 'rovexa-project-sheet::';

function nowIso() {
  return new Date().toISOString();
}

function createStorageKey(projectId: string) {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function createBlankDataset(projectName: string): SpreadsheetDataset {
  const timestamp = nowIso();
  return {
    headers: ['Category', 'Owner', 'Metric', 'Status'],
    rows: [
      ['Campaign launch', 'Dishu', '42', 'Active'],
      ['Retention push', 'Lakshya', '16', 'Review'],
      ['Ops cleanup', 'Rovexa', '8', 'Queued'],
    ],
    sourceType: 'blank',
    sourceLabel: `${projectName} studio`,
    importedAt: timestamp,
    updatedAt: timestamp,
  };
}

function readStoredDataset(projectId: string) {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(createStorageKey(projectId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SpreadsheetDataset;
  } catch {
    return null;
  }
}

function parseNumericValue(value: string) {
  const cleaned = value.replaceAll(',', '').replace(/[^\d.-]/g, '');
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isNumericColumn(rows: string[][], columnIndex: number) {
  const numericSamples = rows
    .map((row) => parseNumericValue(row[columnIndex] ?? ''))
    .filter((value): value is number => value !== null);

  return numericSamples.length > 0;
}

function formatChartValue(value: number | string | ReadonlyArray<number | string> | undefined) {
  if (Array.isArray(value)) {
    return `${value[0] ?? 0}`;
  }

  return `${value ?? 0}`;
}

function toGoogleSheetsEditUrl(input?: string) {
  if (!input) return null;

  try {
    const parsed = new URL(input);

    if (!parsed.hostname.includes('docs.google.com')) {
      return null;
    }

    const docMatch = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (docMatch?.[1]) {
      const gid = parsed.searchParams.get('gid');
      return `https://docs.google.com/spreadsheets/d/${docMatch[1]}/edit${gid ? `?gid=${gid}` : ''}`;
    }

    const exportMatch = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/export/);
    if (exportMatch?.[1]) {
      const gid = parsed.searchParams.get('gid');
      return `https://docs.google.com/spreadsheets/d/${exportMatch[1]}/edit${gid ? `?gid=${gid}` : ''}`;
    }
  } catch {
    return null;
  }

  return null;
}

export function ProjectSpreadsheetStudio({
  projectId,
  projectName,
}: ProjectSpreadsheetStudioProps) {
  const [dataset, setDataset] = useState<SpreadsheetDataset | null>(() => readStoredDataset(projectId));
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [sheetZoom, setSheetZoom] = useState(100);
  const [selectedMetricIndex, setSelectedMetricIndex] = useState<number>(-1);
  const [selectedDimensionIndex, setSelectedDimensionIndex] = useState<number>(-1);
  const loadedProjectIdRef = useRef(projectId);

  function updateZoom(nextZoom: number) {
    const clamped = Math.min(160, Math.max(70, nextZoom));
    setSheetZoom(clamped);
  }

  const persistDataset = useCallback((nextDataset: SpreadsheetDataset | null) => {
    if (typeof window === 'undefined') return;

    const storageKey = createStorageKey(projectId);
    if (!nextDataset) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(nextDataset));
  }, [projectId]);

  function commitParsedDataset(
    parsed: ParsedCsvTable,
    sourceType: SpreadsheetDataset['sourceType'],
    sourceLabel: string,
    sourceUrl?: string,
  ) {
    if (parsed.headers.length === 0) {
      throw new Error('This sheet looks empty. Add headers to the first row and try again.');
    }

    const timestamp = nowIso();
    setDataset({
      headers: parsed.headers,
      rows: parsed.rows,
      sourceType,
      sourceLabel,
      sourceUrl,
      importedAt: timestamp,
      updatedAt: timestamp,
    });
    setImportModalOpen(false);
    setImportUrl('');
    setImportFile(null);
    setImportError(null);
  }

  function updateDataset(mutator: (current: SpreadsheetDataset) => SpreadsheetDataset) {
    setDataset((current) => {
      if (!current) return current;
      const nextDataset = mutator(current);
      return {
        ...nextDataset,
        updatedAt: nowIso(),
      };
    });
  }

  async function importFromUrl(urlInput: string, sourceType: 'link' = 'link') {
    setImportBusy(true);
    setImportError(null);

    try {
      const resolvedUrl = normalizeSpreadsheetUrl(urlInput);
      const response = await fetch(resolvedUrl);

      if (!response.ok) {
        throw new Error('This spreadsheet link could not be loaded. Try a public CSV link or upload the file directly.');
      }

      const parsed = parseCsvText(await response.text());
      commitParsedDataset(parsed, sourceType, urlInput.trim(), resolvedUrl);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : 'Unable to import this spreadsheet right now.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function importFromFile(file: File) {
    setImportBusy(true);
    setImportError(null);

    try {
      const parsed = parseCsvText(await file.text());
      commitParsedDataset(parsed, 'file', file.name);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Unable to read this CSV file.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  function downloadCsv() {
    if (!dataset) return;

    const csvText = stringifyCsvText(dataset.headers, dataset.rows);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-sheet.csv`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  useEffect(() => {
    loadedProjectIdRef.current = projectId;
    setDataset(readStoredDataset(projectId));
    setSearchValue('');
    setImportError(null);
    setImportFile(null);
    setImportUrl('');
  }, [projectId]);

  useEffect(() => {
    if (loadedProjectIdRef.current !== projectId) return;
    persistDataset(dataset);
  }, [dataset, persistDataset, projectId]);

  const numericColumnIndexes = useMemo(() => {
    if (!dataset) return [];
    return dataset.headers
      .map((_, index) => index)
      .filter((index) => isNumericColumn(dataset.rows, index));
  }, [dataset]);

  const dimensionColumnIndexes = useMemo(() => {
    if (!dataset) return [];
    const numericSet = new Set(numericColumnIndexes);
    const textualColumns = dataset.headers
      .map((_, index) => index)
      .filter((index) => !numericSet.has(index));

    return textualColumns.length > 0
      ? textualColumns
      : dataset.headers.map((_, index) => index);
  }, [dataset, numericColumnIndexes]);

  useEffect(() => {
    if (!dataset) {
      setSelectedMetricIndex(-1);
      setSelectedDimensionIndex(-1);
      return;
    }

    if (!numericColumnIndexes.includes(selectedMetricIndex)) {
      setSelectedMetricIndex(numericColumnIndexes[0] ?? -1);
    }

    if (!dimensionColumnIndexes.includes(selectedDimensionIndex)) {
      setSelectedDimensionIndex(
        dimensionColumnIndexes.find((index) => index !== (numericColumnIndexes[0] ?? -1)) ??
          dimensionColumnIndexes[0] ??
          -1,
      );
    }
  }, [
    dataset,
    dimensionColumnIndexes,
    numericColumnIndexes,
    selectedDimensionIndex,
    selectedMetricIndex,
  ]);

  const filteredRows = useMemo(() => {
    if (!dataset) return [];

    const query = searchValue.trim().toLowerCase();
    if (!query) return dataset.rows;

    return dataset.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(query)),
    );
  }, [dataset, searchValue]);

  const filledCells = useMemo(
    () =>
      dataset?.rows.reduce(
        (sum, row) => sum + row.filter((cell) => cell.trim().length > 0).length,
        0,
      ) ?? 0,
    [dataset],
  );

  const chartData = useMemo(() => {
    if (!dataset || selectedMetricIndex < 0 || selectedDimensionIndex < 0) {
      return [];
    }

    return filteredRows
      .map((row, index) => {
        const value = parseNumericValue(row[selectedMetricIndex] ?? '');
        if (value === null) return null;

        return {
          label: row[selectedDimensionIndex] || `Row ${index + 1}`,
          value,
        };
      })
      .filter((entry): entry is { label: string; value: number } => entry !== null)
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);
  }, [dataset, filteredRows, selectedDimensionIndex, selectedMetricIndex]);

  const pieData = useMemo(
    () =>
      chartData.slice(0, 5).map((entry) => ({
        name: entry.label,
        value: entry.value,
      })),
    [chartData],
  );

  const selectedMetricLabel =
    dataset && selectedMetricIndex >= 0 ? dataset.headers[selectedMetricIndex] : 'metric';

  const sheetStyle = useMemo(
    () =>
      ({
        '--sheet-zoom': sheetZoom / 100,
      }) as CSSProperties,
    [sheetZoom],
  );

  const googleSheetsEditUrl = useMemo(
    () => toGoogleSheetsEditUrl(dataset?.sourceLabel) ?? toGoogleSheetsEditUrl(dataset?.sourceUrl),
    [dataset?.sourceLabel, dataset?.sourceUrl],
  );

  return (
    <>
      {!dataset ? (
        <div className="sheet-studio sheet-studio--empty">
          <EmptyState
            icon={BarChart3}
            title="Turn this project into a live sheet studio"
            description="Paste a spreadsheet link, upload a CSV, or start a blank dataset to build a BI-style workspace right inside the project page."
          />
          <div className="sheet-studio__empty-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => setImportModalOpen(true)}
            >
              <Upload size={16} />
              Import spreadsheet
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDataset(createBlankDataset(projectName))}
            >
              <Plus size={16} />
              Start blank sheet
            </button>
          </div>
        </div>
      ) : (
        <div className="sheet-studio">
          <div className="sheet-studio__toolbar">
            <div className="sheet-studio__summary">
              <span className="eyebrow">Sheet Studio</span>
              <strong>{dataset.sourceLabel}</strong>
              <p>
                Saved inside this browser for <strong>{projectName}</strong> and last updated{' '}
                {formatRelativeTime(dataset.updatedAt)}.
              </p>
            </div>
            <div className="toggle-group">
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateZoom(sheetZoom - 10)}
                disabled={sheetZoom <= 70}
                title="Zoom out"
              >
                <Minus size={16} />
                Zoom out
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateZoom(100)}
                title="Reset zoom"
              >
                {sheetZoom}%
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateZoom(sheetZoom + 10)}
                disabled={sheetZoom >= 160}
                title="Zoom in"
              >
                <Plus size={16} />
                Zoom in
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setImportModalOpen(true)}
              >
                <Upload size={16} />
                Replace data
              </button>
              {googleSheetsEditUrl ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => window.open(googleSheetsEditUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink size={16} />
                  Open in Google Sheets
                </button>
              ) : null}
              {dataset.sourceType === 'link' && dataset.sourceUrl ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    if (!dataset.sourceUrl) return;
                    void importFromUrl(dataset.sourceUrl);
                  }}
                >
                  <RefreshCw size={16} />
                  Refresh link
                </button>
              ) : null}
              <button type="button" className="secondary-button" onClick={downloadCsv}>
                <Download size={16} />
                Export CSV
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  updateDataset((current) => ({
                    ...current,
                    headers: [...current.headers, `Column ${current.headers.length + 1}`],
                    rows: current.rows.map((row) => [...row, '']),
                  }))
                }
              >
                <Plus size={16} />
                Add column
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  updateDataset((current) => ({
                    ...current,
                    rows: [...current.rows, Array.from({ length: current.headers.length }, () => '')],
                  }))
                }
              >
                <Plus size={16} />
                Add row
              </button>
            </div>
          </div>

          <div className="stats-grid stats-grid--four">
            <article className="stat-card stat-card--blue">
              <div className="stat-card__meta">
                <strong>{dataset.rows.length}</strong>
                <span>Rows tracked</span>
              </div>
            </article>
            <article className="stat-card stat-card--violet">
              <div className="stat-card__meta">
                <strong>{dataset.headers.length}</strong>
                <span>Columns live</span>
              </div>
            </article>
            <article className="stat-card stat-card--mint">
              <div className="stat-card__meta">
                <strong>{numericColumnIndexes.length}</strong>
                <span>Numeric metrics</span>
              </div>
            </article>
            <article className="stat-card stat-card--gold">
              <div className="stat-card__meta">
                <strong>{filledCells}</strong>
                <span>Filled cells</span>
              </div>
            </article>
          </div>

          <div className="sheet-studio__controls">
            <label>
              <span>Dimension</span>
              <select
                value={selectedDimensionIndex}
                onChange={(event) => setSelectedDimensionIndex(Number(event.target.value))}
              >
                {dimensionColumnIndexes.map((index) => (
                  <option key={dataset.headers[index]} value={index}>
                    {dataset.headers[index]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Metric</span>
              <select
                value={selectedMetricIndex}
                onChange={(event) => setSelectedMetricIndex(Number(event.target.value))}
              >
                {numericColumnIndexes.length === 0 ? (
                  <option value={-1}>No numeric columns yet</option>
                ) : (
                  numericColumnIndexes.map((index) => (
                    <option key={dataset.headers[index]} value={index}>
                      {dataset.headers[index]}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="sheet-studio__search">
              <span>Search sheet</span>
              <div className="sheet-studio__search-input">
                <Search size={16} />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Filter rows, owners, metrics, status..."
                />
              </div>
            </label>
          </div>

          <div className="two-column-layout">
            <div className="sheet-panel">
              <div className="sheet-panel__header">
                <div>
                  <strong>Metric spotlight</strong>
                  <p>Top rows by {selectedMetricLabel}</p>
                </div>
                <Badge tone="info">{chartData.length} rows in chart</Badge>
              </div>
              {chartData.length === 0 ? (
                <div className="sheet-panel__empty">
                  Add at least one numeric column to unlock the project dashboard.
                </div>
              ) : (
                <div className="chart-panel">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(80, 61, 31, 0.12)" />
                      <XAxis dataKey="label" stroke="#6e6255" />
                      <YAxis stroke="#6e6255" />
                      <Tooltip formatter={(value) => [formatChartValue(value), selectedMetricLabel]} />
                      <Bar dataKey="value" fill="#2f4bde" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="sheet-panel">
              <div className="sheet-panel__header">
                <div>
                  <strong>Composition peek</strong>
                  <p>How your top values are split right now</p>
                </div>
                <Badge tone="neutral">{selectedMetricLabel}</Badge>
              </div>
              {pieData.length === 0 ? (
                <div className="sheet-panel__empty">
                  The pie view appears automatically once the sheet has numeric data.
                </div>
              ) : (
                <div className="chart-panel">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={64}
                        outerRadius={96}
                        paddingAngle={3}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatChartValue(value), selectedMetricLabel]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="sheet-table-shell" style={sheetStyle}>
            <table className="sheet-table">
              <thead>
                <tr>
                  <th>#</th>
                  {dataset.headers.map((header, columnIndex) => (
                    <th key={`${header}-${columnIndex}`}>
                      <input
                        type="text"
                        value={header}
                        onChange={(event) =>
                          updateDataset((current) => ({
                            ...current,
                            headers: current.headers.map((item, index) =>
                              index === columnIndex ? event.target.value : item,
                            ),
                          }))
                        }
                      />
                    </th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="sheet-table__empty" colSpan={dataset.headers.length + 2}>
                      No rows match that search yet.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, filteredRowIndex) => {
                    const actualRowIndex = dataset.rows.findIndex(
                      (datasetRow) => datasetRow === row,
                    );

                    return (
                      <tr key={`row-${actualRowIndex}`}>
                        <td>{actualRowIndex + 1}</td>
                        {dataset.headers.map((_, columnIndex) => (
                          <td key={`row-${actualRowIndex}-column-${columnIndex}`}>
                            <input
                              type="text"
                              value={row[columnIndex] ?? ''}
                              onChange={(event) =>
                                updateDataset((current) => ({
                                  ...current,
                                  rows: current.rows.map((currentRow, rowIndex) =>
                                    rowIndex === actualRowIndex
                                      ? currentRow.map((cell, index) =>
                                          index === columnIndex ? event.target.value : cell,
                                        )
                                      : currentRow,
                                  ),
                                }))
                              }
                            />
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              updateDataset((current) => ({
                                ...current,
                                rows: current.rows.filter((_, rowIndex) => rowIndex !== actualRowIndex),
                              }))
                            }
                            aria-label={`Delete row ${filteredRowIndex + 1}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        title="Import spreadsheet"
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        width="lg"
      >
        <div className="sheet-import-modal">
          <div className="sheet-import-modal__hero">
            <strong>Bring in a spreadsheet link or a CSV file</strong>
            <p>
              Public CSV links and Google Sheets links work best. If a link blocks browser access,
              download the CSV once and upload it here instead.
            </p>
          </div>

          {importError ? <div className="form-error">{importError}</div> : null}

          <label className="form-grid__wide">
            <span>Spreadsheet link</span>
            <div className="sheet-import-modal__row">
              <div className="sheet-studio__search-input">
                <Link2 size={16} />
                <input
                  type="url"
                  value={importUrl}
                  onChange={(event) => setImportUrl(event.target.value)}
                  placeholder="Paste a Google Sheets or CSV link"
                />
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={importBusy || !importUrl.trim()}
                onClick={() => void importFromUrl(importUrl)}
              >
                <Link2 size={16} />
                Open link
              </button>
            </div>
          </label>

          <label className="form-grid__wide">
            <span>CSV upload</span>
            <div className="sheet-import-modal__row">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="secondary-button"
                disabled={importBusy || !importFile}
                onClick={() => {
                  if (!importFile) return;
                  void importFromFile(importFile);
                }}
              >
                <Upload size={16} />
                Upload CSV
              </button>
            </div>
          </label>

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setImportModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
