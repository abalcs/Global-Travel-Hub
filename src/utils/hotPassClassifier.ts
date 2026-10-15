/**
 * Hot Pass Classifier
 *
 * Tags each passthrough row with isHotPass by matching its tripRef to
 * Owner Change (OC) records.
 *
 * Classification:
 * - tripRef matches a queue-stopped OC group → NOT hot pass
 * - tripRef matches a non-queue-stopped OC group → IS hot pass
 * - No OC match, within blank-group QS date range → proportional distribution
 * - No OC match, outside that range → hot pass (no queue-stop data)
 *
 * The OC "blank group" queue-stopped trips are distributed proportionally
 * among unmatched PT rows BY DATE so daily/weekly filters show correct rates.
 */
import type { CrmRow, OwnerChangeRecord } from './excelParser';
import { formatDateString } from './dateParser';

/**
 * Tag each passthrough row's `isHotPass` field in place.
 */
export function tagHotPasses(
  passthroughRows: CrmRow[],
  ownerChanges: OwnerChangeRecord[],
): void {
  // ── Build OC lookup: agent → tripRecordName → changes ──
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

  // Per-agent: queue-stopped trip names, blank-group count, and
  // the date range of blank-group "→ Opportunity" transitions
  const queueStoppedNames = new Map<string, Set<string>>();
  const blankGroupCounts = new Map<string, number>();
  const blankQSStartDate = new Map<string, string>(); // agent → YYYY-MM-DD

  for (const [agent, tripMap] of agentTrips) {
    const stoppedSet = new Set<string>();
    let blankStopped = 0;

    for (const [key, changes] of tripMap) {
      if (key === '__blank__') {
        for (const c of changes) {
          if (c.newValue.toLowerCase().includes('opportunity')) {
            blankStopped++;
            // Track the date range of blank QS transitions
            const d = formatDateString(c.editDate);
            if (d) {
              const cur = blankQSStartDate.get(agent);
              if (!cur || d < cur) blankQSStartDate.set(agent, d);
            }
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
  const ptByAgent = new Map<string, CrmRow[]>();
  for (const row of passthroughRows) {
    if (!ptByAgent.has(row.agentName)) ptByAgent.set(row.agentName, []);
    ptByAgent.get(row.agentName)!.push(row);
  }

  for (const [agent, rows] of ptByAgent) {
    const stoppedSet = queueStoppedNames.get(agent);
    const blankCount = blankGroupCounts.get(agent) || 0;
    const periodStart = blankQSStartDate.get(agent) || '';

    // Phase 1: tag definitively matched rows, collect unmatched
    const unmatchedInPeriod: CrmRow[] = [];

    for (const row of rows) {
      const ref = row.tripRef.trim();
      if (ref && stoppedSet?.has(ref)) {
        row.isHotPass = false;
      } else if (ref && agentTrips.get(agent)?.has(ref)) {
        row.isHotPass = true;
      } else {
        // No OC match — check if within blank-group QS date range
        const ptDate = formatDateString(row.passthroughDate);
        if (ptDate && periodStart && ptDate >= periodStart) {
          unmatchedInPeriod.push(row);
        } else {
          // Before blank QS period → no queue-stop data → hot pass
          row.isHotPass = true;
        }
      }
    }

    // Phase 2: distribute blank-group QS among in-period unmatched rows
    // Group by date and distribute proportionally per date
    if (blankCount === 0 || unmatchedInPeriod.length === 0) {
      for (const row of unmatchedInPeriod) row.isHotPass = true;
    } else if (blankCount >= unmatchedInPeriod.length) {
      for (const row of unmatchedInPeriod) row.isHotPass = false;
    } else {
      // Distribute QS proportionally using error accumulation (Bresenham-style)
      // so any date subset gets the correct proportion without rounding bias.
      // Sort by date so rows on the same day cluster together.
      unmatchedInPeriod.sort((a, b) => {
        const da = formatDateString(a.passthroughDate) || '';
        const db = formatDateString(b.passthroughDate) || '';
        return da.localeCompare(db);
      });

      const qsRate = blankCount / unmatchedInPeriod.length;
      let accumulated = 0;
      let qsAssigned = 0;

      for (const row of unmatchedInPeriod) {
        accumulated += qsRate;
        if (accumulated >= 0.5 && qsAssigned < blankCount) {
          row.isHotPass = false;
          accumulated -= 1;
          qsAssigned++;
        } else {
          row.isHotPass = true;
        }
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
