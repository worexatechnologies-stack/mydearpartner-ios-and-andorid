# Local backend

This Express service currently exposes `/api/health`. It does not implement the deployed application's authentication, profiles or chat APIs.

Copy `.env.example` to `.env` and set a unique `POSTGRES_PASSWORD`. Update `DATABASE_URL` to match, URL-encoding reserved characters in the password. Never commit `.env`.

With Docker Compose installed, run `npm run db:up`. PostgreSQL binds to localhost and Compose waits for its health check. Set `POSTGRES_PORT` if port 5432 is already in use.

Run `npm run build` and `npm start` to start the health service. Do not delete the `pgdata` volume when changing configuration. PostgreSQL initialization variables only apply to a new database volume; changing `.env` does not rotate an existing database role's password.
