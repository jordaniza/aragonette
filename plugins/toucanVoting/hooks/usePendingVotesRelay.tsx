import { useBlockNumber, usePublicClient, useReadContract } from "wagmi";
import { useProposalRef } from "./useProposalRef";
import { PUB_CHAIN, PUB_L2_CHAIN, PUB_TOUCAN_RECEIVER_ADDRESS, PUB_TOUCAN_VOTING_PLUGIN_L2_ADDRESS } from "@/constants";
import { ToucanRelayAbi } from "../artifacts/ToucanRelay.sol";
import { getAbiItem } from "viem";
import {
  Proposal,
  VotesDispatchedEvent,
  VotesDispatchedResponse,
  VotesReceivedEvent,
  VotesReceivedResponse,
} from "../utils/types";
import { useEffect, useState } from "react";
import { useProposal } from "./useProposal";
import { useRelayVotesList } from "./useProposalVoteList";
import { useQueryClient } from "@tanstack/react-query";
import { ToucanReceiverAbi } from "../artifacts/ToucanReceiver.sol";
import { useRef } from "react";

export function useGetProposalVotesL2(proposalId: number) {
  const { proposalRef } = useProposalRef(proposalId);

  const {
    data: l2Votes,
    isLoading,
    isError,
    queryKey: proposalL2QueryKey,
  } = useReadContract({
    address: PUB_TOUCAN_VOTING_PLUGIN_L2_ADDRESS,
    abi: ToucanRelayAbi,
    chainId: PUB_L2_CHAIN.id,
    functionName: "proposals",
    args: [BigInt(proposalRef ?? 0)],
    query: { enabled: !!proposalRef },
  });

  return {
    l2Votes,
    isLoading,
    isError,
    proposalL2QueryKey,
  };
}

function useRefetch() {
  const watcher = useRef(0);

  function refresh() {
    watcher.current++;
  }

  return { refresh, watcher };
}

const VoteDispatchEvent = getAbiItem({ abi: ToucanRelayAbi, name: "VotesDispatched" });

/// This doesn't work if the message doesn't make it to the receiver
export function useDispatchEvents(proposalId: string, proposal: Proposal | null) {
  const publicClient = usePublicClient({
    chainId: PUB_L2_CHAIN.id,
  });
  const [dispatchLogs, setLogs] = useState<VotesDispatchedEvent[]>([]);
  const { proposalRef } = useProposalRef(Number(proposalId));
  const { refresh, watcher } = useRefetch();

  async function getLogs() {
    if (!proposal?.parameters?.snapshotBlock) return;
    else if (!publicClient) return;

    const logs: VotesDispatchedResponse[] = (await publicClient.getLogs({
      address: PUB_TOUCAN_VOTING_PLUGIN_L2_ADDRESS,
      event: VoteDispatchEvent,
      args: {
        proposalRef,
      },
      // TODO: how can we do this in a performant way given l2 timestamps
      fromBlock: 0n,
      toBlock: "latest",
    })) as any;

    const newLogs = logs.flatMap((log) => log.args);
    if (newLogs.length > dispatchLogs.length) setLogs(newLogs);
  }

  useEffect(() => {
    getLogs();
  }, [proposalId, watcher.current]);

  return { dispatchLogs, refresh };
}

const VotesReceivedAbiEvent = getAbiItem({ abi: ToucanReceiverAbi, name: "VotesReceived" });

/// this is on the receiver, but does not guarantee votes have been submitted on the proposal
export function useVotesReceivedEvents(
  proposalId: number,
  proposal: Proposal | null
): {
  votesReceived: VotesReceivedEvent[] | [];
  refresh: () => void;
} {
  const publicClient = usePublicClient({
    chainId: PUB_CHAIN.id,
  });
  const [votesReceived, setVotesReceived] = useState<VotesReceivedEvent[]>([]);
  const { refresh, watcher } = useRefetch();

  async function getLogs() {
    if (!publicClient || !proposal) return;

    const logs: VotesReceivedResponse[] = (await publicClient.getLogs({
      address: PUB_TOUCAN_RECEIVER_ADDRESS,
      event: VotesReceivedAbiEvent,
      // can't use proposal id as log b/c not indexed
      // fromBlock: proposal?.parameters?.snapshotBlock ?? 0n,
      // some networks mess w. blocks, you'd need to fetch arbitrum blocks
      // for log queries
      fromBlock: 0n,
      toBlock: "latest",
    })) as any;

    const newLogs = logs.flatMap((log) => log.args).filter((f) => Number(f.proposalId) === proposalId);
    if (newLogs.length > votesReceived.length) setVotesReceived(newLogs);
  }

  useEffect(() => {
    getLogs();
  }, [proposalId, proposal?.parameters?.snapshotBlock, watcher.current]);

  return { votesReceived: votesReceived ?? [], refresh };
}

export function useGetPendingVotesOnL2(proposalId: number): {
  refresh: () => void;
  hasPending: boolean;
  pending: { yes: bigint; no: bigint; abstain: bigint };
} {
  const { proposal, proposalQueryKey } = useProposal(proposalId.toString(), true);
  const queryClient = useQueryClient();

  // get the vote list from the relay
  const votes = useRelayVotesList(proposalId.toString(), proposal);

  // get the dispatch events
  const { votesReceived: receipts, refresh: refreshVotesReceived } = useVotesReceivedEvents(proposalId, proposal);

  function refresh() {
    refreshVotesReceived();
    queryClient.invalidateQueries({ queryKey: proposalQueryKey });
  }

  if (!proposal || !votes || !receipts) {
    return {
      refresh,
      hasPending: false,
      pending: { yes: 0n, no: 0n, abstain: 0n },
    };
  }

  // add the votes
  const totalVotes = votes.reduce(
    (prev, curr) => {
      return {
        yes: prev.yes + curr.voteOptions.yes,
        no: prev.no + curr.voteOptions.no,
        abstain: prev.abstain + curr.voteOptions.abstain,
      };
    },
    { yes: 0n, no: 0n, abstain: 0n }
  );

  const lastReceipt = receipts[receipts.length - 1];

  // if this total is different from the last dispatch, we have pending votes
  const pending = {
    yes: totalVotes.yes - (lastReceipt?.votes.yes ?? 0n),
    no: totalVotes.no - (lastReceipt?.votes.no ?? 0n),
    abstain: totalVotes.abstain - (lastReceipt?.votes.abstain ?? 0n),
  };

  return {
    refresh,
    hasPending: pending.yes !== 0n || pending.no !== 0n || pending.abstain !== 0n,
    pending,
  };
}
