CREATE TABLE IF NOT EXISTS hive_posts_raw (
  post_id BIGINT PRIMARY KEY,
  author TEXT NOT NULL,
  permlink TEXT NOT NULL,
  category TEXT,
  depth INTEGER,
  children INTEGER,
  author_rep BIGINT,
  total_votes INTEGER,
  up_votes INTEGER,
  title TEXT,
  img_url TEXT,
  payout DOUBLE PRECISION,
  pending_payout DOUBLE PRECISION,
  promoted DOUBLE PRECISION,
  created_at TIMESTAMPTZ,
  payout_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_paidout BOOLEAN,
  is_nsfw BOOLEAN,
  is_declined BOOLEAN,
  is_full_power BOOLEAN,
  is_hidden BOOLEAN,
  is_grayed BOOLEAN,
  rshares BIGINT,
  abs_rshares BIGINT,
  sc_hot DOUBLE PRECISION,
  sc_trend DOUBLE PRECISION,
  body TEXT,
  votes INTEGER,
  json JSONB
);

CREATE TABLE IF NOT EXISTS last_processed_block (
  id SERIAL PRIMARY KEY,
  block_num BIGINT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
