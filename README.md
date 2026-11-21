# FriskyTrails CRM

<!-- Deployment trigger: Netlify rebuild marker -->

A customer relationship management application for travel agencies to manage client leads, assign them to agents, and track communication logs.

## Tech Stack

| Layer    | Technology                                    |
| -------- | --------------------------------------------- |
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7 |
| Backend  | Node.js, Express, MongoDB (Mongoose), JWT     |
| Tooling  | ESLint 10                                     |

## Features

- **Authentication** — JWT-based secure login, with separate roles for Admins and Agents.
- **Lead Management** — Add client leads with name, phone, age, origin, and destination details.
- **Agent Dashboard** — Dedicated 'My Leads' page for agents to only see leads assigned to them.
- **Assignment System** — Admins can assign or unassign leads to agents with a single click.
- **Communication Logs** — Post and view notes/updates per lead, with authorship tracking and secure deletion permissions.
- **Search & Filter** — Search leads by name, phone, origin, destination, or agent name; filter by agent or unassigned status.
- **Dashboard Metrics** — Quick-view cards for total leads, and assigned/unassigned counts.
- **Dual View Modes** — Toggle between card grid and clean list layout.

## Project Structure

```text
FriskyTrails CRM/
├── backend/                          # Express Server & MongoDB API
│   ├── config/                       # Environment variables config
│   ├── controllers/                  # Route handlers (auth, leads, agents)
│   ├── db/                           # Mongoose connection logic
│   ├── middleware/                   # JWT auth & admin guard middleware
│   ├── models/                       # Mongoose Schemas (User, Lead, Notes)
│   ├── routes/                       # Express API routing definitions
│   ├── services/                     # Business logic and database operations
│   ├── utils/                        # Shared utility functions
│   ├── .env.example                  # Template for environment variables
│   ├── index.js                      # Main Express server entry point
│   └── package.json
├── crm_website_frontend/             # React + Vite frontend
│   ├── public/
│   │   └── logo.webp
│   ├── src/
│   │   ├── components/
│   │   │   └── Navbar.jsx            # Sticky navigation bar with route links
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx         # Global admin dashboard: metrics, filtering, assignments
│   │   │   ├── MyLeads.jsx           # Personalized view exclusively for assigned agents
│   │   │   ├── Login.jsx             # Authentication login portal
│   │   │   ├── AddLead.jsx           # Form to add new client leads (Admin only)
│   │   │   └── AddAgent.jsx          # Form to add new agents (Admin only)
│   │   ├── App.jsx                   # Root component: state management, auth token tracking & routing
│   │   ├── index.css                 # Tailwind import & global styles
│   │   └── main.jsx                  # App entry point
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js                # Vite config with Tailwind & React plugins
├── .gitignore
└── README.md                         # This file
```

## Getting Started

### Prerequisites

- Node.js >= 18

### Frontend

```bash
cd crm_website_frontend
npm install
npm run dev          # Start dev server (default: http://localhost:5173)
```

### Backend

```bash
cd backend
npm install
npm start
```

### Production Build

```bash
cd crm_website_frontend
npm run build        # Output in crm_website_frontend/dist/
npm run preview      # Preview the production build locally
```

## Usage

1. **Add Agents** — Navigate to *Add Agent* and create team members (5 sample agents are pre-loaded).
2. **Add Leads** — Navigate to *Add Lead* and fill in the client's travel details.
3. **Assign Leads** — On the Dashboard, select an agent from the dropdown on any lead card and click **Confirm**.
4. **Chat Logs** — Click *Chat Log* on a lead card to view or post notes/updates.
5. **Filter & Sort** — Use the search bar, agent filter, and sort dropdown to narrow down leads.
