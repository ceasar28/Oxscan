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
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service'; // Adjust path
import { UserDto } from './dto/user.dto'; // Adjust path
import { TransactionDto } from '../socket/dto/transaction.dto'; // Adjust path based on your structure

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

  // Delete a user by wallet address
  @Delete(':wallet')
  async deleteUser(
    @Param('wallet') wallet: string,
  ): Promise<{ message: string }> {
    return this.userService.deleteUser(wallet);
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

  // Fetch PNL leaderboard for all users on a given chain
  @Get('pnl-leaderboard')
  async getPnlLeaderBoard(@Query('chain') chain: string): Promise<
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
    if (!chain) {
      throw new BadRequestException('Chain parameter is required');
    }

    const leaderboard = await this.userService.getPnlLeaderBoard(chain);
    if (!leaderboard || leaderboard.length === 0) {
      throw new NotFoundException(`No PNL data found for chain ${chain}`);
    }
    return leaderboard;
  }

  // Fetch PNL leaderboard for all users on a given chain
  @Get('pnl-leaderboard-v2')
  async getBscPnlLeaderBoard(
    @Query('chain') chain: string,
    @Query('duration')
    timeFilter: 'all' | '1' | '3' | '7' | '14' | '30' = 'all',
  ): Promise<PnlLeaderboardEntry[]> {
    if (!chain) {
      throw new BadRequestException('Chain parameter is required');
    }

    const leaderboard = await this.userService.getDbPnlLeaderBoard(
      chain,
      timeFilter,
    );
    if (!leaderboard || leaderboard.length === 0) {
      throw new NotFoundException(`No PNL data found for chain ${chain}`);
    }
    return leaderboard;
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
    @Query('duration')
    timeFilter: 'all' | '1' | '3' | '7' | '14' | '30' = 'all',
  ): Promise<TokenPnlResult[]> {
    if (!chain) {
      throw new BadRequestException('Chain parameter is required');
    }
    // Convert comma-separated tokens string to array
    const tokenArray = tokens ? tokens.split(',').map((t) => t.trim()) : [];
    if (tokenArray.length === 0) {
      throw new BadRequestException('At least one token address is required');
    }

    const results = await this.userService.calculateUserTokensPnl(
      wallet,
      chain,
      tokenArray,
      timeFilter,
    );
    if (!results || results.length === 0) {
      throw new NotFoundException(
        `No PNL data found for wallet ${wallet} on chain ${chain}`,
      );
    }
    return results;
  }

  //   @Get(':wallet/bsc-tokens-pnl')
  //   async getUserBscTokensPnl(
  //     @Param('wallet') wallet: string,
  //     @Query('token') tokens: string, // Expecting a comma-separated string of token addresses
  //   ): Promise<
  //     {
  //       tokenAddress: string;
  //       tokenName: string;
  //       tokenSymbol: string;
  //       tradeCount: number;
  //       totalBuys: number;
  //       totalSells: number;
  //       totalTokenBought: string;
  //       totalTokenBoughtUSD: string;
  //       totalTokenSold: string;
  //       totalTokenSoldUSD: string;
  //       pnlUSD: string;
  //       pnlPercentage: number;
  //     }[]
  //   > {
  //     const results = await this.userService.getUserTokensPnl(wallet);
  //     if (!results || results.length === 0) {
  //       throw new NotFoundException(
  //         `No PNL data found for wallet ${wallet} on chain ${chain}`,
  //       );
  //     }
  //     return results;
  //   }

  // Fetch a user's top token holdings
  @Get(':wallet/top-holdings')
  async getUserTopHoldings(
    @Param('wallet') wallet: string,
    @Query('chain') chain: string,
  ): Promise<
    {
      tokenAddress: string;
      tokenName: string;
      tokenSymbol: string;
      tokenBalance: string;
      tokenBalanceUSD: number;
    }[]
  > {
    if (!chain) {
      throw new BadRequestException('Chain parameter is required');
    }

    const results = await this.userService.getUserTopHoldings(wallet, chain);
    if (!results || results.length === 0) {
      throw new NotFoundException(
        `No token holdings found for wallet ${wallet} on chain ${chain}`,
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
