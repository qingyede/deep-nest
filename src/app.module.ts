import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MachineModule } from './machine/machine.module';
import { MongooseModule } from '@nestjs/mongoose';
// import { ScheduleModule } from '@nestjs/schedule';

import { ConfigModule } from '@nestjs/config';
@Module({
  imports: [
    // ScheduleModule.forRoot(), // 添加定时任务支持
    MachineModule,
    MongooseModule.forRoot('mongodb://localhost:27017/machine'),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'test'}`, // 动态加载 .env.test 或 .env.production
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
