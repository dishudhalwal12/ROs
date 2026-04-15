export interface ParsedCsvTable {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'] as const;

function readSampleLine(text: string) {
  return text.replace(/^\ufeff/, '').split(/\r?\n/, 1)[0] ?? '';
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && character === delimiter) {
      count += 1;
    }
  }

  return count;
}

function normalizeHeaders(rawHeaders: string[]) {
  const seen = new Map<string, number>();

  return rawHeaders.map((header, index) => {
    const baseLabel = header.trim() || `Column ${index + 1}`;
    const currentCount = seen.get(baseLabel) ?? 0;
    seen.set(baseLabel, currentCount + 1);

    if (currentCount === 0) {
      return baseLabel;
    }

    return `${baseLabel} ${currentCount + 1}`;
  });
}

export function detectCsvDelimiter(text: string) {
  const sampleLine = readSampleLine(text);

  const bestDelimiter =
    CANDIDATE_DELIMITERS.map((delimiter) => ({
      delimiter,
      score: countDelimiter(sampleLine, delimiter),
    })).sort((left, right) => right.score - left.score)[0] ?? { delimiter: ',', score: 0 };

  return bestDelimiter.score > 0 ? bestDelimiter.delimiter : ',';
}

export function parseCsvText(text: string): ParsedCsvTable {
  const normalizedText = text.replace(/^\ufeff/, '');
  const delimiter = detectCsvDelimiter(normalizedText);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;
  let touchedCharacter = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];

    if (insideQuotes) {
      if (character === '"') {
        if (normalizedText[index + 1] === '"') {
          currentCell += '"';
          index += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        currentCell += character;
      }
      touchedCharacter = true;
      continue;
    }

    if (character === '"') {
      insideQuotes = true;
      touchedCharacter = true;
      continue;
    }

    if (character === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      touchedCharacter = true;
      continue;
    }

    if (character === '\n' || character === '\r') {
      if (character === '\r' && normalizedText[index + 1] === '\n') {
        index += 1;
      }

      currentRow.push(currentCell.trim());
      if (touchedCharacter || currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      touchedCharacter = false;
      continue;
    }

    currentCell += character;
    touchedCharacter = true;
  }

  currentRow.push(currentCell.trim());
  if (touchedCharacter || currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return {
      headers: [],
      rows: [],
      delimiter,
    };
  }

  const normalizedHeaders = normalizeHeaders(rows[0]);
  const normalizedRows = rows.slice(1).map((row) =>
    Array.from({ length: normalizedHeaders.length }, (_, index) => row[index] ?? ''),
  );

  return {
    headers: normalizedHeaders,
    rows: normalizedRows,
    delimiter,
  };
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function stringifyCsvText(headers: string[], rows: string[][]) {
  const lines = [
    headers.map((header) => escapeCsvCell(header)).join(','),
    ...rows.map((row) =>
      headers
        .map((_, index) => escapeCsvCell(row[index] ?? ''))
        .join(','),
    ),
  ];

  return lines.join('\n');
}

export function normalizeSpreadsheetUrl(input: string) {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    throw new Error('Paste a spreadsheet link first.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedInput);
  } catch {
    throw new Error('Paste a valid spreadsheet or CSV link.');
  }

  if (parsedUrl.hostname.includes('docs.google.com') && parsedUrl.pathname.includes('/spreadsheets/d/')) {
    const match = parsedUrl.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = match?.[1];

    if (!spreadsheetId) {
      throw new Error('This Google Sheets link could not be read.');
    }

    const gid = parsedUrl.searchParams.get('gid');
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  }

  return parsedUrl.toString();
}
