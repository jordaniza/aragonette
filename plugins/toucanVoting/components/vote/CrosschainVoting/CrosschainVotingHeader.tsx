import { AccordionContainer, Card, Heading } from "@aragon/ods";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import React from "react";
import { PUB_CHAIN_NAME, PUB_L2_CHAIN_NAME } from "@/constants";
import { readableChainName } from "@/utils/chains";
import { CrossChainVoting } from "./CrosschainVoting";
import { useL2VotesClosedDueToDelayBuffer } from "@/plugins/toucanVoting/hooks/useDelayBuffer";

dayjs.extend(utc);
dayjs.extend(relativeTime);

export const L2ProposalVoting = ({ proposalId }: { proposalId: string }) => {
  const l1Name = readableChainName(PUB_CHAIN_NAME);
  const l2Name = readableChainName(PUB_L2_CHAIN_NAME);
  const { buffer } = useL2VotesClosedDueToDelayBuffer(proposalId);

  return (
    <Card className="overflow-hidden rounded-xl bg-neutral-0 shadow-neutral">
      {/* Header */}
      <div className="flex flex-col gap-y-2 p-6">
        <Heading size="h2">Crosschain Voting</Heading>
        <p className="text-lg leading-normal text-neutral-500">
          This DAO supports crosschain voting on {l1Name} and {l2Name}. Voters can vote on either, but {l2Name} votes
          must be dispatched back to {l1Name} before they can be recorded.
        </p>
        <p className="text-base italic leading-normal text-neutral-400">
          <span className="text-sm not-italic">⚠️</span> <b>️ Note:</b> {readableChainName(PUB_L2_CHAIN_NAME)} Voting
          closes <b>{(buffer ?? 0) / 60} minutes</b> before {readableChainName(PUB_CHAIN_NAME)} voting to allow for
          bridging.
        </p>
      </div>
      {/* Stages */}
      <AccordionContainer isMulti={false} defaultValue="Stage 1" className="border-t border-t-neutral-100">
        <CrossChainVoting proposalId={proposalId} />
      </AccordionContainer>
    </Card>
  );
};
