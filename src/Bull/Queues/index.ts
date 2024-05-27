import { Matches } from "./matches.queue";
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Reminder } from "./reminder.queue";
// import { Badge } from "./badge.queue";
import { PairMatches } from "./pair-matches.queue";
import { SingleMatches } from "./pair-script.queue";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/bull");

const BullBoard = createBullBoard({
  queues: [new BullAdapter(Reminder), new BullAdapter(Matches), new BullAdapter(PairMatches), /* new BullAdapter(Badge) **/],
  serverAdapter: serverAdapter,
});

export { serverAdapter };
