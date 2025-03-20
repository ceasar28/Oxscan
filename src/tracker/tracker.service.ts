import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Call } from 'src/database/schemas/moralisCalls.schema';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { User } from 'src/database/schemas/user.schema';
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
    this.initializeCallModel();
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

  async trackTokens(walletAddress: string): Promise<void> {
    const apiKeys = [
      process.env.MORALIS_API_1,
      process.env.MORALIS_API_2,
      process.env.MORALIS_API_3,
      process.env.MORALIS_API_4,
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
              wallet: walletAddress.toLowerCase(),
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

  // Placeholder for your alert logic
  private alertTransaction(transaction: any): void {
    console.log(
      `Alert: New transaction detected - \nHash: ${transaction.transactionHash}\n ${transaction.walletAddress}\n ${transaction.transactionType}\n${transaction.bought.symbol} for ${transaction.sold.symbol}`,
    );
    // Add your alerting mechanism here (e.g., send to a queue, notify via API, etc.)
  }

  @Cron(process.env.CRON || '*/30 * * * * *') // Executes every 30 seconds
  async handleCron(): Promise<void> {
    this.logger.log('Executing token tracking cron job...');
    // Call the token tracking function
    await this.trackTokens(process.env.EVM_WALLET);

    // Fetch the current API call index from the database
    const apiIndex = await this.CallModel.findOne(); // Assume only one document exists

    if (!apiIndex) {
      this.logger.error('Call document not found!');
      return;
    }

    // Calculate the new call index
    const newCall = (apiIndex.call + 1) % 4; // Increment and wrap back to 0 after 3

    // Update the database with the new call index
    await this.CallModel.findByIdAndUpdate(apiIndex._id, { call: newCall });

    this.logger.log(`Updated call index to ${newCall}`);
  }
}
