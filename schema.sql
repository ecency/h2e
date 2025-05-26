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

create table if not exists path_index
(
    post_id integer not null
        constraint path_index_pkey
            primary key,
    path varchar not null,
    created_at timestamp not null
)
;

create index if not exists trgm_idx_path
    on path_index (path)
;

create index if not exists idx_path_index_created_at
    on path_index (created_at desc)
;

CREATE OR REPLACE FUNCTION fn_path_index_sync()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.depth = 0
    THEN
        IF NOT EXISTS(SELECT post_id
                      FROM path_index
                      WHERE post_id = NEW.post_id)
        THEN
            INSERT INTO path_index (post_id, "path", created_at)
            SELECT
                ha.post_id,
                (ha.author || '/' || ha.permlink) AS path,
                ha.created_at
            FROM hive_posts_raw ha
            WHERE ha.post_id = NEW.post_id;
        END IF;
    END IF;
    RETURN NEW;
END
$$;

create trigger "__trg_path_index" after insert on hive_posts_raw for each row execute procedure fn_path_index_sync();

INSERT INTO path_index (post_id, "path", created_at)
SELECT
    ha.post_id,
    (ha.author || '/' || ha.permlink) AS path,
    ha.created_at
FROM hive_posts_raw ha
where ha.depth = 0;
