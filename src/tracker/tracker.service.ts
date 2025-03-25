import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Document } from 'mongoose';
import { Call, CallDocument } from 'src/database/schemas/moralisCalls.schema';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { SocketGateway } from 'src/socket/socket.gateway';
import { Mutex } from 'async-mutex';
import * as TelegramBot from 'node-telegram-bot-api';

export type TransactionDocument = Transaction & Document;

@Injectable()
export class TrackerService {
  private readonly logger = new Logger(TrackerService.name);
  private readonly apiKeyMutex = new Mutex();
  private readonly trackerBot: TelegramBot;

  private readonly token = process.env.TEST_TOKEN;
  private readonly chatId = process.env.CHAT_ID;

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(User.name) private readonly UserModel: Model<UserDocument>,
    @InjectModel(Call.name) private readonly CallModel: Model<CallDocument>,
    @InjectModel(Transaction.name)
    private readonly TransactionModel: Model<TransactionDocument>,
    private readonly socketGateway: SocketGateway,
  ) {
    this.trackerBot = new TelegramBot(this.token, { polling: true });
    this.trackerBot.on('message', this.handleRecievedMessages);
  }

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

  handleRecievedMessages = async (
    msg: TelegramBot.Message,
  ): Promise<unknown> => {
    this.logger.debug(msg);
    try {
      await this.trackerBot.sendChatAction(msg.chat.id, 'typing');
      if (msg.text.trim() === '/start') {
        const username: string = `${msg.from.username}`;

        return await this.trackerBot.sendMessage(
          msg.chat.id,
          `Hey @${username}\nWelcome to moralis API key tracker`,
        );
      } else if (msg.text.trim() === '/key') {
        try {
          const keyIndex = await this.CallModel.findOne();

          if (!keyIndex) {
            await this.trackerBot.sendChatAction(msg.chat.id, 'typing');
            return await this.trackerBot.sendMessage(
              msg.chat.id,
              `There is no API Key`,
            );
          }
          const currentKeyIndex = keyIndex.call;
          // const currentApiKey = this.apiKeys[currentKeyIndex];

          return await this.trackerBot.sendMessage(
            msg.chat.id,
            `Current Key index is ${currentKeyIndex}`,
          );
        } catch (error) {
          console.log(error);
        }
      } else if (msg.text.trim() === '/ping') {
        return await this.pingKey();
      }
    } catch (error) {
      console.log(error);
      return await this.trackerBot.sendMessage(
        msg.chat.id,
        'There was an error processing your message',
      );
    }
  };

  async sendChatMessage(message) {
    try {
      await this.trackerBot.sendChatAction(this.chatId, 'typing');
      return await this.trackerBot.sendMessage(this.chatId, message);
    } catch (error) {
      console.log(error);
    }
  }

  async pingKey() {
    const address = process.env.EVM_WALLET;

    const apiKeyDoc = await this.CallModel.findOne();

    const currentKeyIndex = apiKeyDoc.call;

    const currentApiKey = this.apiKeys[currentKeyIndex];

    try {
      const balance = this.httpService.axiosRef.get(
        `https://deep-index.moralis.io/api/v2.2/${address}/balance`,
        { headers: { 'X-API-Key': currentApiKey } },
      );

      const [balanceResponse] = await Promise.all([balance]);

      if (balanceResponse.data) {
        await this.sendChatMessage(
          `✅ KEY index ${currentKeyIndex} is ...STILL LIVE✅\n`,
        );
      }
    } catch (apiError: any) {
      const errorMessage = apiError.response?.data?.message;
      if (
        errorMessage ===
          'Validation service blocked: Your plan: free-plan-daily total included usage has been consumed, please upgrade your plan here, https://moralis.io/pricing' ||
        errorMessage === 'SUPPORT BLOCKED: Please contact support@moralis.io'
      ) {
        return await this.sendChatMessage(
          `❌ KEY index ${currentKeyIndex} is ...down ❌\n\n MESSAGE:${errorMessage} `,
        );
      } else {
        await this.sendChatMessage(
          `❌Server error ❌\n\n MESSAGE:${apiError} `,
        );
        throw apiError; // Re-throw unexpected errors
      }
    }
  }

  async getGasPrice() {
    try {
      const bnbPricePromise = this.httpService.axiosRef.get(
        `https://api.bscscan.com/api?module=stats&action=bnbprice&apikey=${process.env.BSC_KEY}`,
      );
      const bnbGasPromise = this.httpService.axiosRef.get(
        `https://api.bscscan.com/api?module=gastracker&action=gasoracle&apikey=${process.env.BSC_KEY}`,
      );
      const ethPricePromise = this.httpService.axiosRef.get(
        `https://api.basescan.org/api?module=stats&action=ethprice&apikey=${process.env.BASE_KEY}`,
      );
      const ethGasPromise = this.httpService.axiosRef.get(
        `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${process.env.ETH_KEY}`,
      );

      const [
        bnbPriceResponse,
        bnbGasResponse,
        ethPriceResponse,
        ethGasResponse,
      ] = await Promise.all([
        bnbPricePromise,
        bnbGasPromise,
        ethPricePromise,
        ethGasPromise,
      ]);

      return {
        bnbPrice: bnbPriceResponse.data,
        bnbGas: bnbGasResponse.data,
        ethPrice: ethPriceResponse.data,
        ethGas: ethGasResponse.data,
      };
    } catch (error) {
      console.error('Error getting gas:', error);
      throw error;
    }
  }

  private async getTransactionsWithKey(
    url: string,
    walletAddress: string,
  ): Promise<any[]> {
    let apiKeyDoc = await this.CallModel.findOne();
    if (!apiKeyDoc) {
      apiKeyDoc = new this.CallModel({ call: 0 });
      await apiKeyDoc.save();
    }
    const currentKeyIndex = apiKeyDoc.call;
    const currentApiKey = this.apiKeys[currentKeyIndex];

    try {
      const response = await this.httpService.axiosRef.get(url, {
        headers: { 'X-API-Key': currentApiKey },
      });
      return response.data.result || [];
    } catch (apiError: any) {
      const errorMessage = apiError.response?.data?.message;
      if (
        errorMessage ===
          'Validation service blocked: Your plan: free-plan-daily total included usage has been consumed, please upgrade your plan here, https://moralis.io/pricing' ||
        errorMessage === 'SUPPORT BLOCKED: Please contact support@moralis.io'
      ) {
        throw new Error(
          `API key at index ${currentKeyIndex} exhausted for wallet ${walletAddress}`,
        );
      }
      throw apiError; // Re-throw unexpected errors
    }
  }

  async trackEthTransactions(
    walletAddress: string,
    user: UserDocument,
  ): Promise<void> {
    const swapUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/swaps?chain=eth&order=DESC`;
    await this.trackTransactions(swapUrl, walletAddress, user, 'eth');
  }

  async trackBscTransactions(
    walletAddress: string,
    user: UserDocument,
  ): Promise<void> {
    const swapUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/swaps?chain=bsc&order=DESC`;
    await this.trackTransactions(swapUrl, walletAddress, user, 'bsc');
  }

  async trackBaseTransactions(
    walletAddress: string,
    user: UserDocument,
  ): Promise<void> {
    const swapUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/swaps?chain=base&order=DESC`;
    await this.trackTransactions(swapUrl, walletAddress, user, 'base');
  }

  private async trackTransactions(
    swapUrl: string,
    walletAddress: string,
    user: UserDocument,
    chain: string,
  ): Promise<void> {
    try {
      const transactions = await this.getTransactionsWithKey(
        swapUrl,
        walletAddress,
      );
      if (transactions.length === 0) return;

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentTransactions = transactions.filter(
        (tx) => new Date(tx.blockTimestamp) >= twentyFourHoursAgo,
      );

      if (recentTransactions.length === 0) {
        console.log(
          `No recent transactions for wallet ${walletAddress} on chain ${chain}`,
        );
        return;
      }

      const existingTransactions = await this.TransactionModel.find({
        wallet: walletAddress.toLowerCase(),
      });
      const transactionMap = new Map(
        existingTransactions.map((tx) => [`${tx.txHash}-${tx.txIndex}`, tx]),
      );

      for (const tx of recentTransactions) {
        const txKey = `${tx.transactionHash}-${tx.transactionIndex}`;
        if (transactionMap.has(txKey)) {
          console.log(`Transaction ${txKey} already exists, skipping...`);
          continue;
        }

        this.alertTransaction(tx);

        const newTransaction = new this.TransactionModel({
          wallet: walletAddress.toLowerCase(),
          chain,
          type: tx.transactionType,
          txHash: tx.transactionHash,
          txIndex: tx.transactionIndex,
          blockTimestamp: tx.blockTimestamp,
          tokenOutName: tx.sold.name,
          tokenOutSymbol: tx.sold.symbol,
          tokenOutAddress: tx.sold.address,
          tokenOutLogo: tx.sold.logo || '',
          tokenOutAmount: tx.sold.amount,
          tokenOutAmountUsd: tx.sold.usdAmount,
          tokenInName: tx.bought.name,
          tokenInSymbol: tx.bought.symbol,
          tokenInAddress: tx.bought.address,
          tokenInLogo: tx.bought.logo || '',
          tokenInAmount: tx.bought.amount,
          tokenInAmountUsd: tx.bought.usdAmount,
        }) as TransactionDocument;

        await this.saveTransaction(newTransaction, txKey, user, transactionMap);
      }
    } catch (error: any) {
      console.error(
        `Error in trackTransactions (${chain}):`,
        error.message || error,
      );
      throw error;
    }
  }

  async getTokenMetadata(address: string, chain: string) {
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
      if (attempts === 0) initialKeyIndex = currentKeyIndex; // Store initial index on first attempt
      const currentApiKey = this.apiKeys[currentKeyIndex];

      try {
        const tokenPrice = this.httpService.axiosRef.get(
          `https://deep-index.moralis.io/api/v2.2/erc20/${address}/price?chain=${chain}&include=percent_change`,
          { headers: { 'X-API-Key': currentApiKey } },
        );
        const params = { chain, addresses: [address] };
        const marketCap = this.httpService.axiosRef.get(
          `https://deep-index.moralis.io/api/v2.2/erc20/metadata`,
          { params, headers: { 'X-API-Key': currentApiKey } },
        );

        const [tokenPriceResponse, marketCapResponse] = await Promise.all([
          tokenPrice,
          marketCap,
        ]);

        return {
          tokenPrice: tokenPriceResponse.data,
          tokenMCap: marketCapResponse.data,
        };
      } catch (apiError: any) {
        const errorMessage = apiError.response?.data?.message;
        if (
          errorMessage ===
            'Validation service blocked: Your plan: free-plan-daily total included usage has been consumed, please upgrade your plan here, https://moralis.io/pricing' ||
          errorMessage === 'SUPPORT BLOCKED: Please contact support@moralis.io'
        ) {
          // Check if the call index was updated by another request
          apiKeyDoc = await this.CallModel.findOne();
          currentKeyIndex = apiKeyDoc.call;
          const keyWasUpdated = currentKeyIndex !== initialKeyIndex;

          if (keyWasUpdated && attempts === 0) {
            // Retry with the new key if it was updated externally on the first failure
            attempts++;
            continue;
          }

          // If no external update or retry still fails, update the call index
          await this.apiKeyMutex.runExclusive(async () => {
            apiKeyDoc = await this.CallModel.findOne();
            currentKeyIndex = apiKeyDoc.call;

            if (currentKeyIndex < maxAttempts - 1) {
              currentKeyIndex += 1;
            } else {
              currentKeyIndex = 0; // Reset to 0 when all keys are exhausted
              console.log(
                'All API keys exhausted in getTokenMetadata, resetting index to 0',
              );
              await this.sendChatMessage(
                `All API keys exhausted in getTokenMetadata, resetting index to 0`,
              );
            }
            await this.CallModel.updateOne({}, { call: currentKeyIndex });
            console.log(
              `API key updated to index ${currentKeyIndex} in getTokenMetadata`,
            );
            await this.sendChatMessage(
              `API key updated to index ${currentKeyIndex} in getTokenMetadata`,
            );
          });
          attempts++;
        } else {
          throw apiError; // Re-throw unexpected errors
        }
      }
    }

    throw new Error(
      `Failed to fetch token metadata for ${address} on ${chain} after ${maxAttempts} attempts`,
    );
  }

  private async saveTransaction(
    newTransaction: TransactionDocument,
    txKey: string,
    user: UserDocument,
    transactionMap: Map<string, TransactionDocument>,
  ): Promise<void> {
    try {
      await newTransaction.save();

      this.socketGateway.server.emit('onNewTransaction', {
        msg: 'New Transaction',
        content: {
          name: user.name || '',
          wallet: user.wallet || newTransaction.wallet,
          twitter: user.twitter || '',
          telegram: user.telegram || '',
          website: user.website || '',
          chains: user.chains || [],
          imageUrl: user.imageUrl || '',
          transaction: {
            wallet: newTransaction.wallet,
            chain: newTransaction.chain,
            type: newTransaction.type,
            txHash: newTransaction.txHash,
            txIndex: newTransaction.txIndex,
            blockTimestamp: newTransaction.blockTimestamp,
            tokenOutName: newTransaction.tokenOutName,
            tokenOutSymbol: newTransaction.tokenOutSymbol,
            tokenOutAddress: newTransaction.tokenOutAddress,
            tokenOutLogo: newTransaction.tokenOutLogo,
            tokenOutAmount: newTransaction.tokenOutAmount,
            tokenOutAmountUsd: newTransaction.tokenOutAmountUsd,
            tokenInName: newTransaction.tokenInName,
            tokenInSymbol: newTransaction.tokenInSymbol,
            tokenInAddress: newTransaction.tokenInAddress,
            tokenInLogo: newTransaction.tokenInLogo,
            tokenInAmount: newTransaction.tokenInAmount,
            tokenInAmountUsd: newTransaction.tokenInAmountUsd,
          },
        },
      });
      transactionMap.set(txKey, newTransaction);
    } catch (saveError: any) {
      if (saveError.code === 11000) {
        console.log(`Duplicate transaction ${txKey} detected, skipping...`);
      } else {
        throw saveError;
      }
    }
  }

  private async trackUserTransactions(
    wallet: string,
    chains: string[],
    user: UserDocument,
  ): Promise<void> {
    if (!chains || chains.length === 0) {
      console.log(`No chains specified for wallet: ${wallet}`);
      return;
    }

    try {
      console.log(
        `Tracking transactions for wallet: ${wallet} on chains: ${chains.join(', ')}`,
      );
      const trackingPromises = [];

      if (chains.includes('eth'))
        trackingPromises.push(this.trackEthTransactions(wallet, user));
      if (chains.includes('bsc'))
        trackingPromises.push(this.trackBscTransactions(wallet, user));
      if (chains.includes('base'))
        trackingPromises.push(this.trackBaseTransactions(wallet, user));

      await Promise.all(trackingPromises);
      console.log(`Completed tracking for wallet: ${wallet}`);
    } catch (error: any) {
      console.error(
        `Error tracking transactions for wallet ${wallet}:`,
        error.message || error,
      );
      throw error;
    }
  }

  async trackAllUsersTransactions(): Promise<void> {
    try {
      const users = await this.UserModel.find().exec();
      if (!users || users.length === 0) {
        console.log('No users found');
        return;
      }

      console.log(`Tracking transactions for ${users.length} users...`);
      const userPromises = users.map((user) =>
        this.trackUserTransactions(user.wallet, user.chains, user),
      );
      await Promise.all(userPromises);
      console.log('Finished tracking transactions for all users');
    } catch (error: any) {
      console.error(
        'Error in trackAllUsersTransactions:',
        error.message || error,
      );
      throw error;
    }
  }

  async deleteTemporalUsers(): Promise<{
    message: string;
    deletedUsers: number;
    deletedTransactions: number;
  }> {
    try {
      const temporalUsers = await this.UserModel.find({
        temporal: true,
      }).exec();
      if (!temporalUsers || temporalUsers.length === 0) {
        return {
          message: 'No temporal users found to delete',
          deletedUsers: 0,
          deletedTransactions: 0,
        };
      }

      const walletAddresses = temporalUsers.map((user) =>
        user.wallet.toLowerCase(),
      );
      const userDeletionResult = await this.UserModel.deleteMany({
        temporal: true,
      }).exec();
      const transactionDeletionResult = await this.TransactionModel.deleteMany({
        wallet: { $in: walletAddresses },
      }).exec();

      return {
        message: `Successfully deleted ${userDeletionResult.deletedCount} temporal users and their transactions`,
        deletedUsers: userDeletionResult.deletedCount,
        deletedTransactions: transactionDeletionResult.deletedCount,
      };
    } catch (error: any) {
      console.error(
        'Error deleting temporal users and transactions:',
        error.message || error,
      );
      throw error;
    }
  }

  private alertTransaction(transaction: any): void {
    console.log(
      `Alert: New transaction detected - \nHash: ${transaction.transactionHash}\n ${transaction.walletAddress}\n ${transaction.transactionType}\n${transaction.bought.symbol} for ${transaction.sold.symbol}`,
    );
  }

  // @Cron('*/30 * * * * *') // Executes every 30 seconds
  @Cron('*/30 * * * *')
  async handleCron(): Promise<void> {
    let initialKeyIndex: number;
    try {
      this.logger.log('Executing token tracking cron job...');
      const initialApiKeyDoc = await this.CallModel.findOne();
      initialKeyIndex = initialApiKeyDoc ? initialApiKeyDoc.call : 0;

      await this.trackAllUsersTransactions();

      this.logger.log('Cron job completed successfully');
    } catch (error) {
      this.logger.error('Cron job failed:', error);

      // Check if the call index was updated and if we need to update it
      const maxAttempts = this.apiKeys.length;
      const currentApiKeyDoc = await this.CallModel.findOne();
      const currentKeyIndex = currentApiKeyDoc ? currentApiKeyDoc.call : 0;
      const keyWasUpdated = currentKeyIndex !== initialKeyIndex;

      if (!keyWasUpdated && currentKeyIndex === maxAttempts - 1) {
        await this.apiKeyMutex.runExclusive(async () => {
          const apiKeyDoc = await this.CallModel.findOne();
          let newKeyIndex = apiKeyDoc.call;

          if (newKeyIndex === maxAttempts - 1) {
            newKeyIndex = 0; // Reset to 0 if at the max
            console.log(
              'All API keys exhausted during cron, resetting index to 0',
            );
            await this.sendChatMessage(
              `All API keys exhausted during cron, resetting index to 0`,
            );
          } else {
            newKeyIndex += 1; // Shouldn’t happen, but increment as fallback
          }
          await this.CallModel.updateOne({}, { call: newKeyIndex });
          console.log(
            `API key updated to index ${newKeyIndex} after cron failure`,
          );
          await this.sendChatMessage(
            `API key updated to index ${newKeyIndex} in getTokenMetadata`,
          );
        });
      }
    }
  }

  @Cron('0 1 10 * * *', {
    name: 'resetCallModelData',
    timeZone: 'Africa/Lagos',
  })
  async resetKeyIndexToZeror(): Promise<void> {
    try {
      this.logger.log('reseting ...');
      await this.CallModel.updateOne({}, { call: 0 });
      await this.sendChatMessage(`reseting API keys for the day... to 0`);
    } catch (error) {
      console.log(error);
    }
  }

  @Cron('*/30 * * * *')
  async deleteTemporalData(): Promise<void> {
    try {
      this.logger.log('Deleting temporal data...');
      await this.deleteTemporalUsers();
    } catch (error) {
      console.log(error);
    }
  }
}
