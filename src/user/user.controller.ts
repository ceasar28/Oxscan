import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  UsePipes,
  ValidationPipe,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service'; // Adjust path
import { UserDto } from './dto/user.dto'; // Adjust path
import { TransactionDto } from '../socket/dto/transaction.dto'; // Adjust path based on your structure

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Create a new user
  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createUser(@Body() userDto: UserDto): Promise<UserDto> {
    return this.userService.newUser(userDto);
  }

  // Update an existing user
  @Patch(':wallet')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateUser(
    @Param('wallet') wallet: string,
    @Body() userDto: Partial<UserDto>,
  ): Promise<UserDto> {
    return this.userService.updateUser(wallet, userDto);
  }

  // Fetch all users
  @Get()
  async getAllUsers(): Promise<UserDto[]> {
    return this.userService.getAllUsers();
  }

  // Fetch all users with their details and latest transactions
  @Get('all-users-transactions')
  async getAllUsersTransactions(
    @Query('chain') chain?: string,
    @Query('limit') limit?: string,
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
    console.log('hereee');
    const transactionLimit = limit ? parseInt(limit, 10) : undefined;
    return this.userService.getAllUsersWithTransactions(
      chain,
      transactionLimit,
    );
  }

  // Fetch a single user by wallet
  @Get(':wallet')
  async getUser(@Param('wallet') wallet: string): Promise<UserDto> {
    return this.userService.getUser(wallet);
  }

  // Fetch a user's transactions
  //   @Get(':wallet/transactions')
  //   async getUserTransactions(
  //     @Param('wallet') wallet: string,
  //   ): Promise<TransactionDto[]> {
  //     return this.userService.getAUsersTransactions(wallet, 'eth', 3);
  //   }

  // Fetch a user's transactions
  @Get(':wallet/transactions')
  async getUserTransactions(
    @Param('wallet') wallet: string,
    @Query('chain') chain?: string,
    @Query('limit') limit?: string,
  ): Promise<TransactionDto[]> {
    const transactionLimit = limit ? parseInt(limit, 10) : undefined;

    return this.userService.getAUsersTransactions(
      wallet,
      chain,
      transactionLimit,
    );
  }

  // Fetch a user's token profitability (PNL)
  @Get(':wallet/tokens-pnl')
  async getUserTokensPnl(
    @Param('wallet') wallet: string,
    @Query('chain') chain: string,
    @Query('tokens') tokens: string, // Expecting a comma-separated string of token addresses
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
    if (!chain) {
      throw new BadRequestException('Chain parameter is required');
    }

    // Convert comma-separated tokens string to array
    const tokenArray = tokens ? tokens.split(',').map((t) => t.trim()) : [];
    if (tokenArray.length === 0) {
      throw new BadRequestException('At least one token address is required');
    }

    const results = await this.userService.getUserTokensPnl(
      wallet,
      chain,
      tokenArray,
    );
    if (!results || results.length === 0) {
      throw new NotFoundException(
        `No PNL data found for wallet ${wallet} on chain ${chain}`,
      );
    }
    return results;
  }

  // Seed the database (optional endpoint)
  @Post('seed')
  async seedDatabase(): Promise<{ message: string }> {
    await this.userService.seedDatabase();
    return { message: 'Database seeded with dummy user' };
  }
}
