import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionDocument } from './transaction.schema'; // Adjust path

@Injectable()
export class TransactionPnlService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly TransactionModel: Model<TransactionDocument>,
  ) {}

  async calculateBscTokenPnl(wallet: string): Promise<
    {
      tokenAddress: string;
      tokenName: string;
      tokenSymbol: string;
      totalBuys: number;
      totalSells: number;
      totalTokenBought: string;
      totalTokenBoughtUSD: number;
      totalTokenSold: string;
      totalTokenSoldUSD: number;
      pnlUSD: number;
    }[]
  > {
    try {
      // Fetch all BSC transactions for the given wallet
      const transactions = await this.TransactionModel.find({
        wallet: wallet.toLowerCase(),
        chain: 'bsc',
      }).exec();

      if (!transactions || transactions.length === 0) {
        throw new NotFoundException(
          `No BSC transactions found for wallet ${wallet}`,
        );
      }

      // Group transactions by token and calculate PNL
      const tokenMap: {
        [key: string]: {
          tokenName: string;
          tokenSymbol: string;
          totalBuys: number;
          totalSells: number;
          totalTokenBought: number;
          totalTokenBoughtUSD: number;
          totalTokenSold: number;
          totalTokenSoldUSD: number;
        };
      } = {};

      transactions.forEach((tx) => {
        // Handle token out (sell)
        if (tx.tokenOutAddress) {
          const tokenAddress = tx.tokenOutAddress.toLowerCase();
          if (!tokenMap[tokenAddress]) {
            tokenMap[tokenAddress] = {
              tokenName: tx.tokenOutName || 'Unknown',
              tokenSymbol: tx.tokenOutSymbol || 'Unknown',
              totalBuys: 0,
              totalSells: 0,
              totalTokenBought: 0,
              totalTokenBoughtUSD: 0,
              totalTokenSold: 0,
              totalTokenSoldUSD: 0,
            };
          }
          const amount = parseFloat(tx.tokenOutAmount) || 0;
          const usd = parseFloat(tx.tokenOutAmountUsd) || 0;
          tokenMap[tokenAddress].totalSells += 1;
          tokenMap[tokenAddress].totalTokenSold += amount;
          tokenMap[tokenAddress].totalTokenSoldUSD += usd;
        }

        // Handle token in (buy)
        if (tx.tokenInAddress) {
          const tokenAddress = tx.tokenInAddress.toLowerCase();
          if (!tokenMap[tokenAddress]) {
            tokenMap[tokenAddress] = {
              tokenName: tx.tokenInName || 'Unknown',
              tokenSymbol: tx.tokenInSymbol || 'Unknown',
              totalBuys: 0,
              totalSells: 0,
              totalTokenBought: 0,
              totalTokenBoughtUSD: 0,
              totalTokenSold: 0,
              totalTokenSoldUSD: 0,
            };
          }
          const amount = parseFloat(tx.tokenInAmount) || 0;
          const usd = parseFloat(tx.tokenInAmountUsd) || 0;
          tokenMap[tokenAddress].totalBuys += 1;
          tokenMap[tokenAddress].totalTokenBought += amount;
          tokenMap[tokenAddress].totalTokenBoughtUSD += usd;
        }
      });

      // Convert tokenMap to array and calculate PNL
      const pnlResults = Object.keys(tokenMap).map((tokenAddress) => {
        const token = tokenMap[tokenAddress];
        const pnlUSD = token.totalTokenSoldUSD - token.totalTokenBoughtUSD;

        return {
          tokenAddress,
          tokenName: token.tokenName,
          tokenSymbol: token.tokenSymbol,
          totalBuys: token.totalBuys,
          totalSells: token.totalSells,
          totalTokenBought: token.totalTokenBought.toFixed(6), // String with 6 decimals
          totalTokenBoughtUSD: parseFloat(token.totalTokenBoughtUSD.toFixed(2)),
          totalTokenSold: token.totalTokenSold.toFixed(6), // String with 6 decimals
          totalTokenSoldUSD: parseFloat(token.totalTokenSoldUSD.toFixed(2)),
          pnlUSD: parseFloat(pnlUSD.toFixed(2)),
        };
      });

      // Filter out tokens with no activity (optional)
      return pnlResults.filter(
        (result) => result.totalBuys > 0 || result.totalSells > 0,
      );
    } catch (error: any) {
      console.error('Error calculating BSC token PNL:', error.message || error);
      throw error;
    }
  }
}
