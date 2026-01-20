// Regression utilities for trend analysis

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  predictedValues: number[];
  type: 'linear' | 'log-linear';
  validPointCount: number;
}

/**
 * Calculate linear regression: y = a + bx
 * Returns predicted values for ALL indices (0 to n-1), not just valid points
 */
export function linearRegression(
  yValues: (number | undefined | null)[],
  totalPoints: number
): RegressionResult | null {
  // Collect valid pairs with their original indices
  const validPairs: { x: number; y: number }[] = [];
  for (let i = 0; i < yValues.length; i++) {
    const y = yValues[i];
    if (typeof y === 'number' && !isNaN(y) && y !== null && y !== undefined) {
      validPairs.push({ x: i, y });
    }
  }

  if (validPairs.length < 3) return null;

  const n = validPairs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (const { x, y } of validPairs) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  const denominator = sumX2 - (sumX * sumX) / n;
  if (Math.abs(denominator) < 1e-10) return null;

  const slope = (sumXY - (sumX * sumY) / n) / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared
  let ssTot = 0, ssRes = 0;
  for (const { x, y } of validPairs) {
    const predicted = intercept + slope * x;
    ssTot += (y - meanY) ** 2;
    ssRes += (y - predicted) ** 2;
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Generate predicted values for ALL points (0 to totalPoints-1)
  const predictedValues: number[] = [];
  for (let i = 0; i < totalPoints; i++) {
    predictedValues.push(intercept + slope * i);
  }

  return { slope, intercept, rSquared, predictedValues, type: 'linear', validPointCount: n };
}

/**
 * Calculate log-linear (exponential) regression: y = a * e^(bx)
 * Linearized: ln(y) = ln(a) + bx
 */
export function logLinearRegression(
  yValues: (number | undefined | null)[],
  totalPoints: number
): RegressionResult | null {
  // Collect valid pairs (y > 0 for log)
  const validPairs: { x: number; y: number; lnY: number }[] = [];
  for (let i = 0; i < yValues.length; i++) {
    const y = yValues[i];
    if (typeof y === 'number' && !isNaN(y) && y > 0) {
      validPairs.push({ x: i, y, lnY: Math.log(y) });
    }
  }

  if (validPairs.length < 3) return null;

  const n = validPairs.length;
  let sumX = 0, sumLnY = 0, sumXLnY = 0, sumX2 = 0;

  for (const { x, lnY } of validPairs) {
    sumX += x;
    sumLnY += lnY;
    sumXLnY += x * lnY;
    sumX2 += x * x;
  }

  const meanX = sumX / n;
  const meanLnY = sumLnY / n;

  const denominator = sumX2 - (sumX * sumX) / n;
  if (Math.abs(denominator) < 1e-10) return null;

  const b = (sumXLnY - (sumX * sumLnY) / n) / denominator;
  const lnA = meanLnY - b * meanX;
  const a = Math.exp(lnA);

  // Calculate R-squared on original scale
  let ssTot = 0, ssRes = 0;
  const meanY = validPairs.reduce((sum, p) => sum + p.y, 0) / n;

  for (const { x, y } of validPairs) {
    const predicted = a * Math.exp(b * x);
    ssTot += (y - meanY) ** 2;
    ssRes += (y - predicted) ** 2;
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Generate predicted values for ALL points
  const predictedValues: number[] = [];
  for (let i = 0; i < totalPoints; i++) {
    predictedValues.push(a * Math.exp(b * i));
  }

  return { slope: b, intercept: a, rSquared, predictedValues, type: 'log-linear', validPointCount: n };
}

/**
 * Get the best regression fit (linear or log-linear) with R² >= threshold
 */
export function getBestRegression(
  yValues: (number | undefined | null)[],
  totalPoints: number,
  rSquaredThreshold: number = 0.5
): RegressionResult | null {
  const linear = linearRegression(yValues, totalPoints);
  const logLinear = logLinearRegression(yValues, totalPoints);

  // Filter by threshold
  const meetsThreshold = (r: RegressionResult | null) => r && r.rSquared >= rSquaredThreshold;

  // If both meet threshold, pick the one with higher R²
  if (meetsThreshold(logLinear) && meetsThreshold(linear)) {
    return logLinear!.rSquared >= linear!.rSquared ? logLinear : linear;
  }

  if (meetsThreshold(logLinear)) return logLinear;
  if (meetsThreshold(linear)) return linear;

  return null;
}

/**
 * Calculate regression for chart data series
 */
export function calculateSeriesRegression(
  chartData: Record<string, unknown>[],
  seriesKey: string,
  rSquaredThreshold: number = 0.5
): RegressionResult | null {
  const totalPoints = chartData.length;
  if (totalPoints < 3) return null;

  // Extract y values, preserving indices
  const yValues: (number | undefined | null)[] = chartData.map((point) => {
    const value = point[seriesKey];
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    return undefined;
  });

  return getBestRegression(yValues, totalPoints, rSquaredThreshold);
}
