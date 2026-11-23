import type {
  FinishReason,
  GameMode,
  HeadToHead,
  HeadToHeadMatch,
  HeadToHeadSummary,
  MatchOutcome,
  Team,
} from "@sequence/shared";

export interface SharedGameRow {
  gameId: string;
  mode: GameMode;
  endedAt: number;
  reason: FinishReason | null;
  winnerTeam: Team | null;
  viewerTeam: Team;
  otherTeam: Team;
}

const emptyTally = () => ({ matches: 0, wins: 0, losses: 0, draws: 0 });

const TALLY_KEY = { win: "wins", loss: "losses", draw: "draws" } as const;

/** Builds head-to-head results from finished games both players took part in. */
export function buildHeadToHead(
  opponent: { userId: string; nickname: string },
  games: SharedGameRow[],
  recentLimit = 10,
): HeadToHead {
  const summary: HeadToHeadSummary = {
    versus: emptyTally(),
    together: emptyTally(),
  };
  const matches: HeadToHeadMatch[] = [];

  for (const g of games) {
    const relation = g.viewerTeam === g.otherTeam ? "teammate" : "opponent";
    const outcome: MatchOutcome =
      g.winnerTeam === null
        ? "draw"
        : g.winnerTeam === g.viewerTeam
          ? "win"
          : "loss";
    const tally = relation === "opponent" ? summary.versus : summary.together;
    tally.matches += 1;
    tally[TALLY_KEY[outcome]] += 1;
    matches.push({
      gameId: g.gameId,
      mode: g.mode,
      relation,
      outcome,
      reason: g.reason,
      endedAt: g.endedAt,
    });
  }

  matches.sort((a, b) => b.endedAt - a.endedAt);
  return { opponent, summary, recent: matches.slice(0, recentLimit) };
}
