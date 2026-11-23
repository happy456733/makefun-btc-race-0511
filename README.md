# makefun-btc-race-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/happy456733/makefun-btc-race-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/happy456733/makefun-btc-race-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A swing bot that trades Coinbase Wrapped BTC (cbBTC) against USDC minute by minute in the agent-fun/bars-replay/v1 replay. It buys all-in on the first bar, takes profit at +1.5% over its entry cost, stops out at −2.5%, and re-enters on a 1.0% pullback while the close holds above its 60-bar EMA — after a stop-loss it waits for a genuine 1.5% bounce instead. All decisions are integer (BigInt) arithmetic on the bars themselves: no wall clock, no randomness, no network, so two runs produce byte-identical action logs.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=5xhhehwj&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
