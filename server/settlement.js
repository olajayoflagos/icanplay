// server/settlement.js
import { q, withTx, postTx } from './db.js';
import { v4 as uuid } from 'uuid';

const DEFAULT_RAKE_PERCENT = Number(process.env.DEFAULT_RAKE_PERCENT || 10);
const MAX_MATCH_DURATION_HOURS = Number(process.env.MATCH_MAX_HOURS || 48);

/**
 * Helper: choose account type for users depending on demo flag
 */
function userAccountType(demo) {
  return demo ? 'USER_DEMO' : 'USER_CASH';
}

/**
 * Compute payouts and ledger entries.
 *
 * @param {Object} match - DB match row (must include: id, demo, escrow_cents, rake_cents, creator_user_id, taker_user_id)
 * @param {Object} result - one of:
 *    { winner: <userId> }
 *    { draw: true, winners: [userId,...] }
 *    { forfeit: <userId> } // player who forfeited (other wins automatically)
 *    { reason: 'timeout' } // treat as draw or split per policy (we'll split if both present)
 * @param {Object} opts - { logger, io }
 *
 * @returns result object with payouts and bookkeeping.
 */
export async function settleMatch(io, match, result = {}, opts = {}) {
  const logger = opts.logger || console;
  // sanity checks
  if (!match || !match.id) throw new Error('invalid_match');
  const matchId = match.id;
  const demo = !!match.demo;
  const escrow = Number(match.escrow_cents || 0);
  const explicitRake = Number(match.rake_cents || 0);
  const rakeFromPercent = Math.floor((Number(match.stake_cents || 0) * (DEFAULT_RAKE_PERCENT / 100)) * 2); // stake*2*rake%
  const rake = explicitRake || rakeFromPercent;

  // Decide recipients & amounts
  let payouts = []; // { user_id, amount_cents, account_type }
  let houseAmount = 0;
  let note = '';

  // Helper to push payout
  const pushPayout = (user_id, amount_cents) => {
    if (!user_id || amount_cents <= 0) return;
    payouts.push({ user_id, amount_cents: Math.floor(amount_cents), account_type: userAccountType(demo) });
  };

  // If no escrow (demo might have no escrow), fall back to stake_cents split logic if available
  const totalEscrow = escrow > 0 ? escrow : Number(match.escrow_cents || 0);

  // Interpret result:
  if (result?.winner) {
    // winner gets all escrow minus rake
    const winner = result.winner;
    houseAmount = Math.min(rake, totalEscrow);
    const payoutAmount = Math.max(0, totalEscrow - houseAmount);
    pushPayout(winner, payoutAmount);
    note = `winner:${winner}`;
  } else if (result?.forfeit) {
    // forfeiter forfeited; other player gets (escrow - rake)
    const forfeiter = result.forfeit;
    const other = (match.creator_user_id === forfeiter) ? match.taker_user_id : match.creator_user_id;
    houseAmount = Math.min(rake, totalEscrow);
    const payoutAmount = Math.max(0, totalEscrow - houseAmount);
    pushPayout(other, payoutAmount);
    note = `forfeit_by:${forfeiter}`;
  } else if (result?.draw || result?.winners?.length > 1) {
    // Split equally among winners (draw)
    const winners = result.winners || (result.draw ? [match.creator_user_id, match.taker_user_id].filter(Boolean) : []);
    if (!winners.length) {
      // fallback: refund both if possible
      const half = Math.floor(totalEscrow / 2);
      pushPayout(match.creator_user_id, half);
      pushPayout(match.taker_user_id, totalEscrow - half);
      note = 'draw_refund';
    } else {
      houseAmount = Math.min(rake, totalEscrow); // house still takes rake if configured
      const remainder = Math.max(0, totalEscrow - houseAmount);
      const each = Math.floor(remainder / winners.length);
      winners.forEach(w => pushPayout(w, each));
      // any leftover cents return to first winner
      const distributed = each * winners.length;
      const leftover = remainder - distributed;
      if (leftover > 0) {
        pushPayout(winners[0], (payouts.find(p=>p.user_id===winners[0])?.amount_cents||0) + leftover);
      }
      note = 'draw';
    }
  } else {
    // Unknown result: attempt to split between players (safety fallback)
    const creators = [match.creator_user_id, match.taker_user_id].filter(Boolean);
    if (creators.length === 1) {
      pushPayout(creators[0], totalEscrow);
    } else if (creators.length === 2) {
      const half = Math.floor(totalEscrow / 2);
      pushPayout(creators[0], half);
      pushPayout(creators[1], totalEscrow - half);
    }
    note = 'fallback_split';
  }

  // Build ledger entries
  // We assume escrow is currently held as account_type 'ESCROW' with amount totalEscrow (positive). To release: create entries that
  // - credit users' accounts with payouts
  // - credit house with houseAmount (if >0)
  // - debit ESCROW by totalEscrow (as negative)
  const entries = [];
  if (houseAmount > 0) {
    entries.push({ account_type: 'HOUSE_CASH', user_id: null, amount_cents: houseAmount });
  }
  for (const p of payouts) {
    entries.push({ account_type: p.account_type, user_id: p.user_id, amount_cents: p.amount_cents });
  }

  // always release escrow (negative)
  entries.push({ account_type: 'ESCROW', user_id: null, amount_cents: -totalEscrow });

  // persist within tx
  const idempotency = `settle_${matchId}`;
  const actionRef = `SETTLE_${matchId}`;

  try {
    await withTx(async (c) => {
      // perform ledger entries (idempotent)
      await postTx(c, 'SETTLE', actionRef, entries, idempotency);

      // update matches table: status SETTLED, winner (if single), updated_at, result_json
      const winnerUserId = (result?.winner || (result?.forfeit ? ((result.forfeit === match.creator_user_id) ? match.taker_user_id : match.creator_user_id) : null));
      const resultData = {
        settled_at: new Date().toISOString(),
        note,
        payouts,
        houseAmount,
        rawResult: result
      };

      await c.query(
        `update matches set status=$1, winner_user_id=$2, updated_at=now(), settlement_json=$3 where id=$4`,
        ['SETTLED', winnerUserId || null, JSON.stringify(resultData), matchId]
      );
    });

    // emit socket event if io supplied
    try {
      opts.io?.to(match.room).emit('match:settled', { matchId, result, payouts, houseAmount });
    } catch (e) {
      logger?.warn?.('emit_failed', e?.message || e);
    }

    logger.info?.({ msg: 'match_settled', matchId, note, payouts, houseAmount });
    return { ok: true, matchId, payouts, houseAmount, note };
  } catch (err) {
    logger.error?.({ msg: 'settle_failed', matchId, err: err?.message || err });
    throw err;
  }
}

/**
 * Auto-settle matches that have exceeded allowed duration.
 * Finds matches that are LIVE (or OPEN depending on policy) older than MAX_MATCH_DURATION_HOURS and settles them.
 *
 * Policy used:
 *  - If LIVE and both players present: try to determine winner via passed in `determineWinner` callback, else split.
 *  - If OPEN but stale: mark CANCELLED and refund (or split) similarly. (You may prefer different behaviour.)
 *
 * @param {Object} io - socket.io server (optional, used to emit)
 * @param {Function} determineWinner - optional async fn(match) => { winner:userId } or { draw:true, winners:[] } or null
 * @param {Object} opts - { logger }
 */
export async function autoSettleIfOverdue(io, determineWinner = null, opts = {}) {
  const logger = opts.logger || console;
  const hours = MAX_MATCH_DURATION_HOURS;
  const rows = await q(
    `select * from matches where status in ('LIVE','OPEN') and (now() - created_at) > ($1 || ' hours')::interval limit 200`,
    [hours]
  );

  for (const m of rows) {
    try {
      let result = null;
      // If a callback is provided, allow custom determination (e.g. game-specific engine)
      if (determineWinner) {
        try {
          result = await determineWinner(m);
        } catch (e) {
          logger?.warn?.({ msg: 'determineWinner_failed', match: m.id, err: e?.message });
        }
      }

      // default fallback: if LIVE and both players: split, else cancel/refund
      if (!result) {
        if (m.status === 'LIVE' && m.creator_user_id && m.taker_user_id) {
          result = { draw: true, winners: [m.creator_user_id, m.taker_user_id] };
        } else {
          // treat as cancel/refund to creator (if only creator)
          if (m.creator_user_id && !m.taker_user_id) {
            result = { winner: m.creator_user_id };
          } else if (m.creator_user_id && m.taker_user_id) {
            result = { draw: true, winners: [m.creator_user_id, m.taker_user_id] };
          } else {
            result = { draw: true, winners: [] };
          }
        }
      }

      await settleMatch(io, m, result, { logger, io });
      // mark cancelled->SETTLED already done by settleMatch
    } catch (e) {
      logger?.error?.({ msg: 'auto_settle_failed', id: m.id, err: e?.message || e });
    }
  }
}