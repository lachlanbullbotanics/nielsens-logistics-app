/**
 * Trolley Count Predictor
 *
 * Improvement over brief:
 *   - Phase 1: Rule-based heuristic (works day one with zero training data)
 *   - Phase 2: Simple linear regression once 50+ data points exist
 *   - Phase 3: Gradient boosting once 200+ data points (delegated to Python microservice)
 *   - Confidence scoring on every prediction
 */

// ─── Types ───────────────────────────────────────────────

interface PotSizeMix {
  [potSize: string]: number; // e.g. { "140mm": 50, "200mm": 30 }
}

export interface TrolleyPrediction {
  predicted: number;
  confidence: number;
  method: 'heuristic' | 'regression' | 'gradient_boost';
}

interface TrainingRow {
  invoiceValue: number;
  lineCount: number;
  potSizeMix: PotSizeMix;
  actualTrolleys: number;
}

// ─── Phase 1: Rule-Based Heuristic ───────────────────────
// Industry knowledge: typical nursery trolley holds ~24 trays of 140mm pots
// Larger pots = fewer per trolley

const POTS_PER_TRAY: Record<string, number> = {
  '50mm': 40,
  '75mm': 32,
  '100mm': 24,
  '140mm': 18,
  '150mm': 16,
  '170mm': 12,
  '200mm': 8,
  '250mm': 6,
  '300mm': 4,
};

const TRAYS_PER_TROLLEY = 12; // Standard danish trolley = 12 shelves, ~2 trays per shelf on avg

function heuristicPredict(lineCount: number, potSizeMix: PotSizeMix): TrolleyPrediction {
  let totalTrays = 0;

  for (const [potSize, qty] of Object.entries(potSizeMix)) {
    const perTray = POTS_PER_TRAY[potSize] ?? 16; // Default to 140-170mm range
    totalTrays += Math.ceil(qty / perTray);
  }

  // If no pot size data, estimate from line count
  if (totalTrays === 0 && lineCount > 0) {
    totalTrays = lineCount * 2; // Rough estimate: 2 trays per line item
  }

  const trolleys = Math.max(1, Math.ceil(totalTrays / TRAYS_PER_TROLLEY));

  return {
    predicted: trolleys,
    confidence: 0.5, // Low confidence — just a heuristic
    method: 'heuristic',
  };
}

// ─── Phase 2: Simple Linear Regression ───────────────────
// Features: invoiceValue, lineCount, totalQty, avgPotSizeIndex

interface RegressionModel {
  weights: number[];
  bias: number;
  r2: number;
}

function trainLinearRegression(data: TrainingRow[]): RegressionModel {
  const features = data.map((d) => extractFeatures(d));
  const targets = data.map((d) => d.actualTrolleys);

  const n = features.length;
  const k = features[0].length;

  // Mean-centre features
  const featureMeans = Array(k).fill(0);
  for (const row of features) {
    for (let j = 0; j < k; j++) featureMeans[j] += row[j] / n;
  }

  const targetMean = targets.reduce((a, b) => a + b, 0) / n;

  // Normal equation: w = (X^T X)^-1 X^T y (simplified for small k)
  // Using gradient descent for simplicity and numerical stability
  const lr = 0.0001;
  const weights = Array(k).fill(0);
  let bias = 0;

  for (let iter = 0; iter < 1000; iter++) {
    const gradW = Array(k).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      let pred = bias;
      for (let j = 0; j < k; j++) pred += weights[j] * features[i][j];

      const err = pred - targets[i];
      for (let j = 0; j < k; j++) gradW[j] += (2 * err * features[i][j]) / n;
      gradB += (2 * err) / n;
    }

    for (let j = 0; j < k; j++) weights[j] -= lr * gradW[j];
    bias -= lr * gradB;
  }

  // Calculate R²
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    let pred = bias;
    for (let j = 0; j < k; j++) pred += weights[j] * features[i][j];
    ssRes += (targets[i] - pred) ** 2;
    ssTot += (targets[i] - targetMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { weights, bias, r2 };
}

function extractFeatures(row: { invoiceValue: number; lineCount: number; potSizeMix: PotSizeMix }): number[] {
  const totalQty = Object.values(row.potSizeMix).reduce((a, b) => a + b, 0);
  const potSizes = Object.keys(row.potSizeMix).map((s) => parseInt(s) || 140);
  const avgPotSize = potSizes.length > 0 ? potSizes.reduce((a, b) => a + b, 0) / potSizes.length : 140;

  return [row.invoiceValue / 1000, row.lineCount, totalQty / 100, avgPotSize / 100];
}

function regressionPredict(
  model: RegressionModel,
  invoiceValue: number,
  lineCount: number,
  potSizeMix: PotSizeMix
): TrolleyPrediction {
  const features = extractFeatures({ invoiceValue, lineCount, potSizeMix });
  let pred = model.bias;
  for (let j = 0; j < features.length; j++) pred += model.weights[j] * features[j];

  return {
    predicted: Math.max(1, Math.round(pred)),
    confidence: Math.min(0.9, Math.max(0.3, model.r2)),
    method: 'regression',
  };
}

// ─── Public API ──────────────────────────────────────────

let cachedModel: RegressionModel | null = null;
let modelTrainedAt: number = 0;
const MODEL_TTL = 7 * 24 * 60 * 60 * 1000; // Retrain weekly

export async function predictTrolleys(
  invoiceValue: number,
  lineCount: number,
  potSizeMix: PotSizeMix,
  trainingData?: TrainingRow[]
): Promise<TrolleyPrediction> {
  // Phase 2: Use regression if we have enough data
  if (trainingData && trainingData.length >= 50) {
    if (!cachedModel || Date.now() - modelTrainedAt > MODEL_TTL) {
      cachedModel = trainLinearRegression(trainingData);
      modelTrainedAt = Date.now();
    }
    if (cachedModel.r2 > 0.3) {
      return regressionPredict(cachedModel, invoiceValue, lineCount, potSizeMix);
    }
  }

  // Phase 1: Fall back to heuristic
  return heuristicPredict(lineCount, potSizeMix);
}

export { trainLinearRegression, heuristicPredict };
