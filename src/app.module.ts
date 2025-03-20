import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TrackerModule } from './tracker/tracker.module';
import { DatabaseModule } from './database/database.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SocketModule } from './socket/socket.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    TrackerModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    SocketModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
