import { PUB_L2_CHAIN, PUB_TOUCAN_VOTING_PLUGIN_L2_ADDRESS } from "@/constants";
import { ToucanRelayAbi } from "../artifacts/ToucanRelay.sol";
import { useReadContract } from "wagmi";
import { useProposal } from "./useProposal";

export function useBridgeDelayBuffer() {
  return useReadContract({
    address: PUB_TOUCAN_VOTING_PLUGIN_L2_ADDRESS,
    abi: ToucanRelayAbi,
    chainId: PUB_L2_CHAIN.id,
    functionName: "buffer",
  });
}

export function useL2VotesClosedDueToDelayBuffer(proposalId: string) {
  const { data: buffer } = useBridgeDelayBuffer();

  // the data will be a timestamp and represents the time before the proposal officially ends
  // where it will be closed
  const { proposal } = useProposal(proposalId);
  const endDate = BigInt(proposal?.parameters?.endDate ?? 0);
  const endDateSubBuffer = endDate - BigInt(buffer ?? 0);

  return {
    buffer,
    endDateSubBuffer,
    endDate,
    isClosed: Number(endDateSubBuffer) < Date.now() / 1000,
  };
}
