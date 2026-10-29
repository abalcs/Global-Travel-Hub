/**
 * Hot Pass Classifier
 *
 * Tags each passthrough row with isHotPass by matching its tripRef to
 * Owner Change (OC) records.
 *
 * Classification:
 * - tripRef matches a queue-stopped OC group → NOT hot pass
 * - tripRef matches a non-queue-stopped OC group → IS hot pass
 * - No tripRef match → match PT owner name against blank-group queue-exit
 *   records ("Opportunity → Person"). If matched → NOT hot pass.
 * - No match at all, within OC period → hot pass
 * - Before OC period → hot pass (no queue-stop data available)
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

  // Per-agent: queue-stopped trip names, blank-group queue-exit recipients,
  // and the earliest date of blank-group queue activity
  const queueStoppedNames = new Map<string, Set<string>>();
  const blankQSRecipients = new Map<string, Map<string, number>>(); // agent → name → count
  const blankQSStartDate = new Map<string, string>(); // agent → YYYY-MM-DD

  for (const [agent, tripMap] of agentTrips) {
    const stoppedSet = new Set<string>();
    const recipients = new Map<string, number>();

    for (const [key, changes] of tripMap) {
      if (key === '__blank__') {
        for (const c of changes) {
          // Queue EXIT: "Opportunity → Person" — tells us who received the trip
          if (c.oldValue.toLowerCase().includes('opportunity') &&
              !c.newValue.toLowerCase().includes('opportunity')) {
            const recipient = c.newValue.trim();
            if (recipient) {
              recipients.set(recipient, (recipients.get(recipient) || 0) + 1);
            }
          }
          // Track the date range of any blank-group queue activity
          if (c.oldValue.toLowerCase().includes('opportunity') ||
              c.newValue.toLowerCase().includes('opportunity')) {
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
    blankQSRecipients.set(agent, recipients);
  }

  // ── Tag each passthrough row ──
  const ptByAgent = new Map<string, CrmRow[]>();
  for (const row of passthroughRows) {
    if (!ptByAgent.has(row.agentName)) ptByAgent.set(row.agentName, []);
    ptByAgent.get(row.agentName)!.push(row);
  }

  for (const [agent, rows] of ptByAgent) {
    const stoppedSet = queueStoppedNames.get(agent);
    const recipients = blankQSRecipients.get(agent) || new Map<string, number>();
    const periodStart = blankQSStartDate.get(agent) || '';

    // Clone the recipients map so we can decrement counts as we match
    const remainingRecipients = new Map(recipients);

    for (const row of rows) {
      const ref = row.tripRef.trim();

      if (ref && stoppedSet?.has(ref)) {
        // Named trip matched to a queue-stopped OC group
        row.isHotPass = false;
      } else if (ref && agentTrips.get(agent)?.has(ref)) {
        // Named trip matched to a non-queue-stopped OC group
        row.isHotPass = true;
      } else {
        // No tripRef match — try owner-name matching against queue exits
        const ptDate = formatDateString(row.passthroughDate);
        if (ptDate && periodStart && ptDate >= periodStart) {
          // Within OC period: match by owner name
          const owner = (row.owner || '').trim();
          const count = owner ? (remainingRecipients.get(owner) || 0) : 0;
          if (count > 0) {
            row.isHotPass = false;
            remainingRecipients.set(owner, count - 1);
          } else {
            row.isHotPass = true;
          }
        } else {
          // Before OC period → no queue-stop data → hot pass
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
