import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/database/schemas/user.schema';
import { TransactionDto } from 'src/socket/dto/transaction.dto';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { Call } from 'src/database/schemas/moralisCalls.schema';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Mutex } from 'async-mutex';
import { TrackerService } from 'src/tracker/tracker.service';

interface TokenPnlResult {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tradeCount: number;
  totalBuys: number;
  totalSells: number;
  totalBaseTokenSpent: string; // WBNB/WETH spent to buy
  totalBaseTokenSpentUSD: string; // USD value of base token spent
  totalTokenBought: string; // Total tokens bought
  totalTokenBoughtUSD: string; // USD value of tokens bought
  totalTokenSold: string; // Total tokens sold
  totalTokenSoldUSD: string; // USD value of tokens sold
  totalBaseTokenReceived: string; // WBNB/WETH received from selling
  totalBaseTokenReceivedUSD: string; // USD value of base token received
  tokenNetAmount: string; // (Bought - Sold) token balance
  baseTokenPnl: string; // Profit/Loss in base token (WBNB/WETH)
  realizedPnlUSD: string; // Profit/Loss in USD
  realizedPnlPercentage: number; // Percentage gain/loss
  avgBuyTimeSeconds: number;
  avgSellTimeSeconds: number;
}

interface PnlLeaderboardEntry {
  name: string;
  wallet: string;
  twitter: string;
  telegram: string;
  website: string;
  chains: string[];
  imageUrl: string;
  pnlSummary: {
    totalTradesCount: number;
    profitableTrades: number;
    losingTrades: number;
    totalBaseTokenInvested: string; // Total WETH/WBNB spent
    totalBaseTokenInvestedUSD: string; // USD value of investments
    totalBaseTokenRealized: string; // Total WETH/WBNB received
    totalBaseTokenRealizedUSD: string; // USD value of realized gains
    baseTokenGain: string; // Realized - Invested (net ETH/BNB)
    baseTokenGainUSD: string; // USD value of net gain
    totalPnlPercentage: number; // ROI percentage
    totalBuys: number;
    totalSells: number;
  };
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly apiKeyMutex = new Mutex();
  constructor(
    private readonly httpService: HttpService,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(Transaction.name)
    private readonly TransactionModel: Model<Transaction>,
    @InjectModel(Call.name) private readonly CallModel: Model<Call>,
    private readonly trackerService: TrackerService,
  ) {}

  private readonly apiKeys = [
    process.env.MORALIS_API_1,
    process.env.MORALIS_API_2,
    process.env.MORALIS_API_3,
    process.env.MORALIS_API_4,
    process.env.MORALIS_API_5,
    process.env.MORALIS_API_6,
    process.env.MORALIS_API_7,
    process.env.MORALIS_API_8,
    process.env.MORALIS_API_9,
    process.env.MORALIS_API_10,
    process.env.MORALIS_API_11,
    process.env.MORALIS_API_12,
    process.env.MORALIS_API_13,
    process.env.MORALIS_API_14,
    process.env.MORALIS_API_15,
    process.env.MORALIS_API_16,
    process.env.MORALIS_API_17,
    process.env.MORALIS_API_18,
    process.env.MORALIS_API_19,
    process.env.MORALIS_API_20,
    process.env.MORALIS_API_21,
    process.env.MORALIS_API_22,
    process.env.MORALIS_API_23,
    process.env.MORALIS_API_24,
    process.env.MORALIS_API_25,
    process.env.MORALIS_API_26,
    process.env.MORALIS_API_27,
    process.env.MORALIS_API_28,
    process.env.MORALIS_API_29,
    process.env.MORALIS_API_30,
    process.env.MORALIS_API_31,
    process.env.MORALIS_API_32,
    process.env.MORALIS_API_33,
    process.env.MORALIS_API_34,
    process.env.MORALIS_API_35,
    process.env.MORALIS_API_36,
    process.env.MORALIS_API_37,
    process.env.MORALIS_API_38,
    process.env.MORALIS_API_39,
    process.env.MORALIS_API_40,
    process.env.MORALIS_API_41,
    process.env.MORALIS_API_42,
    process.env.MORALIS_API_43,
    process.env.MORALIS_API_44,
    process.env.MORALIS_API_45,
    process.env.MORALIS_API_46,
    process.env.MORALIS_API_47,
    process.env.MORALIS_API_48,
    process.env.MORALIS_API_49,
    process.env.MORALIS_API_50,
  ].filter(Boolean);

  private getCutoffDate(timeFilter: string): string | null {
    const daysMap = { '1': 1, '3': 3, '7': 7, '14': 14, '30': 30 };
    if (timeFilter === 'all') return null;

    const days = daysMap[timeFilter] || 0;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  private createEmptyLeaderboardEntry(user: any): PnlLeaderboardEntry {
    return {
      name: user.name || 'Unknown',
      wallet: user.wallet,
      twitter: user.twitter || '',
      telegram: user.telegram || '',
      website: user.website || '',
      chains: user.chains || [],
      imageUrl: user.imageUrl || '',
      pnlSummary: {
        totalTradesCount: 0,
        profitableTrades: 0,
        losingTrades: 0,
        totalBaseTokenInvested: '0.000000',
        totalBaseTokenInvestedUSD: '0.00',
        totalBaseTokenRealized: '0.000000',
        totalBaseTokenRealizedUSD: '0.00',
        baseTokenGain: '0.000000',
        baseTokenGainUSD: '0.00',
        totalPnlPercentage: 0,
        totalBuys: 0,
        totalSells: 0,
      },
    };
  }

  // Create a new user
  async newUser(userDto: UserDto): Promise<UserDto> {
    try {
      // Check if user with this wallet already exists
      const existingUser = await this.UserModel.findOne({
        wallet: userDto.wallet.toLowerCase(),
      });
      if (existingUser) {
        return {
          name: existingUser.name,
          wallet: existingUser.wallet,
          twitter: existingUser.twitter,
          telegram: existingUser.telegram,
          website: existingUser.website,
          chains: existingUser.chains,
          imageUrl: existingUser.imageUrl,
          temporal: existingUser.temporal,
        };
      }

      // Create new user
      const newUser = new this.UserModel({
        name: userDto.name,
        wallet: userDto.wallet.toLowerCase(),
        twitter: userDto.twitter,
        telegram: userDto.telegram,
        website: userDto.website,
        chains: userDto.chains,
        imageUrl: userDto.imageUrl,
        profit: userDto.profit || '0',
        loss: userDto.loss || '0',
        temporal: userDto.temporal || false,
      });

      const savedUser = await newUser.save();

      // Return DTO
      return {
        name: savedUser.name,
        wallet: savedUser.wallet,
        twitter: savedUser.twitter,
        telegram: savedUser.telegram,
        website: savedUser.website,
        chains: savedUser.chains,
        imageUrl: savedUser.imageUrl,
        temporal: savedUser.temporal,
      };
    } catch (error: any) {
      console.error('Error saving user:', error.message || error);
      throw error; // Re-throw to be handled by the controller
    }
  }

  // Update an existing user
  async updateUser(
    wallet: string,
    userDto: Partial<UserDto>,
  ): Promise<UserDto> {
    try {
      const user = await this.UserModel.findOne({
        wallet: wallet.toLowerCase(),
      });
      if (!user) {
        throw new NotFoundException(`User with wallet ${wallet} not found`);
      }

      // Update fields only if provided in the DTO
      if (userDto.name !== undefined) user.name = userDto.name;
      if (userDto.twitter !== undefined) user.twitter = userDto.twitter;
      if (userDto.telegram !== undefined) user.telegram = userDto.telegram;
      if (userDto.website !== undefined) user.website = userDto.website;
      if (userDto.profit !== undefined) user.profit = userDto.profit;
      if (userDto.loss !== undefined) user.loss = userDto.loss;
      if (userDto.imageUrl !== undefined) user.imageUrl = userDto.imageUrl;
      if (userDto.chains !== undefined) user.chains = userDto.chains;

      const updatedUser = await user.save();

      return {
        name: updatedUser.name,
        wallet: updatedUser.wallet,
        twitter: updatedUser.twitter,
        telegram: updatedUser.telegram,
        website: updatedUser.website,
        chains: updatedUser.chains,
        imageUrl: updatedUser.imageUrl,
      };
    } catch (error: any) {
      console.error('Error updating user:', error.message || error);
      throw error;
    }
  }

  // Delete a user by wallet address
  async deleteUser(wallet: string): Promise<{ message: string }> {
    try {
      const user = await this.UserModel.findOne({
        wallet: wallet.toLowerCase(),
      });
      if (!user) {
        throw new NotFoundException(`User with wallet ${wallet} not found`);
      }

      await user.deleteOne(); // or user.remove() depending on your Mongoose version

      // Step 3: Delete all transactions associated with this wallet
      await this.TransactionModel.deleteMany({
        wallet: wallet.toLowerCase(),
      }).exec();

      return { message: `User with wallet ${wallet} deleted successfully` };
    } catch (error: any) {
      console.error('Error deleting user:', error.message || error);
      throw error;
    }
  }

  // Fetch all users
  async getAllUsers(): Promise<UserDto[]> {
    try {
      const users = await this.UserModel.find().exec();
      return users.map((user) => ({
        name: user.name,
        wallet: user.wallet,
        twitter: user.twitter,
        telegram: user.telegram,
        website: user.website,
        chains: user.chains,
        imageUrl: user.imageUrl,
      }));
    } catch (error: any) {
      console.error('Error fetching all users:', error.message || error);
      throw error;
    }
  }

  // Fetch a single user by wallet
  async getUser(wallet: string): Promise<UserDto> {
    try {
      const user = await this.UserModel.findOne({
        wallet: wallet.toLowerCase(),
      }).exec();
      if (!user) {
        throw new NotFoundException(`User with wallet ${wallet} not found`);
      }

      return {
        name: user.name,
        wallet: user.wallet,
        twitter: user.twitter,
        telegram: user.telegram,
        website: user.website,
        chains: user.chains,
        imageUrl: user.imageUrl,
      };
    } catch (error: any) {
      console.error('Error fetching user:', error.message || error);
      throw error;
    }
  }

  async getAUsersTransactions(
    walletAddress: string,
    chain?: string, // Optional chain parameter
    limit: number = 50, // Optional limit parameter with default of 50
  ): Promise<TransactionDto[]> {
    try {
      // Ensure limit doesn't exceed 50
      const cappedLimit = Math.min(limit, 50);

      // Build the query object
      const query: any = {
        wallet: walletAddress.toLowerCase(),
      };

      // If chain is provided, add it to the query
      if (chain) {
        query.chain = chain;
      }

      const transactions = await this.TransactionModel.find(query)
        .sort({ blockTimestamp: -1 }) // Sort by timestamp, descending (newest first)
        .limit(cappedLimit) // Use the capped limit
        .exec();

      if (!transactions || transactions.length === 0) {
        console.log(
          `No transactions found for wallet: ${walletAddress}` +
            (chain ? ` on chain: ${chain}` : ''),
        );
        return []; // Return empty array if no transactions
      }

      // Map transactions to TransactionDto
      return transactions.map((tx) => ({
        wallet: tx.wallet,
        chain: tx.chain,
        type: tx.type,
        txHash: tx.txHash,
        txIndex: tx.txIndex,
        blockTimestamp: tx.blockTimestamp,
        tokenOutSymbol: tx.tokenOutSymbol,
        tokenOutName: tx.tokenOutName,
        tokenOutLogo: tx.tokenOutLogo,
        tokenOutAddress: tx.tokenOutAddress,
        tokenOutAmount: tx.tokenOutAmount,
        tokenOutAmountUsd: tx.tokenOutAmountUsd,
        tokenInSymbol: tx.tokenInSymbol,
        tokenInName: tx.tokenInName,
        tokenInLogo: tx.tokenInLogo,
        tokenInAddress: tx.tokenInAddress,
        tokenInAmount: tx.tokenInAmount,
        tokenInAmountUsd: tx.tokenInAmountUsd,
      }));
    } catch (error: any) {
      console.error(
        'Error fetching transactions for wallet:',
        walletAddress,
        chain ? `on chain: ${chain}` : '',
        `limit: ${limit}`,
        error.message || error,
      );
      throw error;
    }
  }

  async getAllUsersWithTransactions(
    chain?: string,
    limit: number = 50,
  ): Promise<
    {
      name: string;
      wallet: string;
      twitter: string;
      telegram: string;
      website: string;
      chains: string[];
      imageUrl: string;
      transactions: TransactionDto[];
    }[]
  > {
    try {
      // Cap the limit at 50
      const cappedLimit = Math.min(limit, 50);

      // Fetch all users from UserModel
      const users = await this.UserModel.find().exec();

      if (!users || users.length === 0) {
        console.log('No users found');
        return [];
      }

      // Build the base query for transactions
      const query: any = {};
      if (chain) {
        query.chain = chain;
      }

      // Fetch transactions for each user
      const userPromises = users.map(async (user) => {
        const transactions = await this.TransactionModel.find({
          ...query,
          wallet: user.wallet.toLowerCase(),
        })
          .sort({ blockTimestamp: -1 })
          .limit(cappedLimit)
          .exec();

        return {
          name: user.name,
          wallet: user.wallet,
          twitter: user.twitter,
          telegram: user.telegram,
          website: user.website,
          chains: user.chains,
          imageUrl: user.imageUrl,
          transactions: transactions.map((tx) => ({
            wallet: tx.wallet,
            chain: tx.chain,
            type: tx.type,
            txHash: tx.txHash,
            txIndex: tx.txIndex,
            blockTimestamp: tx.blockTimestamp,
            tokenOutSymbol: tx.tokenOutSymbol,
            tokenOutName: tx.tokenOutName,
            tokenOutLogo: tx.tokenOutLogo,
            tokenOutAddress: tx.tokenOutAddress,
            tokenOutAmount: tx.tokenOutAmount,
            tokenOutAmountUsd: tx.tokenOutAmountUsd,
            tokenInSymbol: tx.tokenInSymbol,
            tokenInName: tx.tokenInName,
            tokenInLogo: tx.tokenInLogo,
            tokenInAddress: tx.tokenInAddress,
            tokenInAmount: tx.tokenInAmount,
            tokenInAmountUsd: tx.tokenInAmountUsd,
          })),
        };
      });

      const results = await Promise.all(userPromises);

      // Optionally filter out users with no transactions
      const filteredResults = results.filter(
        (result) => result.transactions.length > 0,
      );

      if (filteredResults.length === 0) {
        console.log(
          `No transactions found${chain ? ` for chain: ${chain}` : ''}`,
        );
        return [];
      }

      return filteredResults;
    } catch (error: any) {
      console.error(
        'Error fetching all users with transactions:',
        chain ? `chain: ${chain}` : '',
        `limit: ${limit}`,
        error.message || error,
      );
      throw error;
    }
  }

  // async calculateUserTokensPnl(
  //   wallet: string,
  //   chain: string,
  //   tokens: string[],
  //   timeFilter: 'all' | '1' | '3' | '7' | '14' | '30' = 'all',
  // ): Promise<
  //   {
  //     tokenAddress: string;
  //     tokenName: string;
  //     tokenSymbol: string;
  //     tradeCount: number;
  //     totalBuys: number;
  //     totalSells: number;
  //     totalBuyTokenAmount: string;
  //     buyTokenName: string;
  //     buyTokenSymbol: string;
  //     totalBuyTokenAmountUSD: string; // New field
  //     totalSellTokenAmount: string;
  //     sellTokenName: string;
  //     sellTokenSymbol: string;
  //     totalSellTokenAmountUSD: string; // New field
  //     tokenNetAmount: string;
  //     pnlUSD: string;
  //     pnlPercentage: number;
  //     avgBuyTimeSeconds: number;
  //     avgSellTimeSeconds: number;
  //   }[]
  // > {
  //   try {
  //     if (!chain) {
  //       throw new NotFoundException('Chain parameter is required');
  //     }
  //     if (!tokens || tokens.length === 0) {
  //       throw new NotFoundException('At least one token address is required');
  //     }

  //     const tokenAddresses = tokens.map((token) => token.toLowerCase());
  //     const daysMap = { '1': 1, '3': 3, '7': 7, '14': 14, '30': 30 };
  //     const days = daysMap[timeFilter];
  //     const cutoffDate = days
  //       ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  //       : null;

  //     const query: any = {
  //       wallet: wallet.toLowerCase(),
  //       chain: chain.toLowerCase(),
  //       $or: [
  //         { tokenInAddress: { $in: tokenAddresses } },
  //         { tokenOutAddress: { $in: tokenAddresses } },
  //       ],
  //     };
  //     if (timeFilter !== 'all') {
  //       query.blockTimestamp = { $gte: cutoffDate };
  //     }

  //     const transactions = await this.TransactionModel.find(query).exec();
  //     if (!transactions || transactions.length === 0) {
  //       throw new NotFoundException(
  //         `No transactions found for wallet ${wallet} on chain ${chain} for the specified tokens${timeFilter !== 'all' ? ` in the last ${days} days` : ''}`,
  //       );
  //     }

  //     const tokenMap: {
  //       [key: string]: {
  //         tokenName: string;
  //         tokenSymbol: string;
  //         totalBuys: number;
  //         totalSells: number;
  //         totalTokenBought: number;
  //         totalTokenBoughtUSD: number;
  //         totalBuyTokenAmount: number;
  //         totalBuyTokenAmountUSD: number; // New field
  //         buyTokenName: string;
  //         buyTokenSymbol: string;
  //         totalTokenSold: number;
  //         totalTokenSoldUSD: number;
  //         totalSellTokenAmount: number;
  //         totalSellTokenAmountUSD: number; // New field
  //         sellTokenName: string;
  //         sellTokenSymbol: string;
  //         buyTimeSum: number;
  //         sellTimeSum: number;
  //       };
  //     } = {};

  //     tokenAddresses.forEach((tokenAddress) => {
  //       tokenMap[tokenAddress] = {
  //         tokenName: 'Unknown',
  //         tokenSymbol: 'Unknown',
  //         totalBuys: 0,
  //         totalSells: 0,
  //         totalTokenBought: 0,
  //         totalTokenBoughtUSD: 0,
  //         totalBuyTokenAmount: 0,
  //         totalBuyTokenAmountUSD: 0, // Initialize new field
  //         buyTokenName: 'Unknown',
  //         buyTokenSymbol: 'Unknown',
  //         totalTokenSold: 0,
  //         totalTokenSoldUSD: 0,
  //         totalSellTokenAmount: 0,
  //         totalSellTokenAmountUSD: 0, // Initialize new field
  //         sellTokenName: 'Unknown',
  //         sellTokenSymbol: 'Unknown',
  //         buyTimeSum: 0,
  //         sellTimeSum: 0,
  //       };
  //     });

  //     transactions.forEach((tx) => {
  //       const txTimestamp = new Date(tx.blockTimestamp).getTime();
  //       const tokenAddress = tokenAddresses.find(
  //         (addr) =>
  //           addr === tx.tokenInAddress?.toLowerCase() ||
  //           addr === tx.tokenOutAddress?.toLowerCase(),
  //       );

  //       if (!tokenAddress) return;

  //       const tokenData = tokenMap[tokenAddress];

  //       if (
  //         tx.type === 'buy' &&
  //         tx.tokenInAddress?.toLowerCase() === tokenAddress
  //       ) {
  //         tokenData.tokenName = tx.tokenInName || 'Unknown';
  //         tokenData.tokenSymbol = tx.tokenInSymbol || 'Unknown';
  //         const amountBought = Math.abs(parseFloat(tx.tokenInAmount) || 0);
  //         const usdBought = Math.abs(parseFloat(tx.tokenInAmountUsd) || 0);
  //         const amountSpent = Math.abs(parseFloat(tx.tokenOutAmount) || 0);
  //         const usdSpent = Math.abs(parseFloat(tx.tokenOutAmountUsd) || 0); // USD value of token spent
  //         tokenData.totalBuys += 1;
  //         tokenData.totalTokenBought += amountBought;
  //         tokenData.totalTokenBoughtUSD += usdBought;
  //         tokenData.totalBuyTokenAmount += amountSpent;
  //         tokenData.totalBuyTokenAmountUSD += usdSpent; // Accumulate USD spent
  //         tokenData.buyTokenName = tx.tokenOutName || 'Unknown';
  //         tokenData.buyTokenSymbol = tx.tokenOutSymbol || 'Unknown';
  //         const buyTimeDiff = (Date.now() - txTimestamp) / 1000;
  //         tokenData.buyTimeSum += buyTimeDiff;
  //       } else if (
  //         tx.type === 'sell' &&
  //         tx.tokenOutAddress?.toLowerCase() === tokenAddress
  //       ) {
  //         tokenData.tokenName = tx.tokenOutName || 'Unknown';
  //         tokenData.tokenSymbol = tx.tokenOutSymbol || 'Unknown';
  //         const amountSold = Math.abs(parseFloat(tx.tokenOutAmount) || 0);
  //         const usdSold = Math.abs(parseFloat(tx.tokenOutAmountUsd) || 0);
  //         const amountReceived = Math.abs(parseFloat(tx.tokenInAmount) || 0);
  //         const usdReceived = Math.abs(parseFloat(tx.tokenInAmountUsd) || 0); // USD value of token received
  //         tokenData.totalSells += 1;
  //         tokenData.totalTokenSold += amountSold;
  //         tokenData.totalTokenSoldUSD += usdSold;
  //         tokenData.totalSellTokenAmount += amountReceived;
  //         tokenData.totalSellTokenAmountUSD += usdReceived; // Accumulate USD received
  //         tokenData.sellTokenName = tx.tokenInName || 'Unknown';
  //         tokenData.sellTokenSymbol = tx.tokenInSymbol || 'Unknown';
  //         const sellTimeDiff = (Date.now() - txTimestamp) / 1000;
  //         tokenData.sellTimeSum += sellTimeDiff;
  //       }
  //     });

  //     const pnlResults = Object.keys(tokenMap).map((tokenAddress) => {
  //       const token = tokenMap[tokenAddress];
  //       const tradeCount = token.totalBuys + token.totalSells;
  //       const tokenNetAmount = token.totalTokenBought - token.totalTokenSold;

  //       // Prorate the bought USD to the sold portion
  //       const soldProportion =
  //         token.totalTokenBought !== 0
  //           ? token.totalTokenSold / token.totalTokenBought
  //           : 0;
  //       const proratedBoughtUSD = token.totalTokenBoughtUSD * soldProportion;
  //       const pnlUSD = token.totalTokenSoldUSD - proratedBoughtUSD;
  //       const pnlPercentage =
  //         proratedBoughtUSD !== 0 ? (pnlUSD / proratedBoughtUSD) * 100 : 0;

  //       const avgBuyTimeSeconds =
  //         token.totalBuys > 0 ? token.buyTimeSum / token.totalBuys : 0;
  //       const avgSellTimeSeconds =
  //         token.totalSells > 0 ? token.sellTimeSum / token.totalSells : 0;

  //       return {
  //         tokenAddress,
  //         tokenName: token.tokenName,
  //         tokenSymbol: token.tokenSymbol,
  //         tradeCount,
  //         totalBuys: token.totalBuys,
  //         totalSells: token.totalSells,
  //         totalBuyTokenAmount: token.totalBuyTokenAmount.toFixed(6),
  //         buyTokenName: token.buyTokenName,
  //         buyTokenSymbol: token.buyTokenSymbol,
  //         totalBuyTokenAmountUSD: token.totalBuyTokenAmountUSD.toFixed(2), // New field
  //         totalSellTokenAmount: token.totalSellTokenAmount.toFixed(6),
  //         sellTokenName: token.sellTokenName,
  //         sellTokenSymbol: token.sellTokenSymbol,
  //         totalSellTokenAmountUSD: token.totalSellTokenAmountUSD.toFixed(2), // New field
  //         tokenNetAmount: tokenNetAmount.toFixed(6),
  //         pnlUSD: pnlUSD.toFixed(2),
  //         pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
  //         avgBuyTimeSeconds: parseFloat(avgBuyTimeSeconds.toFixed(2)),
  //         avgSellTimeSeconds: parseFloat(avgSellTimeSeconds.toFixed(2)),
  //       };
  //     });

  //     return pnlResults;
  //   } catch (error: any) {
  //     console.error(
  //       'Error calculating user token PNL:',
  //       error.message || error,
  //     );
  //     throw error;
  //   }
  // }

  // async calculateUserTokensPnl(
  //   wallet: string,
  //   chain: string,
  //   tokens: string[],
  //   timeFilter: 'all' | '1' | '3' | '7' | '14' | '30' = 'all',
  // ): Promise<TokenPnlResult[]> {
  //   // Validate inputs
  //   if (!chain) throw new NotFoundException('Chain parameter is required');
  //   if (!tokens?.length)
  //     throw new NotFoundException('At least one token address is required');

  //   // Determine base token symbol based on chain
  //   const baseTokenSymbol = chain.toLowerCase() === 'bsc' ? 'WBNB' : 'WETH';

  //   // Calculate cutoff date if time filter is specified
  //   const daysMap = { '1': 1, '3': 3, '7': 7, '14': 14, '30': 30 };
  //   const days = daysMap[timeFilter];
  //   const cutoffDate = days
  //     ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  //     : null;

  //   // Build query to fetch relevant transactions
  //   const query: any = {
  //     wallet: wallet.toLowerCase(),
  //     chain: chain.toLowerCase(),
  //     $or: [
  //       { tokenOutAddress: { $in: tokens.map((t) => t.toLowerCase()) } },
  //       { tokenInAddress: { $in: tokens.map((t) => t.toLowerCase()) } },
  //     ],
  //   };

  //   if (timeFilter !== 'all') {
  //     query.blockTimestamp = { $gte: cutoffDate };
  //   }

  //   // Fetch transactions from database
  //   const transactions = await this.TransactionModel.find(query).exec();
  //   if (!transactions.length) {
  //     throw new NotFoundException(
  //       `No transactions found for wallet ${wallet} on chain ${chain} for the specified tokens${timeFilter !== 'all' ? ` in the last ${days} days` : ''}`,
  //     );
  //   }

  //   // Process transactions for each token
  //   return tokens.map((tokenAddress) => {
  //     const tokenLower = tokenAddress.toLowerCase();
  //     const tokenTransactions = transactions.filter(
  //       (tx) =>
  //         tx.tokenInAddress?.toLowerCase() === tokenLower ||
  //         tx.tokenOutAddress?.toLowerCase() === tokenLower,
  //     );

  //     // Initialize data structure for this token
  //     const tokenData = {
  //       tokenName: 'Unknown',
  //       tokenSymbol: 'Unknown',
  //       totalBuys: 0,
  //       totalSells: 0,
  //       totalBaseTokenSpent: 0, // WBNB/WETH spent to buy
  //       totalBaseTokenSpentUSD: 0, // USD value of base token spent
  //       totalTokenBought: 0, // Total tokens bought
  //       totalTokenBoughtUSD: 0, // USD value of tokens bought
  //       totalTokenSold: 0, // Total tokens sold
  //       totalTokenSoldUSD: 0, // USD value of tokens sold
  //       totalBaseTokenReceived: 0, // WBNB/WETH received from selling
  //       totalBaseTokenReceivedUSD: 0, // USD value of base token received
  //       totalCostBasisUSD: 0, // Total USD spent buying all tokens
  //       buyTimeSum: 0,
  //       sellTimeSum: 0,
  //     };

  //     // Process each transaction
  //     tokenTransactions.forEach((tx) => {
  //       const txTimestamp = new Date(tx.blockTimestamp).getTime();
  //       const isBuy =
  //         tx.type === 'buy' &&
  //         tx.tokenInAddress?.toLowerCase() === tokenLower &&
  //         tx.tokenOutSymbol === baseTokenSymbol;

  //       const isSell =
  //         tx.type === 'sell' &&
  //         tx.tokenOutAddress?.toLowerCase() === tokenLower &&
  //         tx.tokenInSymbol === baseTokenSymbol;

  //       if (isBuy) {
  //         // Process buy transaction
  //         tokenData.tokenName = tx.tokenInName || 'Unknown';
  //         tokenData.tokenSymbol = tx.tokenInSymbol || 'Unknown';
  //         tokenData.totalBuys += 1;

  //         const amountBought = Math.abs(parseFloat(tx.tokenInAmount) || 0);
  //         const amountSpent = Math.abs(parseFloat(tx.tokenOutAmount) || 0);
  //         const usdValue = Math.abs(parseFloat(tx.tokenInAmountUsd) || 0);

  //         tokenData.totalTokenBought += amountBought;
  //         tokenData.totalTokenBoughtUSD += usdValue;
  //         tokenData.totalBaseTokenSpent += amountSpent;
  //         tokenData.totalBaseTokenSpentUSD += Math.abs(
  //           parseFloat(tx.tokenOutAmountUsd) || 0,
  //         );
  //         tokenData.totalCostBasisUSD += usdValue;
  //         tokenData.buyTimeSum += (Date.now() - txTimestamp) / 1000;
  //       } else if (isSell) {
  //         // Process sell transaction
  //         tokenData.tokenName = tx.tokenOutName || 'Unknown';
  //         tokenData.tokenSymbol = tx.tokenOutSymbol || 'Unknown';
  //         tokenData.totalSells += 1;

  //         const amountSold = Math.abs(parseFloat(tx.tokenOutAmount) || 0);
  //         const amountReceived = Math.abs(parseFloat(tx.tokenInAmount) || 0);
  //         const usdValue = Math.abs(parseFloat(tx.tokenOutAmountUsd) || 0);

  //         tokenData.totalTokenSold += amountSold;
  //         tokenData.totalTokenSoldUSD += usdValue;
  //         tokenData.totalBaseTokenReceived += amountReceived;
  //         tokenData.totalBaseTokenReceivedUSD += Math.abs(
  //           parseFloat(tx.tokenInAmountUsd) || 0,
  //         );
  //         tokenData.buyTimeSum += (Date.now() - txTimestamp) / 1000;
  //       }
  //     });

  //     // Calculate derived metrics
  //     const tradeCount = tokenData.totalBuys + tokenData.totalSells;
  //     const tokenNetAmount =
  //       tokenData.totalTokenBought - tokenData.totalTokenSold;

  //     // Base Token PnL (WBNB/WETH)
  //     const baseTokenPnl =
  //       tokenData.totalBaseTokenReceived - tokenData.totalBaseTokenSpent;

  //     // USD PnL Calculations
  //     const soldProportion =
  //       tokenData.totalTokenBought > 0
  //         ? tokenData.totalTokenSold / tokenData.totalTokenBought
  //         : 0;
  //     const costBasisForSoldTokens =
  //       tokenData.totalCostBasisUSD * soldProportion;
  //     const realizedPnlUSD =
  //       tokenData.totalTokenSoldUSD - costBasisForSoldTokens;

  //     // Percentage calculations
  //     const realizedPnlPercentage =
  //       costBasisForSoldTokens > 0
  //         ? (realizedPnlUSD / costBasisForSoldTokens) * 100
  //         : 0;

  //     return {
  //       tokenAddress,
  //       tokenName: tokenData.tokenName,
  //       tokenSymbol: tokenData.tokenSymbol,
  //       tradeCount,
  //       totalBuys: tokenData.totalBuys,
  //       totalSells: tokenData.totalSells,
  //       totalBaseTokenSpent: tokenData.totalBaseTokenSpent.toFixed(6),
  //       totalBaseTokenSpentUSD: tokenData.totalBaseTokenSpentUSD.toFixed(2),
  //       totalTokenBought: tokenData.totalTokenBought.toFixed(6),
  //       totalTokenBoughtUSD: tokenData.totalTokenBoughtUSD.toFixed(2),
  //       totalTokenSold: tokenData.totalTokenSold.toFixed(6),
  //       totalTokenSoldUSD: tokenData.totalTokenSoldUSD.toFixed(2),
  //       totalBaseTokenReceived: tokenData.totalBaseTokenReceived.toFixed(6),
  //       totalBaseTokenReceivedUSD:
  //         tokenData.totalBaseTokenReceivedUSD.toFixed(2),
  //       tokenNetAmount: tokenNetAmount.toFixed(6),
  //       baseTokenPnl: baseTokenPnl.toFixed(6),
  //       realizedPnlUSD: realizedPnlUSD.toFixed(2),
  //       realizedPnlPercentage: parseFloat(realizedPnlPercentage.toFixed(2)),
  //       avgBuyTimeSeconds: parseFloat(
  //         (tokenData.totalBuys > 0
  //           ? tokenData.buyTimeSum / tokenData.totalBuys
  //           : 0
  //         ).toFixed(2),
  //       ),
  //       avgSellTimeSeconds: parseFloat(
  //         (tokenData.totalSells > 0
  //           ? tokenData.sellTimeSum / tokenData.totalSells
  //           : 0
  //         ).toFixed(2),
  //       ),
  //     };
  //   });
  // }

  async calculateUserTokensPnl(
    wallet: string,
    chain: string,
    tokens: string[],
    timeFilter: 'all' | '1' | '3' | '7' | '14' | '30' = 'all',
  ): Promise<TokenPnlResult[]> {
    // Validate inputs
    if (!chain) throw new NotFoundException('Chain parameter is required');
    if (!tokens?.length)
      throw new NotFoundException('At least one token address is required');

    // Determine base token symbol based on chain
    const baseTokenSymbol = chain.toLowerCase() === 'bsc' ? 'WBNB' : 'WETH';

    // Calculate cutoff date in ISO format if time filter is specified
    const daysMap = { '1': 1, '3': 3, '7': 7, '14': 14, '30': 30 };
    const cutoffDate =
      timeFilter !== 'all'
        ? new Date(
            Date.now() - daysMap[timeFilter] * 24 * 60 * 60 * 1000,
          ).toISOString()
        : null;

    // Build query with ISO timestamp filtering
    const query: any = {
      wallet: wallet.toLowerCase(),
      chain: chain.toLowerCase(),
      $or: [
        { tokenOutAddress: { $in: tokens.map((t) => t.toLowerCase()) } },
        { tokenInAddress: { $in: tokens.map((t) => t.toLowerCase()) } },
      ],
      ...(cutoffDate && { blockTimestamp: { $gte: cutoffDate } }),
    };

    // Fetch transactions from database
    const transactions = await this.TransactionModel.find(query).exec();
    if (!transactions.length) {
      throw new NotFoundException(
        `No transactions found for wallet ${wallet} on chain ${chain} for the specified tokens${timeFilter !== 'all' ? ` in the last ${daysMap[timeFilter]} days` : ''}`,
      );
    }

    // Process transactions for each token
    return tokens.map((tokenAddress) => {
      const tokenLower = tokenAddress.toLowerCase();
      const tokenTransactions = transactions.filter(
        (tx) =>
          tx.tokenInAddress?.toLowerCase() === tokenLower ||
          tx.tokenOutAddress?.toLowerCase() === tokenLower,
      );

      const tokenData = {
        tokenName: 'Unknown',
        tokenSymbol: 'Unknown',
        totalBuys: 0,
        totalSells: 0,
        totalBaseTokenSpent: 0,
        totalBaseTokenSpentUSD: 0,
        totalTokenBought: 0,
        totalTokenBoughtUSD: 0,
        totalTokenSold: 0,
        totalTokenSoldUSD: 0,
        totalBaseTokenReceived: 0,
        totalBaseTokenReceivedUSD: 0,
        totalCostBasisUSD: 0,
        buyTimeSum: 0,
        sellTimeSum: 0,
      };

      tokenTransactions.forEach((tx) => {
        // Parse ISO timestamp to calculate holding periods
        const txTimestamp = new Date(tx.blockTimestamp).getTime();
        const isBuy =
          tx.type === 'buy' &&
          tx.tokenInAddress?.toLowerCase() === tokenLower &&
          tx.tokenOutSymbol === baseTokenSymbol;

        const isSell =
          tx.type === 'sell' &&
          tx.tokenOutAddress?.toLowerCase() === tokenLower &&
          tx.tokenInSymbol === baseTokenSymbol;

        if (isBuy) {
          tokenData.tokenName = tx.tokenInName || 'Unknown';
          tokenData.tokenSymbol = tx.tokenInSymbol || 'Unknown';
          tokenData.totalBuys += 1;

          const amountBought = Math.abs(parseFloat(tx.tokenInAmount) || 0);
          const amountSpent = Math.abs(parseFloat(tx.tokenOutAmount) || 0);
          const usdValue = Math.abs(parseFloat(tx.tokenInAmountUsd) || 0);

          tokenData.totalTokenBought += amountBought;
          tokenData.totalTokenBoughtUSD += usdValue;
          tokenData.totalBaseTokenSpent += amountSpent;
          tokenData.totalBaseTokenSpentUSD += Math.abs(
            parseFloat(tx.tokenOutAmountUsd) || 0,
          );
          tokenData.totalCostBasisUSD += usdValue;
          tokenData.buyTimeSum += (Date.now() - txTimestamp) / 1000;
        } else if (isSell) {
          tokenData.tokenName = tx.tokenOutName || 'Unknown';
          tokenData.tokenSymbol = tx.tokenOutSymbol || 'Unknown';
          tokenData.totalSells += 1;

          const amountSold = Math.abs(parseFloat(tx.tokenOutAmount) || 0);
          const amountReceived = Math.abs(parseFloat(tx.tokenInAmount) || 0);
          const usdValue = Math.abs(parseFloat(tx.tokenOutAmountUsd) || 0);

          tokenData.totalTokenSold += amountSold;
          tokenData.totalTokenSoldUSD += usdValue;
          tokenData.totalBaseTokenReceived += amountReceived;
          tokenData.totalBaseTokenReceivedUSD += Math.abs(
            parseFloat(tx.tokenInAmountUsd) || 0,
          );
          tokenData.sellTimeSum += (Date.now() - txTimestamp) / 1000;
        }
      });

      // Calculate derived metrics
      const tradeCount = tokenData.totalBuys + tokenData.totalSells;
      const tokenNetAmount =
        tokenData.totalTokenBought - tokenData.totalTokenSold;

      // Base Token PnL (WBNB/WETH)
      const baseTokenPnl =
        tokenData.totalBaseTokenReceived - tokenData.totalBaseTokenSpent;

      // USD PnL Calculations
      const soldProportion =
        tokenData.totalTokenBought > 0
          ? tokenData.totalTokenSold / tokenData.totalTokenBought
          : 0;
      const costBasisForSoldTokens =
        tokenData.totalCostBasisUSD * soldProportion;
      const realizedPnlUSD =
        tokenData.totalTokenSoldUSD - costBasisForSoldTokens;

      // Percentage calculations
      const realizedPnlPercentage =
        costBasisForSoldTokens > 0
          ? (realizedPnlUSD / costBasisForSoldTokens) * 100
          : 0;

      return {
        tokenAddress,
        tokenName: tokenData.tokenName,
        tokenSymbol: tokenData.tokenSymbol,
        tradeCount,
        totalBuys: tokenData.totalBuys,
        totalSells: tokenData.totalSells,
        totalBaseTokenSpent: tokenData.totalBaseTokenSpent.toFixed(6),
        totalBaseTokenSpentUSD: tokenData.totalBaseTokenSpentUSD.toFixed(2),
        totalTokenBought: tokenData.totalTokenBought.toFixed(6),
        totalTokenBoughtUSD: tokenData.totalTokenBoughtUSD.toFixed(2),
        totalTokenSold: tokenData.totalTokenSold.toFixed(6),
        totalTokenSoldUSD: tokenData.totalTokenSoldUSD.toFixed(2),
        totalBaseTokenReceived: tokenData.totalBaseTokenReceived.toFixed(6),
        totalBaseTokenReceivedUSD:
          tokenData.totalBaseTokenReceivedUSD.toFixed(2),
        tokenNetAmount: tokenNetAmount.toFixed(6),
        baseTokenPnl: baseTokenPnl.toFixed(6),
        realizedPnlUSD: realizedPnlUSD.toFixed(2),
        realizedPnlPercentage: parseFloat(realizedPnlPercentage.toFixed(2)),
        avgBuyTimeSeconds: parseFloat(
          (tokenData.totalBuys > 0
            ? tokenData.buyTimeSum / tokenData.totalBuys
            : 0
          ).toFixed(2),
        ),
        avgSellTimeSeconds: parseFloat(
          (tokenData.totalSells > 0
            ? tokenData.sellTimeSum / tokenData.totalSells
            : 0
          ).toFixed(2),
        ),
      };
    });
  }

  async getUserTopHoldings(
    wallet: string,
    chain: string,
  ): Promise<
    {
      tokenAddress: string;
      tokenName: string;
      tokenSymbol: string;
      tokenBalance: string;
      tokenBalanceUSD: number;
    }[]
  > {
    const maxAttempts = this.apiKeys.length;
    let attempts = 0;
    let initialKeyIndex: number;

    while (attempts < maxAttempts) {
      let apiKeyDoc = await this.CallModel.findOne();
      if (!apiKeyDoc) {
        apiKeyDoc = new this.CallModel({ call: 0 });
        await apiKeyDoc.save();
      }
      let currentKeyIndex = apiKeyDoc.call;
      if (attempts === 0) initialKeyIndex = currentKeyIndex; // Store initial index
      const currentApiKey = this.apiKeys[currentKeyIndex];

      if (!currentApiKey) {
        throw new Error('No valid Moralis API key available');
      }

      try {
        if (!chain) {
          throw new BadRequestException(`Unsupported chain`);
        }

        const topHoldingsUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${wallet}/tokens`;
        const params = { chain: chain, exclude_spam: true, limit: 15 };

        const response = await this.httpService.axiosRef.get(topHoldingsUrl, {
          params: params,
          headers: { 'X-API-Key': currentApiKey },
        });
        const results = response.data.result || [];

        return results.map((token) => ({
          tokenAddress: token.token_address,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          tokenBalance: token.balance_formatted,
          tokenBalanceUSD: token.usd_value,
        }));
      } catch (error: any) {
        const errorMessage = error.response?.data?.message;
        if (
          errorMessage ===
            'Validation service blocked: Your plan: free-plan-daily total included usage has been consumed, please upgrade your plan here, https://moralis.io/pricing' ||
          errorMessage === 'SUPPORT BLOCKED: Please contact support@moralis.io'
        ) {
          apiKeyDoc = await this.CallModel.findOne();
          currentKeyIndex = apiKeyDoc.call;
          const keyWasUpdated = currentKeyIndex !== initialKeyIndex;

          if (keyWasUpdated && attempts === 0) {
            attempts++;
            continue; // Retry with the externally updated key
          }

          await this.apiKeyMutex.runExclusive(async () => {
            apiKeyDoc = await this.CallModel.findOne();
            currentKeyIndex = apiKeyDoc.call;

            if (currentKeyIndex < maxAttempts - 1) {
              currentKeyIndex += 1;
            } else {
              currentKeyIndex = 0;
              console.log(
                'All API keys exhausted in getUserTopHoldings, resetting index to 0',
              );
              await this.trackerService.sendChatMessage(
                'All API keys exhausted in getUserTopHoldings, resetting index to 0',
              );
            }
            await this.CallModel.updateOne({}, { call: currentKeyIndex });
            console.log(
              `API key updated to index ${currentKeyIndex} in getUserTopHoldings`,
            );
            await this.trackerService.sendChatMessage(
              `API key updated to index ${currentKeyIndex} in getUserTopHoldings`,
            );
          });
          attempts++;
        } else {
          console.error(
            'Error fetching user top holdings:',
            error.message || error,
          );
          throw error;
        }
      }
    }

    throw new Error(
      `Failed to fetch top holdings for wallet ${wallet} on chain ${chain} after ${maxAttempts} attempts`,
    );
  }

  async getPnlLeaderBoard(chain: string): Promise<
    {
      name: string;
      wallet: string;
      twitter: string;
      telegram: string;
      website: string;
      chains: string[];
      imageUrl: string;
      pnlSummary: {
        totalTradesCount: number;
        totalPnlUSD: string;
        totalPnlPercentage: number;
        totalBuys: number;
        totalSells: number;
        totalBuysUSD: string;
        totalSellsUSD: string;
      };
    }[]
  > {
    try {
      if (!chain) {
        throw new BadRequestException('Chain parameter is required');
      }

      const users = await this.UserModel.find().exec();
      if (!users || users.length === 0) {
        console.log('No users found');
        return [];
      }

      if (this.apiKeys.length === 0) {
        throw new Error('No valid Moralis API keys available');
      }

      const defaultPnlSummary = {
        totalTradesCount: 0,
        totalPnlUSD: '0',
        totalPnlPercentage: 0,
        totalBuys: 0,
        totalSells: 0,
        totalBuysUSD: '0',
        totalSellsUSD: '0',
      };

      const pnlPromises = users.map(async (user) => {
        const url = `https://deep-index.moralis.io/api/v2.2/wallets/${user.wallet}/profitability/summary`;
        const params = { chain: chain };
        const maxAttempts = this.apiKeys.length;
        let attempts = 0;
        let initialKeyIndex: number;

        while (attempts < maxAttempts) {
          let apiKeyDoc = await this.CallModel.findOne();
          if (!apiKeyDoc) {
            apiKeyDoc = new this.CallModel({ call: 0 });
            await apiKeyDoc.save();
          }
          let currentKeyIndex = apiKeyDoc.call;
          if (attempts === 0) initialKeyIndex = currentKeyIndex; // Store initial index
          const currentApiKey = this.apiKeys[currentKeyIndex];

          try {
            const response = await firstValueFrom(
              this.httpService.get(url, {
                params,
                headers: { 'X-API-Key': currentApiKey },
              }),
            );
            const summary = response.data || {};

            return {
              name: user.name || 'Unknown',
              wallet: user.wallet,
              twitter: user.twitter || '',
              telegram: user.telegram || '',
              website: user.website || '',
              chains: user.chains || [],
              imageUrl: user.imageUrl || '',
              pnlSummary: {
                totalTradesCount: summary.total_count_of_trades || 0,
                totalPnlUSD: summary.total_realized_profit_usd || '0',
                totalPnlPercentage:
                  summary.total_realized_profit_percentage || 0,
                totalBuys: summary.total_buys || 0,
                totalSells: summary.total_sells || 0,
                totalBuysUSD: summary.total_bought_volume_usd || '0',
                totalSellsUSD: summary.total_sold_volume_usd || '0',
              },
            };
          } catch (error: any) {
            const errorMessage = error.response?.data?.message;
            if (
              errorMessage ===
                'Validation service blocked: Your plan: free-plan-daily total included usage has been consumed, please upgrade your plan here, https://moralis.io/pricing' ||
              errorMessage ===
                'SUPPORT BLOCKED: Please contact support@moralis.io'
            ) {
              apiKeyDoc = await this.CallModel.findOne();
              currentKeyIndex = apiKeyDoc.call;
              const keyWasUpdated = currentKeyIndex !== initialKeyIndex;

              if (keyWasUpdated && attempts === 0) {
                attempts++;
                continue; // Retry with the externally updated key
              }

              await this.apiKeyMutex.runExclusive(async () => {
                apiKeyDoc = await this.CallModel.findOne();
                currentKeyIndex = apiKeyDoc.call;

                if (currentKeyIndex < maxAttempts - 1) {
                  currentKeyIndex += 1;
                } else {
                  currentKeyIndex = 0;
                  console.log(
                    'All API keys exhausted in getPnlLeaderBoard, resetting index to 0',
                  );
                  await this.trackerService.sendChatMessage(
                    'All API keys exhausted in getPnlLeaderBoard, resetting index to 0',
                  );
                }
                await this.CallModel.updateOne({}, { call: currentKeyIndex });
                console.log(
                  `API key updated to index ${currentKeyIndex} in getPnlLeaderBoard`,
                );
                await this.trackerService.sendChatMessage(
                  `API key updated to index ${currentKeyIndex} in getPnlLeaderBoard`,
                );
              });
              attempts++;
            } else {
              console.error(
                `Error fetching PNL for wallet ${user.wallet}:`,
                error.message || error,
              );
              return {
                name: user.name || 'Unknown',
                wallet: user.wallet,
                twitter: user.twitter || '',
                telegram: user.telegram || '',
                website: user.website || '',
                chains: user.chains || [],
                imageUrl: user.imageUrl || '',
                pnlSummary: defaultPnlSummary,
              };
            }
          }
        }

        console.warn(
          `All API keys exhausted for wallet ${user.wallet} in getPnlLeaderBoard`,
        );

        return {
          name: user.name || 'Unknown',
          wallet: user.wallet,
          twitter: user.twitter || '',
          telegram: user.telegram || '',
          website: user.website || '',
          chains: user.chains || [],
          imageUrl: user.imageUrl || '',
          pnlSummary: defaultPnlSummary,
        };
      });

      const leaderboard = await Promise.all(pnlPromises);
      const filteredLeaderboard = leaderboard.filter(
        (entry) => entry.pnlSummary.totalTradesCount > 0,
      );

      filteredLeaderboard.sort((a, b) => {
        const pnlA = parseFloat(a.pnlSummary.totalPnlUSD);
        const pnlB = parseFloat(b.pnlSummary.totalPnlUSD);
        return pnlB - pnlA; // Descending order
      });

      return filteredLeaderboard;
    } catch (error: any) {
      console.error('Error fetching PNL leaderboard:', error.message || error);
      throw error;
    }
  }

  // async getDbPnlLeaderBoard(
  //   chain?: string,
  //   days: 'all' | '1' | '3' | '7' | '14' | '30' = 'all',
  // ): Promise<
  //   {
  //     name: string;
  //     wallet: string;
  //     twitter: string;
  //     telegram: string;
  //     website: string;
  //     chains: string[];
  //     imageUrl: string;
  //     pnlSummary: {
  //       totalTradesCount: number;
  //       totalPnlUSD: string;
  //       totalPnlPercentage: number;
  //       totalBuys: number;
  //       totalSells: number;
  //       totalBuysUSD: string;
  //       totalSellsUSD: string;
  //     };
  //   }[]
  // > {
  //   try {
  //     const users = await this.UserModel.find().exec();
  //     if (!users || users.length === 0) {
  //       console.log('No users found');
  //       return [];
  //     }

  //     const defaultPnlSummary = {
  //       totalTradesCount: 0,
  //       totalPnlUSD: '0.00',
  //       totalPnlPercentage: 0,
  //       totalBuys: 0,
  //       totalSells: 0,
  //       totalBuysUSD: '0.00',
  //       totalSellsUSD: '0.00',
  //     };

  //     const daysMap = { '1': 1, '3': 3, '7': 7, '14': 14, '30': 30 };
  //     const dayCount = daysMap[days];
  //     const timeFilter =
  //       days === 'all' ? 'all' : (days as '1' | '3' | '7' | '14' | '30');

  //     const WETH_PRICE = 2000; // Placeholder, replace with actual price source

  //     const pnlPromises = users.map(async (user) => {
  //       const tokenAddresses = [
  //         ...new Set(
  //           (
  //             await this.TransactionModel.find({
  //               wallet: user.wallet.toLowerCase(),
  //               chain,
  //               ...(days !== 'all' && {
  //                 blockTimestamp: {
  //                   $gte: new Date(Date.now() - dayCount * 24 * 60 * 60 * 1000),
  //                 },
  //               }),
  //             }).exec()
  //           )
  //             .map((tx) => [tx.tokenInAddress, tx.tokenOutAddress])
  //             .flat()
  //             .filter((addr): addr is string => !!addr)
  //             .map((addr) => addr.toLowerCase()),
  //         ),
  //       ];

  //       if (tokenAddresses.length === 0) {
  //         return {
  //           name: user.name || 'Unknown',
  //           wallet: user.wallet,
  //           twitter: user.twitter || '',
  //           telegram: user.telegram || '',
  //           website: user.website || '',
  //           chains: user.chains || [],
  //           imageUrl: user.imageUrl || '',
  //           pnlSummary: defaultPnlSummary,
  //         };
  //       }

  //       const tokenPnls = await this.calculateUserTokensPnl(
  //         user.wallet,
  //         chain,
  //         tokenAddresses,
  //         timeFilter,
  //       );

  //       const pnlSummary = tokenPnls.reduce(
  //         (acc, tokenPnl) => {
  //           // Ensure valid parsing with fallback to 0
  //           const pnlUSD = parseFloat(tokenPnl.pnlUSD) || 0;
  //           const buyAmount = parseFloat(tokenPnl.totalBuyTokenAmount) || 0;
  //           const sellAmount = parseFloat(tokenPnl.totalSellTokenAmount) || 0;

  //           // Assuming amounts are in ETH (adjust if in wei)
  //           const buyAmountEth = buyAmount; // Remove / 1e18 if already in ETH
  //           const sellAmountEth = sellAmount;

  //           acc.totalTradesCount += tokenPnl.tradeCount;
  //           acc.totalBuys += tokenPnl.totalBuys;
  //           acc.totalSells += tokenPnl.totalSells;
  //           acc.totalBuysUSD += buyAmountEth * WETH_PRICE;
  //           acc.totalSellsUSD += sellAmountEth * WETH_PRICE;
  //           acc.totalPnlUSD += pnlUSD;

  //           return acc;
  //         },
  //         {
  //           totalTradesCount: 0,
  //           totalBuys: 0,
  //           totalSells: 0,
  //           totalBuysUSD: 0,
  //           totalSellsUSD: 0,
  //           totalPnlUSD: 0,
  //           totalPnlPercentage: 0,
  //         },
  //       );

  //       // Calculate percentage only if there’s a basis (buys USD)
  //       pnlSummary.totalPnlPercentage =
  //         pnlSummary.totalBuysUSD !== 0
  //           ? (pnlSummary.totalPnlUSD / pnlSummary.totalBuysUSD) * 100
  //           : 0;

  //       // Debugging log
  //       console.log(`User: ${user.wallet}, Token PNLs:`, tokenPnls);
  //       console.log(
  //         `User: ${user.wallet}, Aggregated PNL Summary:`,
  //         pnlSummary,
  //       );

  //       return {
  //         name: user.name || 'Unknown',
  //         wallet: user.wallet,
  //         twitter: user.twitter || '',
  //         telegram: user.telegram || '',
  //         website: user.website || '',
  //         chains: user.chains || [],
  //         imageUrl: user.imageUrl || '',
  //         pnlSummary: {
  //           totalTradesCount: pnlSummary.totalTradesCount,
  //           totalPnlUSD: isNaN(pnlSummary.totalPnlUSD)
  //             ? '0.00'
  //             : pnlSummary.totalPnlUSD.toFixed(2),
  //           totalPnlPercentage: isNaN(pnlSummary.totalPnlPercentage)
  //             ? 0
  //             : parseFloat(pnlSummary.totalPnlPercentage.toFixed(2)),
  //           totalBuys: pnlSummary.totalBuys,
  //           totalSells: pnlSummary.totalSells,
  //           totalBuysUSD: isNaN(pnlSummary.totalBuysUSD)
  //             ? '0.00'
  //             : pnlSummary.totalBuysUSD.toFixed(2),
  //           totalSellsUSD: isNaN(pnlSummary.totalSellsUSD)
  //             ? '0.00'
  //             : pnlSummary.totalSellsUSD.toFixed(2),
  //         },
  //       };
  //     });

  //     const leaderboard = await Promise.all(pnlPromises);
  //     const filteredLeaderboard = leaderboard.filter(
  //       (entry) => entry.pnlSummary.totalTradesCount > 0,
  //     );

  //     filteredLeaderboard.sort((a, b) => {
  //       const pnlA = parseFloat(a.pnlSummary.totalPnlUSD);
  //       const pnlB = parseFloat(b.pnlSummary.totalPnlUSD);
  //       return pnlB - pnlA; // Descending order
  //     });

  //     return filteredLeaderboard;
  //   } catch (error: any) {
  //     console.error('Error fetching PNL leaderboard:', error.message || error);
  //     throw error;
  //   }
  // }

  async getDbPnlLeaderBoard(
    chain?: string,
    timeFilter: 'all' | '1' | '3' | '7' | '14' | '30' = 'all',
  ): Promise<PnlLeaderboardEntry[]> {
    try {
      const users = await this.UserModel.find().exec();
      if (!users?.length) return [];

      const cutoffDate = this.getCutoffDate(timeFilter);
      // const baseTokenSymbol = chain === 'bsc' ? 'WBNB' : 'WETH';

      const leaderboardEntries = await Promise.all(
        users.map(async (user) => {
          const transactions = await this.TransactionModel.find({
            wallet: user.wallet.toLowerCase(),
            ...(chain && { chain: chain.toLowerCase() }),
            ...(cutoffDate && { blockTimestamp: { $gte: cutoffDate } }),
          }).exec();

          if (!transactions.length) {
            return this.createEmptyLeaderboardEntry(user);
          }

          const tokenAddresses = [
            ...new Set(
              transactions
                .flatMap((tx) => [tx.tokenInAddress, tx.tokenOutAddress])
                .filter((addr): addr is string => !!addr)
                .map((addr) => addr.toLowerCase()),
            ),
          ];

          const tokenPnls = await this.calculateUserTokensPnl(
            user.wallet,
            chain || user.chains[0],
            tokenAddresses,
            timeFilter,
          );

          const aggregated = tokenPnls.reduce(
            (acc, tokenPnl) => {
              acc.totalInvested +=
                parseFloat(tokenPnl.totalBaseTokenSpent) || 0;
              acc.investedUSD +=
                parseFloat(tokenPnl.totalBaseTokenSpentUSD) || 0;
              acc.totalRealized +=
                parseFloat(tokenPnl.totalBaseTokenReceived) || 0;
              acc.realizedUSD +=
                parseFloat(tokenPnl.totalBaseTokenReceivedUSD) || 0;

              const tokenGain = parseFloat(tokenPnl.baseTokenPnl) || 0;
              if (tokenGain > 0) acc.profitableTrades++;
              else if (tokenGain < 0) acc.losingTrades++;

              acc.totalBuys += tokenPnl.totalBuys;
              acc.totalSells += tokenPnl.totalSells;

              return acc;
            },
            {
              totalInvested: 0,
              investedUSD: 0,
              totalRealized: 0,
              realizedUSD: 0,
              profitableTrades: 0,
              losingTrades: 0,
              totalBuys: 0,
              totalSells: 0,
            },
          );

          // Calculate net gains
          const baseTokenGain =
            aggregated.totalRealized - aggregated.totalInvested;
          const baseTokenGainUSD =
            aggregated.realizedUSD - aggregated.investedUSD;
          const roiPercentage =
            aggregated.investedUSD > 0
              ? (baseTokenGainUSD / aggregated.investedUSD) * 100
              : 0;

          return {
            name: user.name || 'Unknown',
            wallet: user.wallet,
            twitter: user.twitter || '',
            telegram: user.telegram || '',
            website: user.website || '',
            chains: user.chains || [],
            imageUrl: user.imageUrl || '',
            pnlSummary: {
              totalTradesCount: aggregated.totalBuys + aggregated.totalSells,
              profitableTrades: aggregated.profitableTrades,
              losingTrades: aggregated.losingTrades,
              totalBaseTokenInvested: aggregated.totalInvested.toFixed(6),
              totalBaseTokenInvestedUSD: aggregated.investedUSD.toFixed(2),
              totalBaseTokenRealized: aggregated.totalRealized.toFixed(6),
              totalBaseTokenRealizedUSD: aggregated.realizedUSD.toFixed(2),
              baseTokenGain: baseTokenGain.toFixed(6),
              baseTokenGainUSD: baseTokenGainUSD.toFixed(2),
              totalPnlPercentage: parseFloat(roiPercentage.toFixed(2)),
              totalBuys: aggregated.totalBuys,
              totalSells: aggregated.totalSells,
            },
          };
        }),
      );

      // Sort by baseTokenGainUSD (descending)
      return leaderboardEntries
        .filter((entry) => entry.pnlSummary.totalTradesCount > 0)
        .sort((a, b) => {
          const gainA = parseFloat(a.pnlSummary.baseTokenGainUSD);
          const gainB = parseFloat(b.pnlSummary.baseTokenGainUSD);

          // Primary sort by USD gain (highest first)
          if (gainB > gainA) return 1;
          if (gainB < gainA) return -1;

          // Secondary sort by ROI percentage
          return (
            b.pnlSummary.totalPnlPercentage - a.pnlSummary.totalPnlPercentage
          );
        });
    } catch (error) {
      console.error('Error generating leaderboard:', error);
      throw new Error('Failed to generate leaderboard');
    }
  }

  // private createEmptyLeaderboardEntry(user: any): PnlLeaderboardEntry {
  //   return {
  //     name: user.name || 'Unknown',
  //     wallet: user.wallet,
  //     twitter: user.twitter || '',
  //     telegram: user.telegram || '',
  //     website: user.website || '',
  //     chains: user.chains || [],
  //     imageUrl: user.imageUrl || '',
  //     pnlSummary: {
  //       totalTradesCount: 0,
  //       profitableTrades: 0,
  //       losingTrades: 0,
  //       totalBaseTokenGained: '0.000000',
  //       totalBaseTokenGainedUSD: '0.00',
  //       totalBaseTokenLost: '0.000000',
  //       totalBaseTokenLostUSD: '0.00',
  //       netBaseTokenPnl: '0.000000',
  //       netBaseTokenPnlUSD: '0.00',
  //       totalPnlPercentage: 0,
  //       totalBuys: 0,
  //       totalSells: 0,
  //     },
  //   };
  // }

  async seedDatabase(): Promise<void> {
    try {
      const dummyUser = {
        name: 'Dummy User',
        wallet: '0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13'.toLowerCase(),
        twitter: '@dummyuser',
        telegram: '@dummyuser_telegram',
        website: 'https://dummyuser.com',
        imageUrl: 'https://dummyuser.com',
        chains: ['eth', 'bsc', 'base'],
      };

      // Check if the user already exists and delete
      await this.UserModel.deleteOne({
        wallet: dummyUser.wallet,
      });

      // Create and save the dummy user
      const newUser = new this.UserModel(dummyUser);
      await newUser.save();

      console.log(
        `Successfully seeded database with dummy user: ${dummyUser.wallet}`,
      );
    } catch (error: any) {
      console.error('Error seeding database:', error.message || error);
      throw error;
    }
  }
}
