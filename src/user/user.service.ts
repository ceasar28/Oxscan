import { Injectable, NotFoundException } from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/database/schemas/user.schema';
import { TransactionDto } from 'src/socket/dto/transaction.dto';
import { Transaction } from 'src/database/schemas/transactions.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(Transaction.name)
    private readonly TransactionModel: Model<Transaction>,
  ) {
    this.UserModel.deleteOne({
      wallet: '0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13'.toLowerCase(),
    });
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

  async getAUsersTransactions(
    walletAddress: string,
  ): Promise<TransactionDto[]> {
    try {
      const transactions = await this.TransactionModel.find({
        wallet: walletAddress.toLowerCase(),
      }).exec();

      if (!transactions || transactions.length === 0) {
        console.log(`No transactions found for wallet: ${walletAddress}`);
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
        error.message || error,
      );
      throw error;
    }
  }

  // New method to seed the database
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

      // Check if the user already exists
      const existingUser = await this.UserModel.findOne({
        wallet: dummyUser.wallet,
      });
      if (existingUser) {
        console.log(
          `User with wallet ${dummyUser.wallet} already exists, skipping seeding`,
        );
        return;
      }

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
