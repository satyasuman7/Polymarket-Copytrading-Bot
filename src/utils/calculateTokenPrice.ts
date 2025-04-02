import { BN } from "@coral-xyz/anchor";
import { TEST_INIT_BONDING_CURVE } from "./constants";

export const toBig = (value: number, decimals: number): BN => {
  return new BN(value).mul(new BN(10 ** decimals));
};

export const fromBig = (value: BN, decimals: number): number => {
  return value.div(new BN(10 ** decimals)).toNumber();
};

export const calculateTokenPrice = (
  tokenReserves: BN,
  lamportReserves: BN,
  tokenDecimals: number,
  solPriceinUSD: number
): number => {
  const tokenReservesNum = fromBig(tokenReserves, tokenDecimals);
  const lamportReservesNum = fromBig(lamportReserves, 9);
  return (solPriceinUSD * lamportReservesNum) / tokenReservesNum;
};

export const calculateMarketCap = (
  tokenReserves: BN,
  decimals: number,
  tokenPrice: number
): number => {
  const tokenReservesNum = fromBig(tokenReserves, decimals);
  const circulatingSupply = (tokenReservesNum * TEST_INIT_BONDING_CURVE) / 100;

  return circulatingSupply * tokenPrice;
};
