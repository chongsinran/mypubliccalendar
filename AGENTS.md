# Repository Guidelines

A quick guide for contributors working on the calendar service backend and static client.

## Project Map
```
src/
  controllers/      # Request handlers and business rules
  middleware/       # JWT guard and shared middle-tier logic
  models/           # Database helpers + database.sql baseline schema
  routes/           # Route definitions composed into Express
  scheduler/        # Telegram notification jobs
  utils/            # Reusable helpers (e.g., escapeMarkdown)
public/             # Static client served by Express
```
`src/index.js` wires these modules, serves `public/`, and spins up the Telegram scheduler. Reference `Dockerfile` and `instruction_install.txt` whenever deployment steps change.

## Build, Test & Run
| Command | Purpose |
| --- | --- |
| `npm install` | Sync Node dependencies after modifying `package.json`. |
| `npm run dev` | Launch API with nodemon for hot reload while coding. |
| `docker-compose up -d` | Bring up app + PostgreSQL stack; pair with `docker-compose down` to stop. |
| `psql -h localhost -U postgres -f src/models/database.sql project_calendar` | Seed the base schema once the DB container is ready. |

## Style Expectations
- Stick to 2-space indentation, semicolons, and single quotes to match existing files.
- Give modules verb-first exports (`getEvents`, `saveTelegramConfig`) and keep them scoped to their directory’s responsibility.
- Store secrets in `.env`; never commit real keys or Telegram tokens. Introduce `.env.sample` entries when adding new variables.

## Domain Conventions
- Workflow status lifecycle is fixed at `pending`, `in-progress`, `complete`, and `rejected`; keep them lowercase at the API boundary and normalise upstream inputs.
- Task type taxonomy lives in `events.task_type` and must be one of `feature`, `bug`, `scheduled`, or `announcement`. When extending, update both the DB constraint and UI selectors together.
- Calendar renders colour-code by task type while progress filters operate on workflow status—ensure both dimensions stay in sync when adding features.

## Testing Playbook
- Add Jest suites under `tests/` and wire them to `npm test`; cover controllers, middleware, and scheduler edge cases.
- Name files `<area>.test.js` and ensure Docker-backed tests run inside the app container when they rely on PostgreSQL.
- Track coverage expectations in PR descriptions until a threshold is formalized.

## Git Hygiene
- Use concise, imperative commit subjects (e.g., `add telegram retry logic`) and avoid timestamp-only history.
- PRs should explain scope, reference issues, and list verification steps (curl snippets, scheduler dry runs, UI screenshots).
- When changing config or secrets flow, note updates to `.env`, `.env.sample`, and deployment instructions.

## Security Checklist
> Keep `.env` untracked, rotate credentials after incidents, and confirm CORS + JWT secrets before each release. Double-check Telegram scheduler settings in staging before promoting. 
