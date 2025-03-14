// src/blockchain/blockchain.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Machine, MachineSchema } from '../machine/machine.schema';
import { BlockchainScheduler } from './blockchain.scheduler';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Machine.name, schema: MachineSchema }]),
    ConfigModule, // 添加 ConfigModule
  ],
  providers: [BlockchainService, BlockchainScheduler],
  exports: [BlockchainService],
})
export class BlockchainModule {}
