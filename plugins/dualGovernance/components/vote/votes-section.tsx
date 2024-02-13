import Blockies from "react-blockies";
import { VetoCastEvent } from "@/plugins/dualGovernance/utils/types";
import { formatUnits } from "viem";
import { AddressText } from "@/components/text/address";
import { Card, Tag } from '@aragon/ods'

export default function VotesSection({ vetoes }: { vetoes: Array<VetoCastEvent> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 mt-4 mb-14 gap-4">
      <div>
        <div className="grid gap-2">
          {vetoes.map((vote, i) => (
            <VoteCard key={i} vote={vote} />
          ))}
        </div>
      </div>
    </div>
  );
}

const VoteCard = function({ vote }: { vote: VetoCastEvent; }) {
  return (
    <Card className="p-3">
      <div className="flex flex-row space-between">
        <div className="flex flex-grow">
          <Blockies className="rounded-3xl" size={9} seed={vote?.voter} />
          <div className="px-2">
            <AddressText>{vote.voter}</AddressText>
            <p className="text-neutral-600 text-sm">
              {formatUnits(vote.votingPower, 18)} votes
            </p>
          </div>
        </div>
        <Tag
          className="!text-sm"
          variant="critical"
          label="Veto"
        />
      </div>
    </Card>
  );
};
