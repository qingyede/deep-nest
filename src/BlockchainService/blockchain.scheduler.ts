// src/blockchain/blockchain.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BlockchainService } from './blockchain.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Machine } from '../machine/machine.schema';

@Injectable()
export class BlockchainScheduler {
  private readonly logger = new Logger(BlockchainScheduler.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    @InjectModel(Machine.name) private readonly MachineModel: Model<Machine>,
  ) {}

  // 每 10 秒执行一次
  @Interval(100000) // 10000 毫秒 = 10 秒
  async handleUnstakeTask() {
    this.logger.log('开始执行自动解除质押任务');

    try {
      // 查询数据库中所有机器
      const machines = await this.MachineModel.find().exec();
      this.logger.log(`找到 ${machines.length} 台机器`);

      if (!machines.length) {
        this.logger.log('数据库中没有机器记录，任务结束');
        return;
      }

      // 遍历所有机器，仅调用 unstake
      for (const machine of machines) {
        const machineId = machine.machineId;
        this.logger.log(`准备解除质押: ${machineId}`);

        // 直接调用 unstake 方法
        const result = await this.blockchainService.unstake(machineId);
        this.logger.log(`解除质押结果: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      this.logger.error('自动解除质押任务失败', error.stack);
    }
  }
}
