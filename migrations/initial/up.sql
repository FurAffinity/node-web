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

CREATE TYPE representation_role AS ENUM (
	'excerpt',
	'waveform',
	'thumbnail',
	'thumbnail@2x',
	'animated-thumbnail',
	'animated-thumbnail@2x',
	'preview',
	'preview@2x',
	'content'
);

CREATE TYPE user_representation_role AS ENUM (
	'profile-image',
	'profile-image@2x',
	'banner'
);

CREATE TYPE representation_type AS ENUM (
	'png',
	'jpeg',
	'gif',
	'webp',
	'vorbis',
	'opus',
	'aac',
	'mp3',
	'flac',
	'h264',
	'h265',
	'vp9',
	'swf',
	'html',
	'epub',
	'docx',
	'rtf',
	'doc',
	'txt'
);

CREATE TYPE submission_visibility AS ENUM (
	'deleted',
	'draft',
	'public'
);

CREATE TABLE files (
	id SERIAL PRIMARY KEY,
	hash BYTEA NOT NULL UNIQUE,
	size INTEGER NOT NULL
);

COMMENT ON COLUMN files.hash IS
	'a 128-bit prefix of the file’s SHA-512 hash';
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
	rating_preference rating NOT NULL DEFAULT 'general',
	views INTEGER NOT NULL DEFAULT 0,
	created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	active BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON COLUMN users.username IS
	'the username used in the canonical profile page URL; consists only of lowercase letters a-z, digits, hyphens, periods, and tildes';
COMMENT ON COLUMN users.display_username IS
	'the username visible on the profile pages and in text; consists only of letters a-z, digits, hyphens, underscores, periods, and tildes';
COMMENT ON COLUMN users.email IS
	'the e-mail address associated with the account; NULL if the account is a placeholder due to an e-mail conflict';
COMMENT ON COLUMN users.active IS
	'whether the account has been activated; should reflect lack of entry in registration_keys';

CREATE TABLE user_representations (
	"user" INTEGER NOT NULL REFERENCES users (id),
	role user_representation_role NOT NULL,
	type representation_type NOT NULL,
	file INTEGER NOT NULL REFERENCES files (id),
	PRIMARY KEY ("user", role, type)
);

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
	created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	visibility submission_visibility NOT NULL DEFAULT 'draft',
	metadata JSONB NOT NULL DEFAULT '{}',
	CHECK (visibility = 'draft' OR rating IS NOT NULL)
);

COMMENT ON COLUMN submissions.metadata IS
	'various data calculated *only* from the submission files; should be considered public';

CREATE INDEX ON submissions (owner);
CREATE INDEX ON submissions (updated, type, rating);

CREATE TABLE representations (
	submission INTEGER NOT NULL REFERENCES submissions (id),
	role representation_role NOT NULL,
	type representation_type NOT NULL,
	file INTEGER NOT NULL REFERENCES files (id),
	PRIMARY KEY (submission, role, type)
);

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
