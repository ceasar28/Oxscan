import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  UsePipes,
  ValidationPipe,
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

  // Fetch a single user by wallet
  @Get(':wallet')
  async getUser(@Param('wallet') wallet: string): Promise<UserDto> {
    return this.userService.getUser(wallet);
  }

  // Fetch a user's transactions
  @Get(':wallet/transactions')
  async getUserTransactions(
    @Param('wallet') wallet: string,
  ): Promise<TransactionDto[]> {
    return this.userService.getAUsersTransactions(wallet, 'eth', 3);
  }

  // Seed the database (optional endpoint)
  @Post('seed')
  async seedDatabase(): Promise<{ message: string }> {
    await this.userService.seedDatabase();
    return { message: 'Database seeded with dummy user' };
  }
}
