/**
 * Largest-Triangle-Three-Buckets (LTTB) algorithm for data decimation
 * Reduces data points while preserving visual appearance
 * Based on: https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf
 */

interface DataPoint {
  date: string;
  [key: string]: unknown;
}

/**
 * LTTB decimation for chart data
 * @param data Array of data points with date and numeric values
 * @param targetPoints Target number of points to reduce to
 * @returns Decimated array preserving visual shape
 */
export function decimateChartData(
  data: DataPoint[],
  targetPoints: number
): DataPoint[] {
  const dataLength = data.length;

  // If data is small enough, return as-is
  if (dataLength <= targetPoints || targetPoints < 3) {
    return data;
  }

  const sampled: DataPoint[] = [];

  // Always include first point
  sampled.push(data[0]);

  // Bucket size (excluding first and last points)
  const bucketSize = (dataLength - 2) / (targetPoints - 2);

  let a = 0; // Index of previous selected point

  for (let i = 0; i < targetPoints - 2; i++) {
    // Calculate bucket boundaries
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.floor((i + 2) * bucketSize) + 1;
    const actualBucketEnd = Math.min(bucketEnd, dataLength - 1);

    // Calculate average point in next bucket (for triangle area calculation)
    const nextBucketStart = Math.floor((i + 2) * bucketSize) + 1;
    const nextBucketEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, dataLength);

    let avgX = 0;
    let avgY = 0;
    let avgCount = 0;

    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgX += j;
      // Use first numeric value found for Y calculation
      const yVal = getFirstNumericValue(data[j]);
      if (yVal !== null) {
        avgY += yVal;
        avgCount++;
      }
    }

    if (avgCount > 0) {
      avgX /= avgCount;
      avgY /= avgCount;
    }

    // Find point in current bucket with largest triangle area
    let maxArea = -1;
    let maxAreaIndex = bucketStart;

    const pointAX = a;
    const pointAY = getFirstNumericValue(data[a]) ?? 0;

    for (let j = bucketStart; j < actualBucketEnd; j++) {
      const pointBY = getFirstNumericValue(data[j]);
      if (pointBY === null) continue;

      // Calculate triangle area using cross product
      const area = Math.abs(
        (pointAX - avgX) * (pointBY - pointAY) -
        (pointAX - j) * (avgY - pointAY)
      );

      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = j;
      }
    }

    sampled.push(data[maxAreaIndex]);
    a = maxAreaIndex;
  }

  // Always include last point
  sampled.push(data[dataLength - 1]);

  return sampled;
}

/**
 * Get the first numeric value from a data point (excluding 'date')
 */
function getFirstNumericValue(point: DataPoint): number | null {
  for (const key of Object.keys(point)) {
    if (key === 'date') continue;
    const val = point[key];
    if (typeof val === 'number' && !isNaN(val)) {
      return val;
    }
  }
  return null;
}

/**
 * Simple uniform sampling as fallback
 */
export function uniformSample<T>(data: T[], targetPoints: number): T[] {
  if (data.length <= targetPoints) return data;

  const result: T[] = [];
  const step = (data.length - 1) / (targetPoints - 1);

  for (let i = 0; i < targetPoints; i++) {
    const index = Math.round(i * step);
    result.push(data[index]);
  }

  return result;
}
