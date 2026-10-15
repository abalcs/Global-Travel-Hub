/**
 * Hot Pass Classifier
 *
 * Classifies each passthrough as HOT_PASS or QUEUE_STOPPED by examining
 * the owner change history for the trip. If any owner in the chain contains
 * "Opportunity" (the Salesforce queue name), the passthrough went through
 * the queue and is NOT a hot pass.
 */
import type { CrmRow, OwnerChangeRecord } from './excelParser';

export type TripClassification = 'HOT_PASS' | 'QUEUE_STOPPED' | 'FLAGGED';

export interface ClassifiedTrip {
  agentName: string;
  tripRecordName: string;
  tripRefNumber: string;
  classification: TripClassification;
  ownerChain: string[];
  flag?: string;
}

export interface HotPassResults {
  hotPassCounts: Map<string, number>;
  totalByAgent: Map<string, { hotPass: number; queueStopped: number; flagged: number; total: number }>;
  auditRows: ClassifiedTrip[];
}

/**
 * Classify passthroughs as hot passes vs queue-stopped based on owner change history.
 */
export function classifyHotPasses(
  passthroughRows: CrmRow[],
  ownerChanges: OwnerChangeRecord[],
): HotPassResults {
  // Build map: tripRecordName → OwnerChangeRecord[]
  const changesByTrip = new Map<string, OwnerChangeRecord[]>();
  for (const oc of ownerChanges) {
    const key = oc.tripRecordName.trim();
    if (!key) continue;
    const list = changesByTrip.get(key) || [];
    list.push(oc);
    changesByTrip.set(key, list);
  }

  const hotPassCounts = new Map<string, number>();
  const totalByAgent = new Map<string, { hotPass: number; queueStopped: number; flagged: number; total: number }>();
  const auditRows: ClassifiedTrip[] = [];

  for (const row of passthroughRows) {
    const agent = row.agentName;
    // Join on tripRef (numeric format like "2840205") which matches the owner
    // changes file. tripNumber ("Trip-XXXXXXX") is a different identifier system.
    const tripId = (row.tripRef || '').trim();

    // Ensure agent totals exist
    if (!totalByAgent.has(agent)) {
      totalByAgent.set(agent, { hotPass: 0, queueStopped: 0, flagged: 0, total: 0 });
    }
    const agentTotals = totalByAgent.get(agent)!;
    agentTotals.total++;

    // Look up owner changes for this trip
    const changes = tripId ? changesByTrip.get(tripId) : undefined;

    let classification: TripClassification;
    let ownerChain: string[] = [];
    let flag: string | undefined;

    if (changes && changes.length > 0) {
      // Has history — collect owner chain
      for (const c of changes) {
        if (c.oldValue && !ownerChain.includes(c.oldValue)) ownerChain.push(c.oldValue);
        if (c.newValue && !ownerChain.includes(c.newValue)) ownerChain.push(c.newValue);
      }

      // Check if any value in the chain contains "opportunity" (queue name)
      const hasQueueStop = ownerChain.some(v => v.toLowerCase().includes('opportunity'));
      classification = hasQueueStop ? 'QUEUE_STOPPED' : 'HOT_PASS';
    } else {
      // No history — classify as HOT_PASS (no evidence of queue stop)
      classification = 'HOT_PASS';
    }

    // Count hot passes
    if (classification === 'HOT_PASS') {
      hotPassCounts.set(agent, (hotPassCounts.get(agent) || 0) + 1);
      agentTotals.hotPass++;
    } else if (classification === 'QUEUE_STOPPED') {
      agentTotals.queueStopped++;
    } else {
      agentTotals.flagged++;
    }

    auditRows.push({
      agentName: agent,
      tripRecordName: tripId,
      tripRefNumber: row.tripRef || '',
      classification,
      ownerChain,
      flag,
    });
  }

  return { hotPassCounts, totalByAgent, auditRows };
}
