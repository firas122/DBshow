/**
 * Demo schema for the "Load Library Catalog Sample" button. A normal-sized,
 * deliberately clean schema — every table has a primary key, every foreign
 * key is explicit, type-matched and indexed, nothing is circular or
 * isolated. Meant to show what a Health 100 schema (and an empty ticker)
 * looks like, in contrast with the other samples.
 */
export const LIBRARY_SAMPLE_SQL = `-- ============================================================
--  Library Catalog — demo schema (fully healthy, no linter findings)
-- ============================================================

CREATE TABLE publishers (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  name         VARCHAR(160) NOT NULL UNIQUE,
  country_code CHAR(2) NOT NULL
);

CREATE TABLE genres (
  id   INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE authors (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(160) NOT NULL,
  birth_year INT NULL
);

CREATE TABLE books (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  publisher_id    INT NOT NULL,
  title           VARCHAR(220) NOT NULL,
  isbn            VARCHAR(20) NOT NULL UNIQUE,
  published_year  INT NOT NULL,
  CONSTRAINT fk_books_publisher FOREIGN KEY (publisher_id) REFERENCES publishers (id) ON DELETE RESTRICT
);
CREATE INDEX idx_books_publisher_id ON books (publisher_id);

CREATE TABLE book_authors (
  book_id   INT NOT NULL,
  author_id INT NOT NULL,
  PRIMARY KEY (book_id, author_id),
  CONSTRAINT fk_book_authors_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
  CONSTRAINT fk_book_authors_author FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE
);
CREATE INDEX idx_book_authors_author_id ON book_authors (author_id);

CREATE TABLE book_genres (
  book_id  INT NOT NULL,
  genre_id INT NOT NULL,
  PRIMARY KEY (book_id, genre_id),
  CONSTRAINT fk_book_genres_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
  CONSTRAINT fk_book_genres_genre FOREIGN KEY (genre_id) REFERENCES genres (id) ON DELETE CASCADE
);
CREATE INDEX idx_book_genres_genre_id ON book_genres (genre_id);

CREATE TABLE members (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(160) NOT NULL,
  email     VARCHAR(255) NOT NULL UNIQUE,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loans (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  book_id     INT NOT NULL,
  member_id   INT NOT NULL,
  loaned_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at      TIMESTAMP NOT NULL,
  returned_at TIMESTAMP NULL,
  CONSTRAINT fk_loans_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE RESTRICT,
  CONSTRAINT fk_loans_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
);
CREATE INDEX idx_loans_book_id ON loans (book_id);
CREATE INDEX idx_loans_member_id ON loans (member_id);

CREATE TABLE reservations (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  book_id     INT NOT NULL,
  member_id   INT NOT NULL,
  reserved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  CONSTRAINT fk_reservations_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
  CONSTRAINT fk_reservations_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
);
CREATE INDEX idx_reservations_book_id ON reservations (book_id);
CREATE INDEX idx_reservations_member_id ON reservations (member_id);
`;
