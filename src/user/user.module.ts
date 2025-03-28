import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/database/schemas/user.schema';
import {
  Transaction,
  TransactionSchema,
} from 'src/database/schemas/transactions.schema';
import { Call, CallSchema } from 'src/database/schemas/moralisCalls.schema';
import { HttpModule } from '@nestjs/axios';
import { TrackerModule } from 'src/tracker/tracker.module';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
    TrackerModule,
  ],
  providers: [UserService],
  controllers: [UserController],
})
export class UserModule {}
