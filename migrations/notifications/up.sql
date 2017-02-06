CREATE TABLE follows (
	follower INTEGER NOT NULL REFERENCES users (id),
	following INTEGER NOT NULL REFERENCES users (id),
	followed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	PRIMARY KEY (follower, following),
	CHECK (follower != following)
);

CREATE INDEX ON follows (following);
