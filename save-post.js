import { query } from './db.js';

const parseJsonMetadata = (jsonStr) => {
    try {
        return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    } catch {
        return {};
    }
};

export function repToReadable(rep) {
    if (rep == null) return null;

    rep = String(rep);
    let neg = rep.charAt(0) === '-';
    rep = neg ? rep.substring(1) : rep;

    let log = Math.log10(parseInt(rep));
    let score = Math.max((log - 9), 0);
    score = (neg ? -1 : 1) * score;
    score = score * 9 + 25;

    return Math.floor(score);
}

const calculateScHot = (rshares, createdAt) => {
    const s = Math.sign(rshares);
    const order = Math.log10(Math.max(Math.abs(rshares), 1));
    const seconds = (new Date(createdAt).getTime() / 1000) - 1134028003;
    return parseFloat((s * order + seconds / 45000).toFixed(7));
};

const calculateScTrend = (rshares, createdAt) => {
    const s = Math.sign(rshares);
    const order = Math.log10(Math.max(Math.abs(rshares), 1));
    const seconds = (new Date().getTime() - new Date(createdAt).getTime()) / 1000;
    return parseFloat((s * order - seconds / 10000).toFixed(7));
};

export const savePostToDB = async (post) => {
    const post_id = post.post_id ?? post.id;
    const author = post.author;
    const permlink = post.permlink;

    if (!post || !post_id || !author || !permlink) {
        console.warn(`Invalid or missing post data`, post);
        return;
    }

    const title = post.title;
    const body = post.body;
    const json_metadata = typeof post.json_metadata === 'object'
        ? JSON.stringify(post.json_metadata)
        : post.json_metadata ?? '{}';
    const json = parseJsonMetadata(json_metadata);

    const category = post.category;
    const depth = post.depth ?? 0;
    const children = post.children ?? 0;
    const created = post.created;
    const last_update = post.updated ?? post.last_update ?? created;
    const cashout_time = post.payout_at ?? post.cashout_time ?? created;

    const author_reputation = typeof post.author_reputation === 'string'
        ? repToReadable(post.author_reputation)
        : Math.round(post.author_reputation);

    const active_votes = post.active_votes ?? [];
    const total_votes = active_votes.length;
    const up_votes = active_votes.reduce((acc, v) => acc + (parseInt(v.rshares) > 0 ? 1 : -1), 0);

    const payout = parseFloat(post.total_payout_value ?? post.payout ?? 0) || 0;
    const pending_payout = parseFloat(post.pending_payout_value ?? 0) || 0;
    const promotedAmount = parseFloat(post.promoted ?? 0) || 0;

    const max_accepted_payout = post.max_accepted_payout ?? '1000000.000 HBD';
    const percent_hbd = post.percent_hbd ?? 10000;

    const vote_rshares = parseInt(post.vote_rshares ?? post.net_rshares ?? 0);
    const abs_rshares = parseInt(post.abs_rshares ?? post.net_rshares ?? 0);

    const img_url = json?.image?.[0] || null;
    const is_nsfw = category?.toLowerCase() === 'nsfw' || json?.tags?.includes?.('nsfw') || false;
    const is_declined = max_accepted_payout === '0.000 HBD';
    const is_full_power = percent_hbd === 0;
    const is_paidout = new Date(cashout_time) < new Date();
    const is_hidden = false;
    const is_grayed = false;

    const sc_hot = calculateScHot(vote_rshares, created);
    const sc_trend = calculateScTrend(vote_rshares, created);

    const result = await query(
        `WITH upsert AS (
            INSERT INTO hive_posts_raw (
                post_id, author, permlink, category, depth, children, author_rep,
                total_votes, up_votes, title, img_url, payout, pending_payout,
                promoted, created_at, payout_at, updated_at, is_paidout, is_nsfw,
                is_declined, is_full_power, is_hidden, is_grayed, rshares, abs_rshares,
                sc_hot, sc_trend, body, votes, json
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19,
                $20, $21, $22, $23, $24, $25,
                $26, $27, $28, $29, $30
            )
            ON CONFLICT (author, permlink) DO UPDATE
            SET
                post_id = EXCLUDED.post_id,
                title = EXCLUDED.title,
                body = EXCLUDED.body,
                updated_at = EXCLUDED.updated_at,
                payout = EXCLUDED.payout,
                pending_payout = EXCLUDED.pending_payout,
                promoted = EXCLUDED.promoted,
                total_votes = EXCLUDED.total_votes,
                up_votes = EXCLUDED.up_votes,
                author_rep = EXCLUDED.author_rep,
                is_paidout = EXCLUDED.is_paidout,
                is_nsfw = EXCLUDED.is_nsfw,
                is_declined = EXCLUDED.is_declined,
                is_full_power = EXCLUDED.is_full_power,
                is_hidden = EXCLUDED.is_hidden,
                is_grayed = EXCLUDED.is_grayed,
                rshares = EXCLUDED.rshares,
                abs_rshares = EXCLUDED.abs_rshares,
                sc_hot = EXCLUDED.sc_hot,
                sc_trend = EXCLUDED.sc_trend,
                json = EXCLUDED.json
            WHERE EXCLUDED.updated_at > hive_posts_raw.updated_at
            RETURNING xmax = 0 AS inserted
        )
        SELECT * FROM upsert;
        `,
        [
            post_id, author, permlink, category, depth, children, repToReadable(author_reputation),
            total_votes, up_votes, title, img_url, payout, pending_payout,
            promotedAmount, created, cashout_time, last_update, is_paidout, is_nsfw,
            is_declined, is_full_power, is_hidden, is_grayed, vote_rshares, abs_rshares,
            sc_hot, sc_trend, body, 0, json
        ]
    );

    const inserted = result.rows?.[0]?.inserted ?? false;
    console.log(`Post ${post_id} ${inserted ? 'inserted' : 'updated'}: @${author}/${permlink}`);
};

