ALTER TABLE users ADD COLUMN totp_key BYTEA;
ALTER TABLE users ADD COLUMN totp_last_used_counter INTEGER NOT NULL DEFAULT 0;

CREATE TABLE two_factor_recovery (
	"user" INTEGER NOT NULL REFERENCES users (id),
	recovery_code BYTEA NOT NULL
);

CREATE INDEX ON two_factor_recovery ("user");
