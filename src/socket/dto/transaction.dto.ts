import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransactionDto {
  @ApiProperty({
    description: 'The wallet address associated with the transaction',
  })
  @IsString()
  @IsNotEmpty()
  wallet: string;

  @ApiProperty({ description: 'Type of the transaction' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Transaction hash (unique identifier)' })
  @IsString()
  @IsNotEmpty()
  txHash: string;

  @ApiProperty({ description: 'Transaction index within the block' })
  @IsNumber()
  @IsNotEmpty()
  txIndex: number;

  @ApiProperty({
    description: 'Timestamp of the block containing the transaction',
  })
  @IsString()
  @IsNotEmpty()
  blockTimestamp: string;

  @ApiProperty({ description: 'Symbol of the token being sold' })
  @IsString()
  @IsNotEmpty()
  tokenOutSymbol: string;

  @ApiProperty({ description: 'Name of the token being sold' })
  @IsString()
  @IsNotEmpty()
  tokenOutName: string;

  @ApiProperty({ description: 'Address of the token being sold' })
  @IsString()
  @IsNotEmpty()
  tokenOutAddress: string;

  @ApiProperty({ description: 'Amount of the token being sold' })
  @IsString()
  @IsNotEmpty()
  tokenOutAmount: string;

  @ApiProperty({ description: 'USD value of the token being sold' })
  @IsString()
  @IsNotEmpty()
  tokenOutAmountUsd: string;

  @ApiProperty({ description: 'Symbol of the token being bought' })
  @IsString()
  @IsNotEmpty()
  tokenInSymbol: string;

  @ApiProperty({ description: 'Name of the token being bought' })
  @IsString()
  @IsNotEmpty()
  tokenInName: string;

  @ApiProperty({ description: 'Address of the token being bought' })
  @IsString()
  @IsNotEmpty()
  tokenInAddress: string;

  @ApiProperty({ description: 'Amount of the token being bought' })
  @IsString()
  @IsNotEmpty()
  tokenInAmount: string;

  @ApiProperty({ description: 'USD value of the token being bought' })
  @IsString()
  @IsNotEmpty()
  tokenInAmountUsd: string;
}
