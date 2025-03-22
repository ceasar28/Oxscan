import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Call } from 'src/database/schemas/moralisCalls.schema';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { SocketGateway } from 'src/socket/socket.gateway';

@Injectable()
export class TrackerService {
  private readonly logger = new Logger(TrackerService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(Call.name) private readonly CallModel: Model<Call>,
    @InjectModel(Transaction.name)
    private readonly TransactionModel: Model<Transaction>,
    private readonly socketGateway: SocketGateway, // Inject SocketGateway
  ) {
    // this.initializeCallModel();
  }

  private async initializeCallModel() {
    try {
      // Delete all existing Call documents
      await this.CallModel.deleteMany();

      // Create a new Call document
      const newCall = new this.CallModel({ call: 0 });
      await newCall.save();

      console.log('Call model re-initialized successfully.');
    } catch (error) {
      console.error('Error initializing Call model:', error);
    }
  }

  async getGasPrice() {
    try {
      // Define all API calls
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

      // Execute all API calls simultaneously
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

      // Return the results in an object
      return {
        bnbPrice: bnbPriceResponse.data,
        bnbGas: bnbGasResponse.data,
        ethPrice: ethPriceResponse.data,
        ethGas: ethGasResponse.data,
      };
    } catch (error) {
      console.error('Error getting gas:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  async trackEthTransactions(
    walletAddress: string,
    user: UserDocument,
  ): Promise<void> {
    const apiKeys = [
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
      process.env.MORALIS_API_34,
      process.env.MORALIS_API_35,
    ];

    const swapUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/swaps?chain=eth&order=DESC`;

    try {
      // Fetch the current API key index from the database
      const apiKeyIndex = await this.CallModel.findOne();
      const currentApiKey = apiKeys[apiKeyIndex.call];

      // Make the API request to Moralis
      const response = await this.httpService.axiosRef.get(swapUrl, {
        headers: { 'X-API-Key': currentApiKey },
      });

      const transactions = response.data.result;
      if (!transactions || transactions.length === 0) {
        return; // No transactions to process
      }

      // Define time range: last 24 hours
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Filter transactions from the last 24 hours
      const recentTransactions = transactions.filter(
        (tx) => new Date(tx.blockTimestamp) >= twentyFourHoursAgo,
      );

      if (recentTransactions.length === 0) {
        return; // No recent transactions
      }

      // Fetch existing transactions from the database for this wallet
      const existingTransactions = await this.TransactionModel.find({
        wallet: walletAddress.toLowerCase(),
      });
      const transactionMap = new Map(
        existingTransactions.map((tx: any) => [
          `${tx.txHash}-${tx.txIndex}`,
          tx,
        ]),
      );

      // Process each transaction
      for (const tx of recentTransactions) {
        const txKey = `${tx.transactionHash}-${tx.transactionIndex}`;

        // Skip if the transaction already exists
        if (transactionMap.has(txKey)) {
          console.log(`Transaction ${txKey} already exists, skipping...`);
          continue; // Skip this transaction, but keep processing others
        }

        // Alert the transaction
        this.alertTransaction(tx); // Placeholder for your alert function

        // Save the new transaction to the database
        const newTransaction = new this.TransactionModel({
          wallet: walletAddress.toLowerCase(),
          chain: 'eth',
          type: tx.transactionType,
          txHash: tx.transactionHash,
          txIndex: tx.transactionIndex,
          blockTimestamp: tx.blockTimestamp,
          tokenOutName: tx.sold.name,
          tokenOutSymbol: tx.sold.symbol,
          tokenOutAddress: tx.sold.address,
          tokenOutLogo: tx.sold.logo,
          tokenOutAmount: tx.sold.amount,
          tokenOutAmountUsd: tx.sold.usdAmount,
          tokenInName: tx.bought.name,
          tokenInSymbol: tx.bought.symbol,
          tokenInAddress: tx.bought.address,
          tokenInLogo: tx.bought.logo,
          tokenInAmount: tx.bought.amount,
          tokenInAmountUsd: tx.bought.usdAmount,
        });

        try {
          await newTransaction.save();

          //TODO:EMIT the new transaction socket here
          this.socketGateway.server.emit('onNewTransaction', {
            msg: 'New Transaction',
            content: {
              name: user.name || '',
              wallet: user.wallet || walletAddress.toLowerCase(),
              twitter: user.twitter || '',
              telegram: user.telegram || '',
              website: user.website || '',
              chains: user.chains || [],
              imageUrl: user.imageUrl || '',
              transaction: {
                wallet: walletAddress.toLowerCase(),
                chain: 'eth',
                type: tx.transactionType,
                txHash: tx.transactionHash,
                txIndex: tx.transactionIndex,
                blockTimestamp: tx.blockTimestamp,
                tokenOutName: tx.sold.name,
                tokenOutSymbol: tx.sold.symbol,
                tokenOutAddress: tx.sold.address,
                tokenOutLogo: tx.sold.logo,
                tokenOutAmount: tx.sold.amount,
                tokenOutAmountUsd: tx.sold.usdAmount,
                tokenInName: tx.bought.name,
                tokenInSymbol: tx.bought.symbol,
                tokenInAddress: tx.bought.address,
                tokenInLogo: tx.bought.logo,
                tokenInAmount: tx.bought.amount,
                tokenInAmountUsd: tx.bought.usdAmount,
              },
            },
          });
          transactionMap.set(txKey, newTransaction); // Update the map after saving
        } catch (saveError: any) {
          if (saveError.code === 11000) {
            console.log(`Duplicate transaction ${txKey} detected, skipping...`);
            continue; // Skip duplicates caught by the unique index
          }
          throw saveError; // Re-throw other errors
        }
      }
    } catch (error: any) {
      console.error('Error in trackTokens:', error.message || error);
    }
  }

  async trackBscTransactions(
    walletAddress: string,
    user: UserDocument,
  ): Promise<void> {
    const apiKeys = [
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
      process.env.MORALIS_API_34,
      process.env.MORALIS_API_35,
    ];

    const swapUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/swaps?chain=bsc&order=DESC`;

    try {
      // Fetch the current API key index from the database
      const apiKeyIndex = await this.CallModel.findOne();
      const currentApiKey = apiKeys[apiKeyIndex.call];

      // Make the API request to Moralis
      const response = await this.httpService.axiosRef.get(swapUrl, {
        headers: { 'X-API-Key': currentApiKey },
      });

      const transactions = response.data.result;
      if (!transactions || transactions.length === 0) {
        return; // No transactions to process
      }

      // Define time range: last 24 hours
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Filter transactions from the last 24 hours
      const recentTransactions = transactions.filter(
        (tx) => new Date(tx.blockTimestamp) >= twentyFourHoursAgo,
      );

      if (recentTransactions.length === 0) {
        return; // No recent transactions
      }

      // Fetch existing transactions from the database for this wallet
      const existingTransactions = await this.TransactionModel.find({
        wallet: walletAddress.toLowerCase(),
      });
      const transactionMap = new Map(
        existingTransactions.map((tx: any) => [
          `${tx.txHash}-${tx.txIndex}`,
          tx,
        ]),
      );

      // Process each transaction
      for (const tx of recentTransactions) {
        const txKey = `${tx.transactionHash}-${tx.transactionIndex}`;

        // Skip if the transaction already exists
        if (transactionMap.has(txKey)) {
          console.log(`Transaction ${txKey} already exists, skipping...`);
          continue; // Skip this transaction, but keep processing others
        }

        // Alert the transaction
        this.alertTransaction(tx); // Placeholder for your alert function

        // Save the new transaction to the database
        const newTransaction = new this.TransactionModel({
          wallet: walletAddress.toLowerCase(),
          chain: 'bsc',
          type: tx.transactionType,
          txHash: tx.transactionHash,
          txIndex: tx.transactionIndex,
          blockTimestamp: tx.blockTimestamp,
          tokenOutName: tx.sold.name,
          tokenOutSymbol: tx.sold.symbol,
          tokenOutAddress: tx.sold.address,
          tokenOutAmount: tx.sold.amount,
          tokenOutAmountUsd: tx.sold.usdAmount,
          tokenInName: tx.bought.name,
          tokenInSymbol: tx.bought.symbol,
          tokenInAddress: tx.bought.address,
          tokenInAmount: tx.bought.amount,
          tokenInAmountUsd: tx.bought.usdAmount,
        });

        try {
          await newTransaction.save();

          //TODO:EMIT the new transaction socket here
          this.socketGateway.server.emit('onNewTransaction', {
            msg: 'New Transaction',
            content: {
              name: user.name || '',
              wallet: user.wallet || walletAddress.toLowerCase(),
              twitter: user.twitter || '',
              telegram: user.telegram || '',
              website: user.website || '',
              chains: user.chains || [],
              imageUrl: user.imageUrl || '',
              transaction: {
                wallet: walletAddress.toLowerCase(),
                chain: 'bsc',
                type: tx.transactionType,
                txHash: tx.transactionHash,
                txIndex: tx.transactionIndex,
                blockTimestamp: tx.blockTimestamp,
                tokenOutName: tx.sold.name,
                tokenOutSymbol: tx.sold.symbol,
                tokenOutAddress: tx.sold.address,
                tokenOutLogo: tx.sold.logo,
                tokenOutAmount: tx.sold.amount,
                tokenOutAmountUsd: tx.sold.usdAmount,
                tokenInName: tx.bought.name,
                tokenInSymbol: tx.bought.symbol,
                tokenInAddress: tx.bought.address,
                tokenInLogo: tx.bought.logo,
                tokenInAmount: tx.bought.amount,
                tokenInAmountUsd: tx.bought.usdAmount,
              },
            },
          });
          transactionMap.set(txKey, newTransaction); // Update the map after saving
        } catch (saveError: any) {
          if (saveError.code === 11000) {
            console.log(`Duplicate transaction ${txKey} detected, skipping...`);
            continue; // Skip duplicates caught by the unique index
          }
          throw saveError; // Re-throw other errors
        }
      }
    } catch (error: any) {
      console.error('Error in trackTokens:', error.message || error);
    }
  }

  async trackBaseTransactions(
    walletAddress: string,
    user: UserDocument,
  ): Promise<void> {
    const apiKeys = [
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
      process.env.MORALIS_API_34,
      process.env.MORALIS_API_35,
    ];

    const swapUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/swaps?chain=base&order=DESC`;

    try {
      // Fetch the current API key index from the database
      const apiKeyIndex = await this.CallModel.findOne();
      const currentApiKey = apiKeys[apiKeyIndex.call];

      // Make the API request to Moralis
      const response = await this.httpService.axiosRef.get(swapUrl, {
        headers: { 'X-API-Key': currentApiKey },
      });

      const transactions = response.data.result;
      if (!transactions || transactions.length === 0) {
        return; // No transactions to process
      }

      // Define time range: last 24 hours
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Filter transactions from the last 24 hours
      const recentTransactions = transactions.filter(
        (tx) => new Date(tx.blockTimestamp) >= twentyFourHoursAgo,
      );

      if (recentTransactions.length === 0) {
        return; // No recent transactions
      }

      // Fetch existing transactions from the database for this wallet
      const existingTransactions = await this.TransactionModel.find({
        wallet: walletAddress.toLowerCase(),
      });
      const transactionMap = new Map(
        existingTransactions.map((tx: any) => [
          `${tx.txHash}-${tx.txIndex}`,
          tx,
        ]),
      );

      // Process each transaction
      for (const tx of recentTransactions) {
        const txKey = `${tx.transactionHash}-${tx.transactionIndex}`;

        // Skip if the transaction already exists
        if (transactionMap.has(txKey)) {
          console.log(`Transaction ${txKey} already exists, skipping...`);
          continue; // Skip this transaction, but keep processing others
        }

        // Alert the transaction
        this.alertTransaction(tx); // Placeholder for your alert function

        // Save the new transaction to the database
        const newTransaction = new this.TransactionModel({
          wallet: walletAddress.toLowerCase(),
          chain: 'base',
          type: tx.transactionType,
          txHash: tx.transactionHash,
          txIndex: tx.transactionIndex,
          blockTimestamp: tx.blockTimestamp,
          tokenOutName: tx.sold.name,
          tokenOutSymbol: tx.sold.symbol,
          tokenOutAddress: tx.sold.address,
          tokenOutAmount: tx.sold.amount,
          tokenOutAmountUsd: tx.sold.usdAmount,
          tokenInName: tx.bought.name,
          tokenInSymbol: tx.bought.symbol,
          tokenInAddress: tx.bought.address,
          tokenInAmount: tx.bought.amount,
          tokenInAmountUsd: tx.bought.usdAmount,
        });

        try {
          await newTransaction.save();

          //TODO:EMIT the new transaction socket here
          this.socketGateway.server.emit('onNewTransaction', {
            msg: 'New Transaction',
            content: {
              name: user.name || '',
              wallet: user.wallet || walletAddress.toLowerCase(),
              twitter: user.twitter || '',
              telegram: user.telegram || '',
              website: user.website || '',
              chains: user.chains || [],
              imageUrl: user.imageUrl || '',
              transaction: {
                wallet: walletAddress.toLowerCase(),
                chain: 'base',
                type: tx.transactionType,
                txHash: tx.transactionHash,
                txIndex: tx.transactionIndex,
                blockTimestamp: tx.blockTimestamp,
                tokenOutName: tx.sold.name,
                tokenOutSymbol: tx.sold.symbol,
                tokenOutAddress: tx.sold.address,
                tokenOutLogo: tx.sold.logo,
                tokenOutAmount: tx.sold.amount,
                tokenOutAmountUsd: tx.sold.usdAmount,
                tokenInName: tx.bought.name,
                tokenInSymbol: tx.bought.symbol,
                tokenInAddress: tx.bought.address,
                tokenInLogo: tx.bought.logo,
                tokenInAmount: tx.bought.amount,
                tokenInAmountUsd: tx.bought.usdAmount,
              },
            },
          });
          transactionMap.set(txKey, newTransaction); // Update the map after saving
        } catch (saveError: any) {
          if (saveError.code === 11000) {
            console.log(`Duplicate transaction ${txKey} detected, skipping...`);
            continue; // Skip duplicates caught by the unique index
          }
          throw saveError; // Re-throw other errors
        }
      }
    } catch (error: any) {
      console.error('Error in trackTokens:', error.message || error);
    }
  }

  // Helper method to track transactions for a single user across all chains
  // private async trackUserTransactions(wallet: string): Promise<void> {
  //   try {
  //     console.log(`Tracking transactions for wallet: ${wallet}`);

  //     // Call all three tracking functions simultaneously for this wallet
  //     await Promise.all([
  //       this.trackEthTransactions(wallet),
  //       this.trackBscTransactions(wallet),
  //       this.trackBaseTransactions(wallet),
  //     ]);

  //     console.log(`Completed tracking for wallet: ${wallet}`);
  //   } catch (error: any) {
  //     console.error(
  //       `Error tracking transactions for wallet ${wallet}:`,
  //       error.message || error,
  //     );
  //     // Don’t throw here to allow other users’ tracking to continue
  //   }
  // }

  private async trackUserTransactions(
    wallet: string,
    chains: string[],
    user: UserDocument,
  ): Promise<void> {
    // If chains array is empty, return early
    if (!chains || chains.length === 0) {
      console.log(`No chains specified for wallet: ${wallet}`);
      return;
    }

    try {
      console.log(
        `Tracking transactions for wallet: ${wallet} on chains: ${chains.join(', ')}`,
      );

      // Create array of tracking promises based on specified chains
      const trackingPromises = [];

      if (chains.includes('eth')) {
        trackingPromises.push(this.trackEthTransactions(wallet, user));
      }
      if (chains.includes('bsc')) {
        trackingPromises.push(this.trackBscTransactions(wallet, user));
      }
      if (chains.includes('base')) {
        trackingPromises.push(this.trackBaseTransactions(wallet, user));
      }

      // Execute all applicable tracking functions simultaneously
      await Promise.all(trackingPromises);

      console.log(`Completed tracking for wallet: ${wallet}`);
    } catch (error: any) {
      console.error(
        `Error tracking transactions for wallet ${wallet}:`,
        error.message || error,
      );
      // Don’t throw here to allow other users’ tracking to continue
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

      // Process all users simultaneously
      const userPromises = users.map((user) =>
        this.trackUserTransactions(user.wallet, user.chains, user),
      );

      // Wait for all users' tracking to complete
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

  // Placeholder for your alert logic
  private alertTransaction(transaction: any): void {
    console.log(
      `Alert: New transaction detected - \nHash: ${transaction.transactionHash}\n ${transaction.walletAddress}\n ${transaction.transactionType}\n${transaction.bought.symbol} for ${transaction.sold.symbol}`,
    );
    // Add your alerting mechanism here (e.g., send to a queue, notify via API, etc.)
  }

  // @Cron(process.env.CRON || '*/30 * * * * *') // Executes every 30 seconds
  @Cron('*/4 * * * *')
  async handleCron(): Promise<void> {
    try {
      this.logger.log('Executing token tracking cron job...');
      await this.trackAllUsersTransactions();

      // Call the token tracking function
      // await this.trackEthTransactions(process.env.EVM_WALLET);
      // await this.trackBscTransactions(process.env.EVM_WALLET);
      // await this.trackBaseTransactions(process.env.EVM_WALLET);

      // Fetch the current API call index from the database
      const apiIndex = await this.CallModel.findOne(); // Assume only one document exists

      if (!apiIndex) {
        this.logger.error('Call document not found!');
        return;
      }

      // Calculate the new call index
      const newCall = (apiIndex.call + 1) % 35; // Increment and wrap back to 0 after 5

      // Update the database with the new call index
      await this.CallModel.findByIdAndUpdate(apiIndex._id, {
        call: newCall,
      });

      this.logger.log(`Updated call index to ${newCall}`);
    } catch (error) {
      console.log(error);
    }
  }
}
