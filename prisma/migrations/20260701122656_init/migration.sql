-- CreateTable
CREATE TABLE "League" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "apiFootballId" INTEGER NOT NULL,
    "oddsApiKey" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "apiFootballId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "apiFootballId" INTEGER NOT NULL,
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

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fixtureId" INTEGER NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "homeOdds" REAL NOT NULL,
    "drawOdds" REAL NOT NULL,
    "awayOdds" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OddsSnapshot_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fixtureId" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "expHomeGoals" REAL NOT NULL,
    "expAwayGoals" REAL NOT NULL,
    "pHome" REAL NOT NULL,
    "pDraw" REAL NOT NULL,
    "pAway" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValueBet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fixtureId" INTEGER NOT NULL,
    "selection" TEXT NOT NULL,
    "modelProb" REAL NOT NULL,
    "bestOdds" REAL NOT NULL,
    "impliedProb" REAL NOT NULL,
    "edge" REAL NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValueBet_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "League_apiFootballId_key" ON "League"("apiFootballId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_apiFootballId_key" ON "Team"("apiFootballId");

-- CreateIndex
CREATE INDEX "Team_leagueId_idx" ON "Team"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_apiFootballId_key" ON "Fixture"("apiFootballId");

-- CreateIndex
CREATE INDEX "Fixture_leagueId_kickoff_idx" ON "Fixture"("leagueId", "kickoff");

-- CreateIndex
CREATE INDEX "Fixture_status_idx" ON "Fixture"("status");

-- CreateIndex
CREATE INDEX "OddsSnapshot_fixtureId_idx" ON "OddsSnapshot"("fixtureId");

-- CreateIndex
CREATE INDEX "Prediction_fixtureId_idx" ON "Prediction"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_fixtureId_model_key" ON "Prediction"("fixtureId", "model");

-- CreateIndex
CREATE INDEX "ValueBet_fixtureId_idx" ON "ValueBet"("fixtureId");

-- CreateIndex
CREATE INDEX "ValueBet_edge_idx" ON "ValueBet"("edge");
