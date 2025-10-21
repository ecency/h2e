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
  json JSONB,
  CONSTRAINT hive_posts_raw_author_permlink_unique UNIQUE (author, permlink)
);

CREATE TABLE IF NOT EXISTS last_processed_block (
  id SERIAL PRIMARY KEY,
  block_num BIGINT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE __h2e_posts
(
    post_id INTEGER PRIMARY KEY
);

INSERT INTO __h2e_posts (post_id) SELECT post_id FROM hive_posts_raw;

CREATE OR REPLACE FUNCTION __fn_h2e_posts()
    RETURNS TRIGGER AS
$func$
BEGIN
    IF NOT EXISTS (SELECT post_id FROM __h2e_posts WHERE post_id = NEW.post_id) THEN
        INSERT INTO __h2e_posts (post_id) VALUES (NEW.post_id);
    END IF;
    RETURN NEW;
END
$func$ LANGUAGE plpgsql;

CREATE TRIGGER __trg_h2e_posts
    AFTER INSERT OR UPDATE ON hive_posts_raw
    FOR EACH ROW EXECUTE PROCEDURE __fn_h2e_posts();

CREATE TABLE IF NOT EXISTS path_index (
                                          post_id INTEGER NOT NULL,
                                          path VARCHAR NOT NULL,
                                          created_at TIMESTAMP NOT NULL
);

-- Make path unique instead of post_id
ALTER TABLE path_index
    ADD CONSTRAINT unique_path UNIQUE (path);

-- Optional index for fast search
CREATE INDEX IF NOT EXISTS idx_path_index_created_at ON path_index (created_at DESC);


CREATE OR REPLACE FUNCTION fn_path_index_sync()
    RETURNS TRIGGER
    LANGUAGE plpgsql AS $$
BEGIN
    -- Only handle top-level posts
    IF NEW.depth = 0 THEN
        INSERT INTO path_index (post_id, path, created_at)
        VALUES (NEW.post_id, NEW.author || '/' || NEW.permlink, NEW.created_at)
        ON CONFLICT (path) DO UPDATE
            SET post_id = EXCLUDED.post_id,
                created_at = EXCLUDED.created_at;
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS __trg_path_index ON hive_posts_raw;

CREATE TRIGGER __trg_path_index
    AFTER INSERT ON hive_posts_raw
    FOR EACH ROW
EXECUTE FUNCTION fn_path_index_sync();


INSERT INTO path_index (post_id, "path", created_at)
SELECT
    ha.post_id,
    (ha.author || '/' || ha.permlink) AS path,
    ha.created_at
FROM hive_posts_raw ha
where ha.depth = 0;
