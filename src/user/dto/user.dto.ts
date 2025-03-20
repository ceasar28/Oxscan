import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; // Optional: for Swagger documentation

export class UserDto {
  @ApiProperty({ description: 'The name of the user' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'The unique wallet address of the user' })
  @IsString()
  @IsNotEmpty()
  wallet: string;

  @ApiProperty({ description: 'Twitter handle of the user' })
  @IsString()
  @IsOptional()
  twitter?: string;

  @ApiProperty({ description: 'Twitter handle of the user' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: 'Telegram handle of the user' })
  @IsString()
  @IsOptional()
  telegram?: string;

  @ApiProperty({ description: 'Website URL of the user' })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiProperty({ description: 'Total profit of the user' })
  @IsString()
  @IsOptional()
  profit?: string;

  @ApiProperty({ description: 'Total loss of the user' })
  @IsString()
  @IsOptional()
  loss?: string;
}
