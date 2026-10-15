/**
 * Hot Pass Classifier
 *
 * Counts queue-stopped trips per agent from the Owner Changes (hot pass audit) file.
 *
 * Each named trip group in the OC file is 1 trip. If any change involves
 * an "Opportunity" queue → queue-stopped.
 *
 * The blank group (trips without trip reference numbers) may contain multiple
 * trips. Each "→ Opportunity" transition represents a distinct queue-stopped trip.
 *
 * Hot passes = total passthroughs − queue-stopped trips.
 * Hot pass rate = hot passes / total passthroughs.
 */
import type { OwnerChangeRecord } from './excelParser';

export interface HotPassResults {
  /** Queue-stopped trip count per agent */
  queueStoppedCounts: Map<string, number>;
}

/**
 * Count queue-stopped trips from owner change records.
 *
 * Two sources:
 * 1. Named groups (non-empty tripRecordName): 1 trip per group, queue-stopped
 *    if any change has "Opportunity" in old/new value.
 * 2. Blank group (empty tripRecordName): each "→ Opportunity" transition
 *    (newValue contains "opportunity") = 1 additional queue-stopped trip.
 */
export function classifyHotPasses(
  ownerChanges: OwnerChangeRecord[],
): HotPassResults {
  // Group by agent → tripRecordName → changes
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

  const queueStoppedCounts = new Map<string, number>();

  for (const [agent, tripMap] of agentTrips) {
    let queueStopped = 0;

    for (const [key, changes] of tripMap) {
      if (key === '__blank__') {
        // Blank group: count each "→ Opportunity" transition as 1 queue-stopped trip
        for (const c of changes) {
          if (c.newValue.toLowerCase().includes('opportunity')) {
            queueStopped++;
          }
        }
      } else {
        // Named group: 1 trip, queue-stopped if any change has "Opportunity"
        const hasQueue = changes.some(c =>
          c.oldValue.toLowerCase().includes('opportunity') ||
          c.newValue.toLowerCase().includes('opportunity'),
        );
        if (hasQueue) queueStopped++;
      }
    }

    queueStoppedCounts.set(agent, queueStopped);
  }

  return { queueStoppedCounts };
}
