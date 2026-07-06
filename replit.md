# Transformatiive Financial Dashboard

## Overview
Internal financial operations dashboard for Transformatiive Lda. Built with React (Vite) frontend and Express backend.

## Architecture
- **Frontend**: React 18 + Vite, served on port 5000 (dev)
- **Backend**: Express.js on port 3000; proxied by Vite in dev
- **Auth**: URL access token (`?token=…`) — no login page, sent as Bearer on API calls
- **Credentials**: Auto-loaded from a remote credential vault at startup (`https://trnsf.up.railway.app/webhook/credential-vault`)

## Running the App
```
npm run dev
```
Runs server and Vite client concurrently. Workflow: "Start application"

## Key Services
- `server/services/vault.js` — fetches credentials from the Transformatiive vault
- `server/services/zoho-books.js` / `zoho-partner.js` — Zoho Books & Partner API integration
- `server/services/moloni.js` — Moloni invoicing integration
- `server/api/dashboard.js` — aggregates financial data for the dashboard
- `server/api/analysis.js` — AI-powered streaming analysis via Anthropic Claude
- `server/config.js` — fixed costs, annual goals, monthly client contracts

## Environment
All credentials are fetched from the vault automatically. Override via `.env` if needed (see `.env.example`).

- `ACCESS_TOKEN` defaults to `trnsf-fin-2026-a7f3c9e14b` (URL token; override in Secrets)
- `ANTHROPIC_API_KEY` must be set manually (not in vault)

## Deployment
```
npm run build && npm start
```
Builds the React client to `client/dist/`, then Express serves it statically.
