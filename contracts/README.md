# AGY Contract Documentation

## Anti-Sniping Rules

### Auction Sniping Prevention

Auction sniping occurs when a last-second bid wins without giving other participants time to place counter-bids. This contract implements anti-sniping rules to prevent this behavior.

**Rule:** When a bid arrives within the final 10 ledgers before the bidding deadline, the auction window is automatically extended. This ensures that all participants have a fair opportunity to respond to late bids.

**How it works:**
1. Each job has a `biddingClosedAt` timestamp that defines when bidding closes.
2. When a bid is submitted via `submitApplication`, the contract checks if the bid arrives within the final 10 ledgers of the bidding window.
3. If so, `extendBiddingClose` is triggered, pushing the `biddingClosedAt` forward by 10 minutes.
4. The extension guarantees a minimum counter-bid window so participants are not disadvantaged by last-second submissions.

**Key functions:**
- `closeBiddingForJob` — Manually closes the bidding period (client only)
- `extendBiddingClose` — Extends the bidding close time when a late bid arrives (client only)
- `submitApplication` — Submits a bid; triggers sniping prevention logic automatically

**Extension limits:**
- Maximum total extension: 90 days from original expiry (via `extendJobExpiry` from `jobService`)
- Bidding extension: 10 minutes per trigger (via `extendBiddingClose`)
- Each extension resets the reveal deadline (bidding close + 24 hours)

### Escrow Contract

See [marketpay-contract/README.md](marketpay-contract/README.md) for Soroban escrow contract details.

## Contract Upgrade Process

See [marketpay-contract/README.md](marketpay-contract/README.md) for the upgrade process.

## Security

See [marketpay-contract/SECURITY.md](marketpay-contract/SECURITY.md) for security audit findings.
