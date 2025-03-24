import { Module } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { TrackerController } from './tracker.controller';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from 'src/database/database.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Call, CallSchema } from 'src/database/schemas/moralisCalls.schema';
import { User, UserSchema } from 'src/database/schemas/user.schema';
import {
  Transaction,
  TransactionSchema,
} from 'src/database/schemas/transactions.schema';
import { SocketGateway } from 'src/socket/socket.gateway';

@Module({
  imports: [
    HttpModule,
    DatabaseModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  exports: [TrackerService],
  providers: [TrackerService, SocketGateway],
  controllers: [TrackerController],
})
export class TrackerModule {}
