# Support-Inbox-Intelligence

Support-Inbox-Intelligence is a full-stack ticketing / support inbox prototype built with a React + Vite frontend and a Node.js + Express backend. It demonstrates user authentication, ticket CRUD, role-based access, and an interactive UI for managing tickets.

## Key features

- User authentication and refresh tokens
- Ticket creation, assignment, status updates, and archiving
- Role-based admin features (user management, seeding)
- Interactive board and table views built with drag-and-drop support
- Responsive UI with TailwindCSS
- API server with MongoDB persistence

## Tech stack

- Frontend: React (v19) + Vite, TailwindCSS, @tanstack/react-query
- Backend: Node.js, Express, Mongoose (MongoDB)
- Auth: JWT access + refresh tokens
- Dev tooling: Vite, nodemon, ESLint

## Repository layout

```
/frontend        # React + Vite app (UI, components, pages, API helpers)
	package.json
	src/
		api/         # axios + api helpers
		components/  # UI and page components
		pages/       # route pages (Backlog, TicketPage, AdminUsers, etc)

/server          # Express API server
	package.json
	index.js       # app entry
	config/
		db.js        # mongoose connection
	controllers/
	services/      # auth, ticket, admin services
	models/        # Mongoose models (User, Ticket, etc)

README.md
```

## Prerequisites

- Node.js (>= 18 recommended)
- npm (or yarn)
- MongoDB instance (local or cloud)

## Environment variables

Create a `.env` file in the `server/` directory (or set env vars in your deployment). The application expects the following variables:

```
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:5173   # frontend origin used by CORS
PORT=4000                          # optional, defaults to 4000
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
NODE_ENV=development
```

Notes:
- `MONGODB_URI` is used by `server/config/db.js` to connect Mongoose to MongoDB.
- `CLIENT_URL` is read in `server/index.js` to configure CORS.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` are used by the auth service for signing tokens.

## Local development

1. Install dependencies for frontend and backend

```bash
# at project root
cd server
npm install

cd ../frontend
npm install
```

2. Start the backend server (in `server/`)

```bash
cd server
npm run dev
# runs nodemon index.js
```

3. Start the frontend (in `frontend/`)

```bash
cd frontend
npm run dev
# opens Vite dev server (default port shown in terminal)
```

Open your browser at the URL printed by Vite (commonly http://localhost:5173) and you should be able to authenticate and use the UI against the running API.

## Available scripts

- Frontend (`frontend/package.json`):
	- `npm run dev` — start Vite dev server
	- `npm run build` — build production assets
	- `npm run preview` — serve the built assets locally
	- `npm run lint` — run ESLint

- Server (`server/package.json`):
	- `npm run dev` — start server with `nodemon` (watches for changes)

## Notes on authentication and security

- The backend issues short-lived access tokens and refresh tokens (see `server/services/authService.js`).

## Seeding and admin

- The project includes a seeder script under `server/seeder/seed.js` which can create sample users/tickets for development. Review the seeder before running in any non-dev environment.

## Tests

- There are no automated tests included in this repository currently. Adding unit and integration tests for backend services and React components is a recommended next step.

## Contributing

- Feel free to open issues and pull requests. For sizable changes, please open an issue first to discuss the approach.

## License

This repository does not specify a license. If you plan to open-source it, add a `LICENSE` file (e.g., MIT) to clarify terms.
