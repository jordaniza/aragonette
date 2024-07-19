import {
  PUB_L2_CHAIN,
  PUB_L2_CHAIN_NAME,
  PUB_PAYMASTER_ADDRESS,
  PUB_TOUCAN_VOTING_PLUGIN_L2_ADDRESS,
  PUB_WEB3_ENDPOINT_L2,
} from "@/constants";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Address,
  TransactionReceipt,
  WriteContractParameters,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
} from "viem";
import { eip712WalletActions, getGeneralPaymasterInput } from "viem/zksync";
import { useBalance, useReadContract, useSwitchChain } from "wagmi";
import { AlertContextProps, useAlerts } from "@/context/Alerts";
import { ToucanRelayAbi } from "../artifacts/ToucanRelay.sol";
import { Tally } from "../utils/types";
import { GeneralPaymasterAbi } from "../artifacts/GeneralPaymaster";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";

function handleErr(err: unknown, setError: (err: string) => void, setIsErr: (err: boolean) => void) {
  const castedErr = err as Error;
  setIsErr(true);
  if ("message" in castedErr) setError(castedErr.message);
  else setError("An unknown error occurred");
  console.error(err);
}

type ZkSyncWriteContractArgs = WriteContractParameters & {
  paymaster?: Address;
  paymasterInput?: string;
};

/**
 * As of now only supports the vote function of the ToucanRelay contract with general
 * paymaster (only ETH). We also need to instantiate a separate viem client for zkSync
 * as wagmi hooks do not support the fields requires for paymaster support.
 * Also, this client will not work with Alchemy out the box, so we fetch the injected
 * connector which will typically expose the eth_sendTransaction method.
 */
export function usePaymasterTransaction() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const timeoutSeconds = 30;
  const pollRetriesRef = useRef(0);
  const { addAlert } = useAlerts() as AlertContextProps;
  const { canUse: canUsePaymaster } = useCanUsePaymaster();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();
  const { reload } = useRouter();

  const writeContract = useCallback(
    async (proposalRef: bigint, votingTally: Tally) => {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      setIsSuccess(false);
      setIsSubmitted(false);

      try {
        const request = await window?.ethereum?.request({ method: "eth_requestAccounts" });

        if (!request) {
          throw new Error("Could not make request to connect wallet");
        }

        const [account] = request;

        if (!account) {
          throw new Error("Could not retrieve account");
        }

        await switchChainAsync({ chainId: PUB_L2_CHAIN.id });

        // define the wallet client with the signature extensions
        const walletClient = createWalletClient({
          account,
          chain: PUB_L2_CHAIN,
          transport: custom(window.ethereum),
        }).extend(eip712WalletActions());

        // for now we only support general paymaster (only ETH)
        const paymasterInput = getGeneralPaymasterInput({
          innerInput: "0x",
        });

        const txHash = await walletClient.writeContract({
          account,
          address: PUB_TOUCAN_VOTING_PLUGIN_L2_ADDRESS,
          abi: ToucanRelayAbi,
          functionName: "vote",
          args: [proposalRef, votingTally],
          chain: PUB_L2_CHAIN,
          paymaster: PUB_PAYMASTER_ADDRESS,
          paymasterInput,
        } as ZkSyncWriteContractArgs);

        setTxHash(txHash);
        setIsSubmitted(true);
        pollTx(txHash);
      } catch (err: unknown) {
        handleErr(err, setError, setIsError);
        setIsLoading(false);
      }
    },
    [PUB_L2_CHAIN]
  );

  // Fetch the associated tx hash and poll manually to check for success
  // AfterTimeout, we will consider the transaction failed and show an error
  async function pollTx(txHash: `0x${string}`) {
    const intervalId = setInterval(async () => {
      try {
        const publicClient = createPublicClient({
          chain: PUB_L2_CHAIN,
          transport: http(PUB_WEB3_ENDPOINT_L2),
        });
        let receipt: TransactionReceipt | null = null;
        try {
          receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        } catch (err) {
          console.log({ err });
        }
        if (receipt) {
          setIsSuccess(receipt.status === "success");
          setIsLoading(false);
          clearInterval(intervalId);
        }
      } catch (err) {
        handleErr(err, setError, setIsError);
        setIsLoading(false);
        clearInterval(intervalId);
      } finally {
        pollRetriesRef.current++;
        if (pollRetriesRef.current > timeoutSeconds) {
          clearInterval(intervalId);
          setIsError(true);
          setIsLoading(false);
          setError(`Transaction timed out after ${timeoutSeconds} seconds`);
        }
      }
    }, 1000); // Poll every 1 seconds

    return () => clearInterval(intervalId);
  }

  useEffect(() => {
    if (isError) {
      if (error?.startsWith("User rejected the request")) {
        addAlert("Transaction rejected by the user", {
          timeout: 4 * 1000,
          type: "error",
        });
        return;
      } else {
        addAlert("An error occurred while Voting", {
          type: "error",
          timeout: 4 * 1000,
        });
        return;
      }
    }

    if (isSuccess) {
      addAlert("Vote Cast successfully", {
        type: "success",
        timeout: 4 * 1000,
        txHash: txHash ?? "",
        explorerLinkOverride: `https://explorer.zksync.io/tx/${txHash}`,
      });
      // queryClient.invalidateQueries();
      reload();
      return;
    }

    if (isSubmitted) {
      addAlert("Voting for free via the paymaster", {
        timeout: 4 * 1000,
      });
      return;
    }
  }, [isLoading, isSuccess, isError, txHash, isSubmitted]);

  return {
    writeContract,
    isLoading,
    isSuccess,
    txHash,
    isSubmitted,
    isError,
    error,
    canUsePaymaster,
  };
}

// Our simple paymaster just allows for a single contract
// to be sponsored, so fetch this and you can check it matches
// the L2 voting contract
function useSponsoredContract() {
  const {
    data: address,
    isError,
    isLoading,
  } = useReadContract({
    address: PUB_PAYMASTER_ADDRESS,
    chainId: PUB_L2_CHAIN.id,
    abi: GeneralPaymasterAbi,
    functionName: "sponsoredContract",
    args: [],
    query: {
      enabled: !!PUB_PAYMASTER_ADDRESS,
    },
  });

  return {
    address,
    isError,
    isLoading,
  };
}

export function useCanUsePaymaster() {
  const [canUse, setCanUse] = useState(false);
  const { data: balance, isLoading: balanceLoading } = useBalance({
    address: PUB_PAYMASTER_ADDRESS,
    chainId: PUB_L2_CHAIN.id,
  });
  const { address: sponsoredContract, isLoading: sponsorLoading } = useSponsoredContract();

  useEffect(() => {
    // check if the paymaster is set
    if (!PUB_PAYMASTER_ADDRESS) {
      setCanUse(false);
      return;
    }

    // check the network is zkSync or zkSync sepolia
    if (!["zkSync", "zkSyncSepolia"].includes(PUB_L2_CHAIN_NAME)) {
      setCanUse(false);
      return;
    }

    // check the paymaster has an eth balance of 0.0005, should be enough for a few votes
    if ((balance?.value ?? 0n) < parseEther("0.0005")) {
      setCanUse(false);
      return;
    }

    // check that the paymaster policies allow for the toucan relay contract
    // NOTE: when we move away from my simple paymaster this can be more rigorous
    // but for now we just check the sponsored contract
    if (sponsoredContract !== PUB_TOUCAN_VOTING_PLUGIN_L2_ADDRESS) {
      setCanUse(false);
      return;
    }

    setCanUse(true);
  }, [PUB_L2_CHAIN, PUB_PAYMASTER_ADDRESS, balance, sponsoredContract]);

  return {
    canUse,
    isLoading: balanceLoading || sponsorLoading,
  };
}
