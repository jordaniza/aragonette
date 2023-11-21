import Blockies from 'react-blockies';
import { VoteCastEvent } from "@/utils/types"
import { formatUnits } from 'viem'
import { formatAddress } from '@/utils/addressHelper'

export default function VotesSection({ votes }: { votes: Array<VoteCastEvent> }) {
  return (
    <div className="grid grid-cols-3 my-12">
      <div className="flex flex-col space-between m-2 gap-4">
        {votes.filter(vote => vote.voteOption === 2).length && votes.filter(vote => vote.voteOption === 2).map(vote => (
          <div className="border border-neutral-300 rounded-2xl py-8 px-6">
            <div className="flex flex-row space-between">
              <div className="flex flex-grow">
                <Blockies
                  className="rounded-3xl"
                  size={13}
                  seed={vote?.voter}
                />
                <div className="px-2">
                  <p className="text-primary-700 font-semibold underline">{formatAddress(vote.voter)}</p>
                  <p className="text-neutral-700 font-semibold">{formatUnits(vote.votingPower, 18)} votes</p>
                </div>
              </div>
              <p className="py-1 px-4 h-9 bg-success-200 text-success-800 font-semibold rounded-xl border border-success-400">For</p>
            </div>
          </div>
        ))
        }
      </div>
      <div className="flex flex-col space-between m-2 gap-4">
        {votes.filter(vote => vote.voteOption === 0).length && votes.filter(vote => vote.voteOption === 0).map(vote => (
          <div className="border border-neutral-300 rounded-2xl py-8 px-6">
            <div className="flex flex-row space-between">
              <div className="flex flex-grow">
                <Blockies
                  className="rounded-3xl"
                  size={13}
                  seed={vote?.voter}
                />
                <div className="px-2">
                  <p className="text-primary-700 font-semibold underline">{formatAddress(vote.voter)}</p>
                  <p className="text-neutral-700 font-semibold">{formatUnits(vote.votingPower, 18)} votes</p>
                </div>
              </div>
              <p className="py-1 px-4 h-9 bg-critical-200 text-critical-800 font-semibold rounded-xl border border-critical-400">Against</p>
            </div>
          </div>
        ))
        }
      </div>
      <div className="flex flex-col space-between m-2 gap-4">
        {votes.filter(vote => vote.voteOption === 1).length && votes.filter(vote => vote.voteOption === 1).map(vote => (
          <div className="border border-neutral-300 rounded-2xl py-8 px-6">
            <div className="flex flex-row space-between">
              <div className="flex flex-grow">
                <Blockies
                  className="rounded-3xl"
                  size={13}
                  seed={vote?.voter}
                />
                <div className="px-2">
                  <p className="text-primary-700 font-semibold underline">{formatAddress(vote.voter)}</p>
                  <p className="text-neutral-700 font-semibold">{formatUnits(vote.votingPower, 18)} votes</p>
                </div>
              </div>
              <p className="py-1 px-4 h-9 bg-neutral-200 text-neutral-800 font-semibold rounded-xl border border-neutral-400">Abstrain</p>
            </div>
          </div>

        ))
        }
      </div>

    </div>
  )
}
