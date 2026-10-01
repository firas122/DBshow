/**
 * Demo schema pair for the "Load Blog Platform Sample" button and the schema
 * diff feature. v2 is what loads by default; v1 ships as its bundled
 * compare baseline so "Compare schemas" has something meaningful to show
 * without the user hunting down a second file.
 *
 * v1 -> v2 changes:
 *   tables added     categories, newsletter_subscribers
 *   tables removed   tags, post_tags
 *   tables modified  authors (+avatar_url), posts (-views, +category_id),
 *                     comments (author_name widened)
 *   relations added  posts.category_id -> categories.id
 *   relations removed post_tags.post_id -> posts.id, post_tags.tag_id -> tags.id
 *
 * v2 alone still trips two linter checks (missing-index on
 * posts.category_id, orphan-table on newsletter_subscribers) so the ticker
 * has something to show even before you open the diff.
 */
export const BLOG_SAMPLE_V1_SQL = `-- ============================================================
--  Blog Platform — v1 (before migration)
-- ============================================================

CREATE TABLE authors (
  id    INT PRIMARY KEY AUTO_INCREMENT,
  name  VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  bio   TEXT
);

CREATE TABLE posts (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  author_id     INT NOT NULL,
  title         VARCHAR(200) NOT NULL,
  slug          VARCHAR(220) NOT NULL UNIQUE,
  body          TEXT,
  published_at  TIMESTAMP NULL,
  views         INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE
);
CREATE INDEX idx_posts_author_id ON posts (author_id);

CREATE TABLE comments (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  post_id      INT NOT NULL,
  author_name  VARCHAR(100) NOT NULL,
  body         TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
);
CREATE INDEX idx_comments_post_id ON comments (post_id);

CREATE TABLE tags (
  id   INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  post_id  INT NOT NULL,
  tag_id   INT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  CONSTRAINT fk_post_tags_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_tags_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);
`;

export const BLOG_SAMPLE_V2_SQL = `-- ============================================================
--  Blog Platform — v2 (after migration)
--  Adds categories and a newsletter list, retires the tag system,
--  widens a narrow column. Use "Compare schemas" to diff this
--  against the bundled v1 baseline.
-- ============================================================

CREATE TABLE authors (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  bio         TEXT,
  avatar_url  VARCHAR(255)
);

CREATE TABLE categories (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

-- category_id has no supporting index yet (missing-index warning).
CREATE TABLE posts (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  author_id     INT NOT NULL,
  category_id   INT NULL,
  title         VARCHAR(200) NOT NULL,
  slug          VARCHAR(220) NOT NULL UNIQUE,
  body          TEXT,
  published_at  TIMESTAMP NULL,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);
CREATE INDEX idx_posts_author_id ON posts (author_id);

CREATE TABLE comments (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  post_id      INT NOT NULL,
  author_name  VARCHAR(160) NOT NULL,
  body         TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
);
CREATE INDEX idx_comments_post_id ON comments (post_id);

-- No relationships yet — reads as an isolated table (orphan-table note).
CREATE TABLE newsletter_subscribers (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL UNIQUE,
  subscribed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
