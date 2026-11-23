// Swing bot for make.fun btc-race-24h-20261123-0511: trades CBBTC/USDC minute by
// minute in the agent-fun/bars-replay/v1 replay.
//
// Idea: ride BTC's intraday swings with a small set of fixed rules, all in
// integer (BigInt) arithmetic so two runs are byte-identical.
//   - Buy all-in on the first tradeable bar.
//   - While long, sell everything at +1.5% over the entry cost, or at -2.5%
//     (stop-loss). The entry cost is the position's cost per unit, read from
//     the account the harness sends each batch.
//   - While flat after a take-profit exit, buy all-in again on a 1.0%
//     pullback from the highest close seen since the exit, but only while the
//     close is at or above its 60-bar exponential moving average (no buying
//     into a downtrend).
//   - While flat after a stop-loss exit, demand a real bounce: the close must
//     be 1.5% above the lowest close seen since the exit, and at or above the
//     60-bar EMA, before buying again.
//   - A buy spends all cash; a sell empties the position. Orders name a
//     200 bps max slippage so a one-minute gap cannot fill us far from the
//     close we decided on. Nothing is ever read from the wall clock, the
//     environment or any randomness: the only inputs are the bars.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Rule parameters, in basis points.
const TAKE_PROFIT_BPS = 150n; // +1.5% over entry cost
const STOP_LOSS_BPS = 250n; // -2.5% under entry cost
const PULLBACK_BPS = 100n; // 1.0% below the post-exit peak
const BOUNCE_BPS = 150n; // 1.5% above the post-exit low (after a stop)
const EMA_BARS = 60n; // trend filter length
const MAX_SLIPPAGE_BPS = 200; // 2.0% from the decision close
const BPS = 10_000n;
const EMA_SCALE = 1_000_000n; // fixed-point scale for the EMA

type ExitKind = 'tp' | 'sl';

// --- strategy state (module scope so it survives across batches) ----------
let started = false;
let exitKind: ExitKind = 'tp';
let peakSinceExit: bigint | null = null;
let lowSinceExit: bigint | null = null;
let emaScaled: bigint | null = null; // EMA of closes, times EMA_SCALE

await runBars({
  onBatch(state: BarsState, _batch: Batch): OrderInput[] {
    if (state.warmingUp) return [];
    const bar = state.latest.get(SYMBOL);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);
    return decide(state, close);
  },
});

function decide(state: BarsState, close: bigint): OrderInput[] {
  // Trend filter: EMA of closes, seeded on the first close seen.
  if (emaScaled === null) {
    emaScaled = close * EMA_SCALE;
  } else {
    emaScaled = (2n * close * EMA_SCALE + (EMA_BARS - 1n) * emaScaled) / (EMA_BARS + 1n);
  }
  const aboveEma = close * EMA_SCALE >= emaScaled;

  const held = state.positions.get(SYMBOL)?.qty ?? 0n;

  // First tradeable bar: buy all-in.
  if (!started) {
    started = true;
    if (state.cash > 0n) {
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  if (held > 0n) {
    // Long: take profit, or stop out. The entry price per unit comes from
    // the account's cost basis (quote units per qty unit, at the scales).
    const pos = state.positions.get(SYMBOL)!;
    const sym = state.symbols.get(SYMBOL)!;
    const entry =
      (pos.cost * 10n ** BigInt(sym.qty_scale + sym.price_scale)) /
      (pos.qty * 10n ** BigInt(state.hello.capital.quote_scale));
    if (entry <= 0n) return [];
    if (close * BPS >= entry * (BPS + TAKE_PROFIT_BPS)) {
      exitKind = 'tp';
      peakSinceExit = close;
      lowSinceExit = close;
      return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    if (close * BPS <= entry * (BPS - STOP_LOSS_BPS)) {
      exitKind = 'sl';
      peakSinceExit = close;
      lowSinceExit = close;
      return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  // Flat: track the range since the exit, then re-enter on the rule for the
  // kind of exit that put us here.
  if (peakSinceExit === null || lowSinceExit === null) {
    peakSinceExit = close;
    lowSinceExit = close;
    return [];
  }
  if (close > peakSinceExit) peakSinceExit = close;
  if (close < lowSinceExit) lowSinceExit = close;

  if (state.cash <= 0n) return [];

  if (exitKind === 'sl') {
    // After a stop-loss, only a genuine bounce back above the trend.
    if (aboveEma && close * BPS >= lowSinceExit * (BPS + BOUNCE_BPS)) {
      peakSinceExit = null;
      lowSinceExit = null;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  // After a take-profit, buy the 1% pullback while the trend still holds.
  if (aboveEma && close * BPS <= peakSinceExit * (BPS - PULLBACK_BPS)) {
    peakSinceExit = null;
    lowSinceExit = null;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }
  return [];
}
