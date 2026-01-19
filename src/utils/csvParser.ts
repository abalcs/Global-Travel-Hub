export interface CSVRow {
  [key: string]: string;
}

export const parseCSV = (content: string): CSVRow[] => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: CSVRow = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || '';
    });

    rows.push(row);
  }

  return rows;
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

export const findAgentColumn = (row: CSVRow): string | null => {
  const keys = Object.keys(row);

  // First priority: internal _agent field (from grouped report parsing)
  if (row['_agent'] !== undefined) {
    return '_agent';
  }

  // Second priority: look for GTT-specific or Salesforce columns
  for (const key of keys) {
    if (key.includes('gtt owner') || key.includes('owner name') || key.includes('last gtt action by')) {
      return key;
    }
  }

  // Third priority: exact matches
  const possibleNames = [
    'agent',
    'agent name',
    'agentname',
    'agent_name',
    'name',
    'rep',
    'representative',
    'sales rep',
    'salesrep',
    'employee',
    'user',
    'username',
  ];

  for (const name of possibleNames) {
    if (row[name] !== undefined) {
      return name;
    }
  }

  // Fourth priority: partial matches
  for (const key of keys) {
    if (key.includes('agent') || key.includes('owner') || key.includes('rep')) {
      return key;
    }
  }

  return keys[0] || null;
};

export const countByAgent = (
  rows: CSVRow[],
  agentColumn: string
): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const agent = row[agentColumn];
    if (agent) {
      counts.set(agent, (counts.get(agent) || 0) + 1);
    }
  }

  return counts;
};
