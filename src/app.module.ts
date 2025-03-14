import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MachineModule } from './machine/machine.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(), // 添加定时任务支持
    MachineModule,
    MongooseModule.forRoot('mongodb://localhost:27017/machine'),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
