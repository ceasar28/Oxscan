import {
  BadRequestException,
  Injectable,
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

@Injectable()
export class UserService {
  constructor(
    private readonly httpService: HttpService,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(Transaction.name)
    private readonly TransactionModel: Model<Transaction>,
    @InjectModel(Call.name) private readonly CallModel: Model<Call>,
  ) {
    this.seedDatabase();
  }

  // Create a new user
  async newUser(userDto: UserDto): Promise<UserDto> {
    try {
      // Check if user with this wallet already exists
      const existingUser = await this.UserModel.findOne({
        wallet: userDto.wallet.toLowerCase(),
      });
      if (existingUser) {
        throw new Error(`User with wallet ${userDto.wallet} already exists`);
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

  // async getAUsersTransactions(
  //   walletAddress: string,
  // ): Promise<TransactionDto[]> {
  //   try {
  //     const transactions = await this.TransactionModel.find({
  //       wallet: walletAddress.toLowerCase(),
  //     }).exec();

  //     if (!transactions || transactions.length === 0) {
  //       console.log(`No transactions found for wallet: ${walletAddress}`);
  //       return []; // Return empty array if no transactions
  //     }

  //     // Map transactions to TransactionDto
  //     return transactions.map((tx) => ({
  //       wallet: tx.wallet,
  //       chain: tx.chain,
  //       type: tx.type,
  //       txHash: tx.txHash,
  //       txIndex: tx.txIndex,
  //       blockTimestamp: tx.blockTimestamp,
  //       tokenOutSymbol: tx.tokenOutSymbol,
  //       tokenOutName: tx.tokenOutName,
  //       tokenOutLogo: tx.tokenOutLogo,
  //       tokenOutAddress: tx.tokenOutAddress,
  //       tokenOutAmount: tx.tokenOutAmount,
  //       tokenOutAmountUsd: tx.tokenOutAmountUsd,
  //       tokenInSymbol: tx.tokenInSymbol,
  //       tokenInName: tx.tokenInName,
  //       tokenInLogo: tx.tokenInLogo,
  //       tokenInAddress: tx.tokenInAddress,
  //       tokenInAmount: tx.tokenInAmount,
  //       tokenInAmountUsd: tx.tokenInAmountUsd,
  //     }));
  //   } catch (error: any) {
  //     console.error(
  //       'Error fetching transactions for wallet:',
  //       walletAddress,
  //       error.message || error,
  //     );
  //     throw error;
  //   }
  // }

  // New method to seed the database

  // async getAUsersTransactions(
  //   walletAddress: string,
  //   chain?: string, // Optional chain parameter
  // ): Promise<TransactionDto[]> {
  //   try {
  //     // Build the query object
  //     const query: any = {
  //       wallet: walletAddress.toLowerCase(),
  //     };

  //     // If chain is provided, add it to the query
  //     if (chain) {
  //       query.chain = chain;
  //     }

  //     const transactions = await this.TransactionModel.find(query)
  //       .sort({ blockTimestamp: -1 }) // Sort by timestamp, descending (newest first)
  //       .limit(50) // Limit to 50 records
  //       .exec();

  //     if (!transactions || transactions.length === 0) {
  //       console.log(
  //         `No transactions found for wallet: ${walletAddress}` +
  //           (chain ? ` on chain: ${chain}` : ''),
  //       );
  //       return []; // Return empty array if no transactions
  //     }

  //     // Map transactions to TransactionDto
  //     return transactions.map((tx) => ({
  //       wallet: tx.wallet,
  //       chain: tx.chain,
  //       type: tx.type,
  //       txHash: tx.txHash,
  //       txIndex: tx.txIndex,
  //       blockTimestamp: tx.blockTimestamp,
  //       tokenOutSymbol: tx.tokenOutSymbol,
  //       tokenOutName: tx.tokenOutName,
  //       tokenOutLogo: tx.tokenOutLogo,
  //       tokenOutAddress: tx.tokenOutAddress,
  //       tokenOutAmount: tx.tokenOutAmount,
  //       tokenOutAmountUsd: tx.tokenOutAmountUsd,
  //       tokenInSymbol: tx.tokenInSymbol,
  //       tokenInName: tx.tokenInName,
  //       tokenInLogo: tx.tokenInLogo,
  //       tokenInAddress: tx.tokenInAddress,
  //       tokenInAmount: tx.tokenInAmount,
  //       tokenInAmountUsd: tx.tokenInAmountUsd,
  //     }));
  //   } catch (error: any) {
  //     console.error(
  //       'Error fetching transactions for wallet:',
  //       walletAddress,
  //       chain ? `on chain: ${chain}` : '',
  //       error.message || error,
  //     );
  //     throw error;
  //   }
  // }

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

  // async getUserTokensPnl(
  //   wallet: string,
  //   chain: string,
  //   token: string[],
  // ): Promise<
  //   {
  //     tokenAddress: string;
  //     tokenName: string;
  //     tokenSymbol: string;
  //     tradeCount: number;
  //     totalBuys: number;
  //     totalSells: number;
  //     totalTokenBought: string;
  //     totalTokenBoughtUSD: string;
  //     totalTokenSold: string;
  //     totalTokenSoldUSD: string;
  //     pnlUSD: string;
  //     pnlPercentage: number;
  //   }[]
  // > {
  //   try {
  //     let chainNumber;
  //     if (chain === 'eth') {
  //       chainNumber = '0x1';
  //     } else if (chain === 'bsc') {
  //       chainNumber = '0x38';
  //     } else if (chain === 'base') {
  //       chainNumber = '0x2105';
  //     } else {
  //       console.log('wrong chain');
  //     }

  //     const apiKeys = [
  //       process.env.MORALIS_API_1,
  //       process.env.MORALIS_API_2,
  //       process.env.MORALIS_API_3,
  //       process.env.MORALIS_API_4,
  //       process.env.MORALIS_API_5,
  //       process.env.MORALIS_API_6,
  //     ];
  //     const apiKeyIndex = await this.CallModel.findOne();
  //     const currentApiKey = apiKeys[apiKeyIndex.call];
  //     await Moralis.start({
  //       apiKey: currentApiKey,
  //     });

  //     const response = await Moralis.EvmApi.wallets.getWalletProfitability({
  //       chain: chainNumber,
  //       tokenAddresses: token,
  //       address: wallet,
  //     });

  //     console.log(response.raw);
  //     if (response.raw.result.length > 0) {
  //       return response.raw.result.map((token) => ({
  //         tokenAddress: token.token_address,
  //         tokenName: token.name,
  //         tokenSymbol: token.symbol,
  //         tradeCount: token.count_of_trades,
  //         totalBuys: token.total_buys,
  //         totalSells: token.total_sells,
  //         totalTokenBought: token.total_tokens_bought,
  //         totalTokenBoughtUSD: token.total_usd_invested,
  //         totalTokenSold: token.total_tokens_sold,
  //         totalTokenSoldUSD: token.total_sold_usd,
  //         pnlUSD: token.realized_profit_usd,
  //         pnlPercentage: token.realized_profit_percentage,
  //       }));
  //     }
  //   } catch (error: any) {
  //     console.error('Error fetching  users pnl ', error.message || error);
  //     throw error;
  //   }
  // }

  async getUserTokensPnl(
    wallet: string,
    chain: string,
    tokens: string[],
  ): Promise<
    {
      tokenAddress: string;
      tokenName: string;
      tokenSymbol: string;
      tradeCount: number;
      totalBuys: number;
      totalSells: number;
      totalTokenBought: string;
      totalTokenBoughtUSD: string;
      totalTokenSold: string;
      totalTokenSoldUSD: string;
      pnlUSD: string;
      pnlPercentage: number;
    }[]
  > {
    try {
      // Map chain names to chain IDs
      // const chainMap: { [key: string]: string } = {
      //   eth: '0x1', // Ethereum
      //   bsc: '0x38', // Binance Smart Chain
      //   base: '0x2105', // Base
      // };
      // const chainNumber = chainMap[chain.toLowerCase()];
      if (!chain) {
        throw new BadRequestException(`Unsupported chain`);
      }

      // API key rotation
      const apiKeys = [
        process.env.MORALIS_API_1,
        process.env.MORALIS_API_2,
        process.env.MORALIS_API_3,
        process.env.MORALIS_API_4,
        process.env.MORALIS_API_5,
        process.env.MORALIS_API_6,
      ].filter(Boolean); // Remove undefined keys
      //const apiKeyIndex = await this.CallModel.findOne();
      // const keyIndex = apiKeyIndex?.call ?? 0; // Fallback to 0 if undefined

      const keyIndex = 5;

      const currentApiKey = apiKeys[keyIndex];
      if (!currentApiKey) {
        throw new Error('No valid Moralis API key available');
      }
      const pnlUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${wallet}/profitability`;

      const params = { chain: chain };
      tokens.forEach((token, index) => {
        params[`token_addresses[${index}]`] = token;
      });

      const response = await this.httpService.axiosRef.get(pnlUrl, {
        params: params,
        headers: { 'X-API-Key': currentApiKey },
      });

      const results = response.data.result || [];
      return results.map((token) => ({
        tokenAddress: token.token_address,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        tradeCount: token.count_of_trades,
        totalBuys: token.total_buys,
        totalSells: token.total_sells,
        totalTokenBought: token.total_tokens_bought,
        totalTokenBoughtUSD: token.total_usd_invested,
        totalTokenSold: token.total_tokens_sold,
        totalTokenSoldUSD: token.total_sold_usd,
        pnlUSD: token.realized_profit_usd,
        pnlPercentage: token.realized_profit_percentage,
      }));
    } catch (error: any) {
      console.error('Error fetching user PNL:', error.code || error);
      if (error.code === 'ERR_BAD_REQUEST') {
        throw new BadRequestException('invalid data');
      }
      throw error.message;
    }
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
    try {
      // // Map chain names to chain IDs
      // const chainMap: { [key: string]: string } = {
      //   eth: '0x1', // Ethereum
      //   bsc: '0x38', // Binance Smart Chain
      //   base: '0x2105', // Base
      // };
      // const chainNumber = chainMap[chain.toLowerCase()];
      if (!chain) {
        throw new BadRequestException(`Unsupported chain`);
      }

      // API key rotation
      const apiKeys = [
        process.env.MORALIS_API_1,
        process.env.MORALIS_API_2,
        process.env.MORALIS_API_3,
        process.env.MORALIS_API_4,
        process.env.MORALIS_API_5,
        process.env.MORALIS_API_6,
      ].filter(Boolean); // Remove undefined keys
      //const apiKeyIndex = await this.CallModel.findOne();
      // const keyIndex = apiKeyIndex?.call ?? 0; // Fallback to 0 if undefined

      const keyIndex = 4;

      const currentApiKey = apiKeys[keyIndex];
      if (!currentApiKey) {
        throw new Error('No valid Moralis API key available');
      }

      const topHoldingsUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${wallet}/tokens`;

      const params = { chain: chain, exclude_spam: true, limit: 2 };

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
      console.error(
        'Error fetching user top  Holdings:',
        error.message || error,
      );
      throw error;
    }
  }

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
