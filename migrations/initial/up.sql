CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE rating AS ENUM (
	'general',
	'mature',
	'adult'
);

CREATE TYPE submission_type AS ENUM (
	'image',
	'audio',
	'text'
);

CREATE TYPE file_type AS ENUM (
	'jpg',
	'png',
	'gif',
	'swf',
	'doc',
	'docx',
	'epub',
	'rtf',
	'html',
	'txt',
	'pdf',
	'odt',
	'mid',
	'wav',
	'mp3',
	'vorbis',
	'opus',
	'flac',
	'm4a'
);

CREATE TABLE files (
	id SERIAL PRIMARY KEY,
	hash TEXT NOT NULL UNIQUE,
	size INTEGER NOT NULL
);

COMMENT ON COLUMN files.hash IS
	'the file’s SHA-256 hash';
COMMENT ON COLUMN files.size IS
	'the file’s size in bytes';

CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	username CITEXT NOT NULL UNIQUE,
	email TEXT UNIQUE,
	password_hash TEXT NOT NULL,
	display_username TEXT NOT NULL,
	full_name TEXT NOT NULL DEFAULT '',
	profile_text TEXT NOT NULL DEFAULT '',
	profile_type TEXT NOT NULL DEFAULT '',
	image INTEGER REFERENCES files (id),
	image_type file_type,
	banner INTEGER REFERENCES files (id),
	banner_type file_type,
	rating_preference rating NOT NULL DEFAULT 'general',
	views INTEGER NOT NULL DEFAULT 0,
	created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	active BOOLEAN NOT NULL DEFAULT FALSE,
	CHECK ((image IS NULL) = (image_type IS NULL)),
	CHECK ((banner IS NULL) = (banner_type IS NULL))
);

COMMENT ON COLUMN users.username IS
	'the username used in the canonical profile page URL; consists only of lowercase letters a-z, digits, hyphens, periods, and tildes';
COMMENT ON COLUMN users.display_username IS
	'the username visible on the profile pages and in text; consists only of letters a-z, digits, hyphens, underscores, periods, and tildes';
COMMENT ON COLUMN users.email IS
	'the e-mail address associated with the account; NULL if the account is a placeholder due to an e-mail conflict';
COMMENT ON COLUMN users.active IS
	'whether the account has been activated; should reflect lack of entry in registration_keys';

CREATE TABLE sessions (
	id BYTEA PRIMARY KEY,
	key_hash BYTEA NOT NULL,
	"user" INTEGER NOT NULL REFERENCES users (id),
	created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ON sessions ("user");

CREATE TABLE registration_keys (
	"user" INTEGER PRIMARY KEY REFERENCES users (id),
	key_hash BYTEA NOT NULL
);

CREATE TABLE submissions (
	id SERIAL PRIMARY KEY,
	owner INTEGER NOT NULL REFERENCES users (id),
	type submission_type NOT NULL,
	title TEXT NOT NULL,
	description TEXT NOT NULL,
	rating rating,
	views INTEGER NOT NULL DEFAULT 0,
	thumbnail INTEGER REFERENCES files (id),
	thumbnail_type file_type,
	waveform INTEGER REFERENCES files (id),
	created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	published BOOLEAN NOT NULL DEFAULT FALSE,
	CHECK ((thumbnail IS NULL) = (thumbnail_type IS NULL)),
	CHECK (NOT published OR rating IS NOT NULL)
);

CREATE INDEX ON submissions (owner);
CREATE INDEX ON submissions (type, rating);

CREATE TABLE submission_files (
	submission INTEGER NOT NULL REFERENCES submissions (id),
	type file_type NOT NULL,
	file INTEGER NOT NULL REFERENCES files (id),
	original BOOLEAN NOT NULL,
	PRIMARY KEY (submission, type)
);

CREATE UNIQUE INDEX ON submission_files (submission) WHERE original;

CREATE TABLE hidden_submissions (
	hidden_by INTEGER NOT NULL REFERENCES users (id),
	submission INTEGER NOT NULL REFERENCES submissions (id),
	hidden TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	PRIMARY KEY (hidden_by, submission)
);

CREATE TABLE tags (
	id SERIAL PRIMARY KEY,
	name CITEXT NOT NULL UNIQUE
);

COMMENT ON COLUMN tags.name IS 'a lowercase tag name, normalized as NFC, with no leading or trailing whitespace';

CREATE TABLE submission_tags (
	submission INTEGER NOT NULL REFERENCES submissions (id),
	tag INTEGER NOT NULL REFERENCES tags (id),
	PRIMARY KEY (submission, tag)
);

CREATE INDEX ON submission_tags (tag);

CREATE TABLE comments (
	id SERIAL PRIMARY KEY,
	submission INTEGER NOT NULL REFERENCES submissions (id),
	parent INTEGER REFERENCES comments (id),
	owner INTEGER NOT NULL REFERENCES users (id),
	text TEXT NOT NULL,
	created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ON comments (submission);
CREATE INDEX ON comments (owner);

CREATE TABLE favorites (
	owner INTEGER NOT NULL REFERENCES users (id),
	submission INTEGER NOT NULL REFERENCES submissions (id),
	created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	PRIMARY KEY (owner, submission)
);

CREATE INDEX ON favorites (submission);

CREATE TABLE shouts (
	id SERIAL PRIMARY KEY,
	"user" INTEGER NOT NULL REFERENCES users (id),
	owner INTEGER NOT NULL REFERENCES users (id),
	text TEXT NOT NULL,
	created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ON shouts ("user");
CREATE INDEX ON shouts (owner);

CREATE TABLE folders (
	id SERIAL PRIMARY KEY,
	owner INTEGER NOT NULL REFERENCES users (id),
	title TEXT NOT NULL,
	hidden BOOLEAN NOT NULL DEFAULT FALSE,
	"order" INTEGER NOT NULL
);

CREATE INDEX ON folders (owner);

CREATE TABLE submission_folders (
	submission INTEGER NOT NULL REFERENCES submissions (id),
	folder INTEGER NOT NULL REFERENCES folders (id),
	"order" INTEGER NOT NULL,
	PRIMARY KEY (submission, folder)
);

CREATE INDEX ON submission_folders (submission);
CREATE INDEX ON submission_folders (folder);
