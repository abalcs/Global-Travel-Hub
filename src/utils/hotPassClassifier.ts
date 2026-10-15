/**
 * Hot Pass Classifier
 *
 * Tags each passthrough row with isHotPass by matching its tripRef to
 * Owner Change (OC) records.
 *
 * A passthrough is NOT a hot pass (i.e. queue-stopped) if:
 * - Its tripRef matches an OC group where any change involves "Opportunity"
 *
 * A passthrough IS a hot pass if:
 * - Its tripRef matches an OC group with no "Opportunity" involvement
 * - Its tripRef doesn't appear in OC at all (no queue stop detected)
 *
 * The OC "blank group" (trips without trip reference numbers) contains
 * additional queue-stopped trips that can't be matched to specific PT rows.
 * These are distributed among unmatched PT rows per agent so totals stay correct.
 */
import type { CrmRow, OwnerChangeRecord } from './excelParser';

/**
 * Tag each passthrough row's `isHotPass` field in place.
 *
 * After calling this, every row in `passthroughRows` will have
 * `isHotPass` set to `true` or `false`. Date filtering on the PT rows
 * will naturally preserve the per-row classification.
 */
export function tagHotPasses(
  passthroughRows: CrmRow[],
  ownerChanges: OwnerChangeRecord[],
): void {
  // ── Build OC lookup: agent → tripRecordName → isQueueStopped ──
  // Also track blank-group queue-stopped count per agent
  const agentTrips = new Map<string, Map<string, OwnerChangeRecord[]>>();

  for (const oc of ownerChanges) {
    if (!agentTrips.has(oc.agentName)) {
      agentTrips.set(oc.agentName, new Map());
    }
    const tripMap = agentTrips.get(oc.agentName)!;
    const key = oc.tripRecordName.trim() || '__blank__';
    if (!tripMap.has(key)) tripMap.set(key, []);
    tripMap.get(key)!.push(oc);
  }

  // Per-agent: set of queue-stopped trip names + blank-group count
  const queueStoppedNames = new Map<string, Set<string>>();
  const blankGroupCounts = new Map<string, number>();

  for (const [agent, tripMap] of agentTrips) {
    const stoppedSet = new Set<string>();
    let blankStopped = 0;

    for (const [key, changes] of tripMap) {
      if (key === '__blank__') {
        for (const c of changes) {
          if (c.newValue.toLowerCase().includes('opportunity')) {
            blankStopped++;
          }
        }
      } else {
        const hasQueue = changes.some(c =>
          c.oldValue.toLowerCase().includes('opportunity') ||
          c.newValue.toLowerCase().includes('opportunity'),
        );
        if (hasQueue) stoppedSet.add(key);
      }
    }

    queueStoppedNames.set(agent, stoppedSet);
    blankGroupCounts.set(agent, blankStopped);
  }

  // ── Tag each passthrough row ──
  // Group PT rows by agent so we can distribute blank-group counts
  const ptByAgent = new Map<string, CrmRow[]>();
  for (const row of passthroughRows) {
    if (!ptByAgent.has(row.agentName)) ptByAgent.set(row.agentName, []);
    ptByAgent.get(row.agentName)!.push(row);
  }

  for (const [agent, rows] of ptByAgent) {
    const stoppedSet = queueStoppedNames.get(agent);
    let blankRemaining = blankGroupCounts.get(agent) || 0;
    const unmatchedRows: CrmRow[] = [];

    for (const row of rows) {
      const ref = row.tripRef.trim();
      if (ref && stoppedSet?.has(ref)) {
        // Matched to a queue-stopped OC group
        row.isHotPass = false;
      } else if (ref && agentTrips.get(agent)?.has(ref)) {
        // Matched to an OC group that was NOT queue-stopped → hot pass
        row.isHotPass = true;
      } else {
        // No OC match — collect for blank-group distribution
        unmatchedRows.push(row);
      }
    }

    // Distribute blank-group queue-stopped count among unmatched rows.
    // Mark the first N unmatched rows as not-hot-pass, rest as hot pass.
    for (const row of unmatchedRows) {
      if (blankRemaining > 0) {
        row.isHotPass = false;
        blankRemaining--;
      } else {
        row.isHotPass = true;
      }
    }
  }

  // Any PT rows for agents not in OC at all → all hot passes
  for (const row of passthroughRows) {
    if (row.isHotPass === undefined) {
      row.isHotPass = true;
    }
  }
}
