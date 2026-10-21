# Local backend

This Express service exposes `/api/health` and the optional authenticated matching API. It does not replace the deployed Django authentication, profiles, or chat service.

Copy `.env.example` to `.env`. Set `MEMBER_API_BASE_URL` to the trusted existing HTTPS member API, including `/api/v1`. Add `GEMINI_API_KEY` locally to enable AI prose; leave it empty for rule-based results. `GEMINI_MODEL` defaults to `gemini-2.5-flash`. Credentials never belong in the mobile bundle or a public repository.

Run `npm install`, `npm test`, `npm run build`, and `npm start` from this directory. For production, run the Node service behind the existing HTTPS reverse proxy. Route **only** `/api/v1/matches/` to this service, preserving the path and Authorization header. Preserve the existing Django routes. The older `/api/matches/` alias is also supported. No proxy deployment has been performed here.

## Matching contract

`POST /api/v1/matches/compatibility/`

```json
{ "candidateId": "profile-id", "useAi": true }
```

A member bearer token is required. The service validates it using `/auth/me/`, then fetches `/profiles/{candidateId}/` with the same identity. It respects the upstream profile-access response and never accepts client-supplied profile facts as authoritative. An absent or unavailable authentication configuration fails closed. There are no public weight/configuration mutation endpoints.

`useAi` defaults to false. The app requests AI only after the member presses the disclosed request button. The provider receives age, city, education, profession, diet, and interests; it receives no name, member/profile ID, contact details, religion, caste, or horoscope attributes. Gemini adds suggestions and explanation, while the score and shared facts remain deterministic. This score measures similarity across available fields; it does not predict relationship success. Missing comparable fields produce a null score, never a fabricated default.

Missing credentials, provider failures, malformed output, and an eight-second timeout return `isAiEnhanced: false`. Successful AI requests return `isAiEnhanced: true`. Inputs and model identify the bounded 30-minute in-memory cache; profile changes invalidate the effective cache key. The per-member limit is five requests per minute per service process. Use a shared rate limiter before scaling to multiple instances.

Provider reference: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash

## Optional local database

Set a unique `POSTGRES_PASSWORD`. Update `DATABASE_URL` to match, URL-encoding reserved characters in the password. Never commit `.env`.

With Docker Compose installed, run `npm run db:up`. PostgreSQL binds to localhost and Compose waits for its health check. Set `POSTGRES_PORT` if port 5432 is already in use. The current matching endpoint resolves member data through Django and does not require this local database.

Do not delete the `pgdata` volume when changing configuration. PostgreSQL initialization variables only apply to a new database volume; changing `.env` does not rotate an existing database role's password.

## Availability and production routing

`GET /api/v1/matches/capabilities/` returns `{ "service": "match-insights", "version": 1, "aiConfigured": true|false }`. It performs no Gemini request and returns no credentials or profile data. Configuration is not proof that the provider key is valid. The app checks this endpoint before offering an AI request.

If this endpoint or the unauthenticated POST endpoint returns 404, the matching route is not reachable at that production URL. A correct unauthenticated POST must return 401. A service with no usable configuration reports `aiConfigured: false`.

Deployment templates are in `deploy/nginx-matches.conf.example` and `deploy/mydearpartner-matching.service.example`. They are examples, not applied configuration. Confirm the real host identity, OS account, installation directory, Node binary, existing proxy configuration, and available loopback port before applying them. The Node service now binds to loopback by default; `HOST` may be explicitly configured for a private container network.

For a host using systemd, the example uses port 3001 and `/etc/mydearpartner-matching.env` with `GEMINI_API_KEY`, `GEMINI_MODEL`, and `MEMBER_API_BASE_URL`. Keep this environment file readable only by the service operator. Do not replace the production backend `.env` or the full Nginx configuration with these examples. For an existing Compose deployment, add a separate matching service on its private network and adapt `proxy_pass` to that verified service name instead.

After verified deployment, check loopback health, the HTTPS capabilities response, unauthenticated POST denial, and an authenticated dedicated test account. Validate the existing reverse-proxy configuration before reloading it. No production deployment or trusted SSH host-key modification was performed from this workspace.

### Explicit preferences

The comparison gateway reads `partner_preferences` (snake case) or
`partnerPreferences` from the authenticated member API profiles. It supports
numeric `min_age`/`max_age` (or camel case) and arrays for city, state,
`mother_tongue`, education, profession, diet and `marital_status`. Each supported
stated preference is evaluated in its owner's direction, with equal weight to
other comparable factors. Missing candidate facts earn no points and are excluded
from the score. Invalid age bounds are ignored. Religion/caste and unsupported
preferences are not evaluated. Preferences are not sent to Gemini. This gateway
comparison does not change the production discovery ranking or its reported score.
