CREATE UNIQUE INDEX IF NOT EXISTS usuario_username_lower_unique
ON usuario (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS usuario_email_lower_unique
ON usuario (LOWER(email));
