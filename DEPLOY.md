# Bet-Radar online stellen (Vercel + Neon)

Lokal läuft alles mit **SQLite**. Für den Live-Betrieb braucht es **Postgres** (Neon),
weil Vercel-Server keine dauerhafte SQLite-Datei haben. Der Build ist bereits vorbereitet
(`postinstall: prisma generate`, alle Seiten dynamisch).

> Diese Schritte brauchen **deine** Accounts (GitHub, Neon, Vercel) — Claude kann sie nicht
> für dich anlegen. Wenn du den Neon-Connection-String hast, kann Claude den Postgres-Umbau
> (Schema + Migration + Daten befüllen) übernehmen.

## 1. GitHub-Repo anlegen
```bash
# im bet-radar-Ordner
gh repo create bet-radar --private --source=. --remote=origin --push
# oder manuell ein Repo auf github.com anlegen und pushen
```

## 2. Neon-Datenbank (kostenlos)
1. https://neon.tech → registrieren → neues Projekt.
2. Connection-String kopieren (Format: `postgresql://user:pass@host/db?sslmode=require`).

## 3. Auf Postgres umstellen (macht Claude, wenn String da ist)
- In `prisma/schema.prisma`: `provider = "sqlite"` → `provider = "postgresql"`.
- Alte SQLite-Migrationen löschen (`prisma/migrations/*`), dann:
```bash
DATABASE_URL="postgresql://…" npx prisma migrate dev --name init_pg
```
- DB befüllen (gegen Neon):
```bash
DATABASE_URL="postgresql://…" npm run sync
DATABASE_URL="postgresql://…" npm run intl
DATABASE_URL="postgresql://…" npm run explain
```

## 4. Vercel
1. https://vercel.com → „Add New Project" → GitHub-Repo importieren.
2. **Environment Variables** setzen (aus deiner `.env`):
   - `DATABASE_URL` = Neon-String
   - `API_FOOTBALL_KEY`, `ODDS_API_KEY`, `ANTHROPIC_API_KEY`, `FOOTBALL_DATA_ORG_KEY`
3. „Deploy". Fertig — die App ist unter einer `*.vercel.app`-URL erreichbar.

## 5. Daten aktuell halten
Die Skripte (`sync`/`intl`/`explain`) laufen **nicht** automatisch auf Vercel. Optionen:
- Lokal per Hand / geplanter Task (Windows Aufgabenplanung) gegen die Neon-DB laufen lassen.
- Oder später ein GitHub-Action-Cron einrichten, das die Skripte 1×/Tag ausführt.

## Kosten
Alles im Gratis-Rahmen: Neon Free, Vercel Hobby. Einzige laufende Kosten: der
Anthropic-API-Key (Cent-Beträge pro `explain`-Lauf).
