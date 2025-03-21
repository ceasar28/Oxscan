import {
  Controller,
  Get,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
      return leaderboard;
    }
    return leaderboard;
  }
}
