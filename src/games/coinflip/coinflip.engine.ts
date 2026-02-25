import {secureRandomInt} from '../../utils/random.js';
import {COINFLIP_CONFIG} from '../../config/games.js';

export type CoinSide = 'heads' | 'tails';

export interface CoinflipResult {
  outcome: CoinSide;
  playerChoice: CoinSide;
  won: boolean;
  multiplier: number;
}

export function flipCoin(): CoinSide {
  return secureRandomInt(0, 1) === 0 ? 'heads' : 'tails';
}

export function playCoinflip(playerChoice: CoinSide): CoinflipResult {
  const outcome = flipCoin();
  const won = outcome === playerChoice;
  return {
    outcome,
    playerChoice,
    won,
    multiplier: won ? COINFLIP_CONFIG.payout : 0,
  };
}
