import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
} from 'src/database/schemas/transactions.schema';

@Injectable()
export class TrackerService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly TransactionModel: Model<TransactionDocument>,
  ) {}

  async calculateUserTokensPnl(
    wallet: string,
    chain: string,
    tokens: string[],
    timeFilter: 'all' | '1' | '3' | '7' | '14' | '30' = 'all',
  ): Promise<
    {
      tokenAddress: string;
      tokenName: string;
      tokenSymbol: string;
      tradeCount: number;
      totalBuys: number;
      totalSells: number;
      totalBuyTokenAmount: string;
      buyTokenName: string;
      buyTokenSymbol: string;
      totalBuyTokenAmountUSD: string; // New field
      totalSellTokenAmount: string;
      sellTokenName: string;
      sellTokenSymbol: string;
      totalSellTokenAmountUSD: string; // New field
      tokenNetAmount: string;
      pnlUSD: string;
      pnlPercentage: number;
      avgBuyTimeSeconds: number;
      avgSellTimeSeconds: number;
    }[]
  > {
    try {
      if (!chain) {
        throw new NotFoundException('Chain parameter is required');
      }
      if (!tokens || tokens.length === 0) {
        throw new NotFoundException('At least one token address is required');
      }

      const tokenAddresses = tokens.map((token) => token.toLowerCase());
      const daysMap = { '1': 1, '3': 3, '7': 7, '14': 14, '30': 30 };
      const days = daysMap[timeFilter];
      const cutoffDate = days
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        : null;

      const query: any = {
        wallet: wallet.toLowerCase(),
        chain: chain.toLowerCase(),
        $or: [
          { tokenInAddress: { $in: tokenAddresses } },
          { tokenOutAddress: { $in: tokenAddresses } },
        ],
      };
      if (timeFilter !== 'all') {
        query.blockTimestamp = { $gte: cutoffDate };
      }

      const transactions = await this.TransactionModel.find(query).exec();
      if (!transactions || transactions.length === 0) {
        throw new NotFoundException(
          `No transactions found for wallet ${wallet} on chain ${chain} for the specified tokens${timeFilter !== 'all' ? ` in the last ${days} days` : ''}`,
        );
      }

      const tokenMap: {
        [key: string]: {
          tokenName: string;
          tokenSymbol: string;
          totalBuys: number;
          totalSells: number;
          totalTokenBought: number;
          totalTokenBoughtUSD: number;
          totalBuyTokenAmount: number;
          totalBuyTokenAmountUSD: number; // New field
          buyTokenName: string;
          buyTokenSymbol: string;
          totalTokenSold: number;
          totalTokenSoldUSD: number;
          totalSellTokenAmount: number;
          totalSellTokenAmountUSD: number; // New field
          sellTokenName: string;
          sellTokenSymbol: string;
          buyTimeSum: number;
          sellTimeSum: number;
        };
      } = {};

      tokenAddresses.forEach((tokenAddress) => {
        tokenMap[tokenAddress] = {
          tokenName: 'Unknown',
          tokenSymbol: 'Unknown',
          totalBuys: 0,
          totalSells: 0,
          totalTokenBought: 0,
          totalTokenBoughtUSD: 0,
          totalBuyTokenAmount: 0,
          totalBuyTokenAmountUSD: 0, // Initialize new field
          buyTokenName: 'Unknown',
          buyTokenSymbol: 'Unknown',
          totalTokenSold: 0,
          totalTokenSoldUSD: 0,
          totalSellTokenAmount: 0,
          totalSellTokenAmountUSD: 0, // Initialize new field
          sellTokenName: 'Unknown',
          sellTokenSymbol: 'Unknown',
          buyTimeSum: 0,
          sellTimeSum: 0,
        };
      });

      transactions.forEach((tx) => {
        const txTimestamp = new Date(tx.blockTimestamp).getTime();
        const tokenAddress = tokenAddresses.find(
          (addr) =>
            addr === tx.tokenInAddress?.toLowerCase() ||
            addr === tx.tokenOutAddress?.toLowerCase(),
        );

        if (!tokenAddress) return;

        const tokenData = tokenMap[tokenAddress];

        if (
          tx.type === 'buy' &&
          tx.tokenInAddress?.toLowerCase() === tokenAddress
        ) {
          tokenData.tokenName = tx.tokenInName || 'Unknown';
          tokenData.tokenSymbol = tx.tokenInSymbol || 'Unknown';
          const amountBought = Math.abs(parseFloat(tx.tokenInAmount) || 0);
          const usdBought = Math.abs(parseFloat(tx.tokenInAmountUsd) || 0);
          const amountSpent = Math.abs(parseFloat(tx.tokenOutAmount) || 0);
          const usdSpent = Math.abs(parseFloat(tx.tokenOutAmountUsd) || 0); // USD value of token spent
          tokenData.totalBuys += 1;
          tokenData.totalTokenBought += amountBought;
          tokenData.totalTokenBoughtUSD += usdBought;
          tokenData.totalBuyTokenAmount += amountSpent;
          tokenData.totalBuyTokenAmountUSD += usdSpent; // Accumulate USD spent
          tokenData.buyTokenName = tx.tokenOutName || 'Unknown';
          tokenData.buyTokenSymbol = tx.tokenOutSymbol || 'Unknown';
          const buyTimeDiff = (Date.now() - txTimestamp) / 1000;
          tokenData.buyTimeSum += buyTimeDiff;
        } else if (
          tx.type === 'sell' &&
          tx.tokenOutAddress?.toLowerCase() === tokenAddress
        ) {
          tokenData.tokenName = tx.tokenOutName || 'Unknown';
          tokenData.tokenSymbol = tx.tokenOutSymbol || 'Unknown';
          const amountSold = Math.abs(parseFloat(tx.tokenOutAmount) || 0);
          const usdSold = Math.abs(parseFloat(tx.tokenOutAmountUsd) || 0);
          const amountReceived = Math.abs(parseFloat(tx.tokenInAmount) || 0);
          const usdReceived = Math.abs(parseFloat(tx.tokenInAmountUsd) || 0); // USD value of token received
          tokenData.totalSells += 1;
          tokenData.totalTokenSold += amountSold;
          tokenData.totalTokenSoldUSD += usdSold;
          tokenData.totalSellTokenAmount += amountReceived;
          tokenData.totalSellTokenAmountUSD += usdReceived; // Accumulate USD received
          tokenData.sellTokenName = tx.tokenInName || 'Unknown';
          tokenData.sellTokenSymbol = tx.tokenInSymbol || 'Unknown';
          const sellTimeDiff = (Date.now() - txTimestamp) / 1000;
          tokenData.sellTimeSum += sellTimeDiff;
        }
      });

      const pnlResults = Object.keys(tokenMap).map((tokenAddress) => {
        const token = tokenMap[tokenAddress];
        const tradeCount = token.totalBuys + token.totalSells;
        const tokenNetAmount = token.totalTokenBought - token.totalTokenSold;

        // Prorate the bought USD to the sold portion
        const soldProportion =
          token.totalTokenBought !== 0
            ? token.totalTokenSold / token.totalTokenBought
            : 0;
        const proratedBoughtUSD = token.totalTokenBoughtUSD * soldProportion;
        const pnlUSD = token.totalTokenSoldUSD - proratedBoughtUSD;
        const pnlPercentage =
          proratedBoughtUSD !== 0 ? (pnlUSD / proratedBoughtUSD) * 100 : 0;

        const avgBuyTimeSeconds =
          token.totalBuys > 0 ? token.buyTimeSum / token.totalBuys : 0;
        const avgSellTimeSeconds =
          token.totalSells > 0 ? token.sellTimeSum / token.totalSells : 0;

        return {
          tokenAddress,
          tokenName: token.tokenName,
          tokenSymbol: token.tokenSymbol,
          tradeCount,
          totalBuys: token.totalBuys,
          totalSells: token.totalSells,
          totalBuyTokenAmount: token.totalBuyTokenAmount.toFixed(6),
          buyTokenName: token.buyTokenName,
          buyTokenSymbol: token.buyTokenSymbol,
          totalBuyTokenAmountUSD: token.totalBuyTokenAmountUSD.toFixed(2), // New field
          totalSellTokenAmount: token.totalSellTokenAmount.toFixed(6),
          sellTokenName: token.sellTokenName,
          sellTokenSymbol: token.sellTokenSymbol,
          totalSellTokenAmountUSD: token.totalSellTokenAmountUSD.toFixed(2), // New field
          tokenNetAmount: tokenNetAmount.toFixed(6),
          pnlUSD: pnlUSD.toFixed(2),
          pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
          avgBuyTimeSeconds: parseFloat(avgBuyTimeSeconds.toFixed(2)),
          avgSellTimeSeconds: parseFloat(avgSellTimeSeconds.toFixed(2)),
        };
      });

      return pnlResults;
    } catch (error: any) {
      console.error(
        'Error calculating user token PNL:',
        error.message || error,
      );
      throw error;
    }
  }
}
