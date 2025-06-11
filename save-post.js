import { query } from './db.js';

const parseJsonMetadata = (jsonStr) => {
    try {
        return JSON.parse(jsonStr);
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
    if (!post || !post.id || !post.author || !post.permlink) {
        console.warn(`Invalid or missing post data`, post);
        return;
    }
    const {
        id: post_id,
        author,
        permlink,
        parent_permlink: category,
        title,
        body,
        json_metadata,
        created,
        last_update,
        depth,
        children,
        author_reputation,
        active_votes,
        total_payout_value,
        pending_payout_value,
        promoted,
        cashout_time,
        max_accepted_payout,
        percent_hbd,
        vote_rshares,
        abs_rshares
    } = post;

    const json = parseJsonMetadata(json_metadata || '{}');
    const img_url = json?.image?.[0] || null;
    const is_nsfw = category?.toLowerCase() === 'nsfw' || json?.tags?.includes?.('nsfw') || false;
    const is_declined = max_accepted_payout === '0.000 HBD';
    const is_full_power = percent_hbd === 0;
    const is_paidout = new Date(cashout_time) < new Date();
    const is_hidden = false; // Optional logic
    const is_grayed = false; // Optional logic

    const total_votes = active_votes?.length || 0;
    const up_votes = active_votes?.reduce((acc, v) => acc + (parseInt(v.rshares) > 0 ? 1 : -1), 0);

    const payout = parseFloat(total_payout_value) || 0;
    const pending_payout = parseFloat(pending_payout_value) || 0;
    const promotedAmount = parseFloat(promoted) || 0;

    const rshares = parseInt(vote_rshares || 0);
    const absRshares = parseInt(abs_rshares || 0);

    const sc_hot = calculateScHot(rshares, created);
    const sc_trend = calculateScTrend(rshares, created);

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
                ON CONFLICT (post_id) DO UPDATE
                SET
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
            is_declined, is_full_power, is_hidden, is_grayed, rshares, absRshares,
            sc_hot, sc_trend, body, 0, json
        ]
    );


    const inserted = result.rows?.[0]?.inserted ?? false;
    console.log(`Post ${post_id} ${inserted ? 'inserted' : 'updated'}: @${author}/${permlink}`);
};
