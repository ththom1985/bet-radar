-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Fixture" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "apiFootballId" INTEGER,
    "oddsEventId" TEXT,
    "leagueId" INTEGER NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "kickoff" DATETIME NOT NULL,
    "season" INTEGER NOT NULL,
    "round" TEXT,
    "status" TEXT NOT NULL,
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    CONSTRAINT "Fixture_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Fixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Fixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Fixture" ("apiFootballId", "awayGoals", "awayTeamId", "homeGoals", "homeTeamId", "id", "kickoff", "leagueId", "round", "season", "status") SELECT "apiFootballId", "awayGoals", "awayTeamId", "homeGoals", "homeTeamId", "id", "kickoff", "leagueId", "round", "season", "status" FROM "Fixture";
DROP TABLE "Fixture";
ALTER TABLE "new_Fixture" RENAME TO "Fixture";
CREATE UNIQUE INDEX "Fixture_apiFootballId_key" ON "Fixture"("apiFootballId");
CREATE UNIQUE INDEX "Fixture_oddsEventId_key" ON "Fixture"("oddsEventId");
CREATE INDEX "Fixture_leagueId_kickoff_idx" ON "Fixture"("leagueId", "kickoff");
CREATE INDEX "Fixture_status_idx" ON "Fixture"("status");
CREATE TABLE "new_Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "apiFootballId" INTEGER,
    "leagueId" INTEGER NOT NULL,
    CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("apiFootballId", "id", "leagueId", "name") SELECT "apiFootballId", "id", "leagueId", "name" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_apiFootballId_key" ON "Team"("apiFootballId");
CREATE INDEX "Team_leagueId_idx" ON "Team"("leagueId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
