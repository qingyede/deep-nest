import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Machine } from './machine.schema';
import { BlockchainService } from '../BlockchainService/blockchain.service';

@Injectable()
export class MachineService {
  constructor(
    @InjectModel(Machine.name) private MachineModel: Model<Machine>,
    private blockchainService: BlockchainService,
  ) {}

  async create(createMachineDto): Promise<any> {
    try {
      const existingMachine = await this.MachineModel.findOne({
        machineId: createMachineDto.machineId,
      });
      if (existingMachine) {
        return {
          msg: 'Machine already exists',
          code: 1001,
        };
      } else {
        console.log(createMachineDto, '传过来的参数');
        return await this.blockchainService.stake(createMachineDto);
      }
    } catch (error) {
      console.error('Create machine failed:', error);
      return {
        code: 1002,
        msg: `创建机器失败: ${error.message}`,
      };
    }
  }

  async findAll(address): Promise<any> {
    const machines: any = await this.MachineModel.find({ address });
    console.log(machines, '查询机器信息');
    // 2. 遍历机器列表，调用合约更新数据
    const updatedMachines = await Promise.all(
      machines.map(async (machine) => {
        const machineDataFromContract = await this.getMachineBalance(
          machine.machineId,
        );
        console.log(machineDataFromContract, '从合约获取的机器信息');

        // 3. 更新数据库
        if (machineDataFromContract) {
          await this.MachineModel.updateOne(
            { _id: machine._id },
            { machineInfo: machineDataFromContract },
          );

          // 4. 更新 machineInfo 并返回最新数据
          return {
            ...machine.toObject(),
            machineInfo: machineDataFromContract,
          };
        }

        return machine.toObject();
      }),
    );
    return {
      code: 1000,
      msg: '查询成功',
      data: updatedMachines,
    };
  }

  async findOne(machineId: string): Promise<Machine> {
    return this.MachineModel.findById(machineId).exec();
  }

  async update(machineId: string, machine: Machine): Promise<Machine> {
    return this.MachineModel.findByIdAndUpdate(machineId, machine, {
      new: true,
    }).exec();
  }

  // 解除质押删除机器
  async remove(machineId: string): Promise<any> {
    const rs = await this.MachineModel.deleteOne({ machineId });
    console.log(rs, '解除质押删除机器');
    if (rs.acknowledged) {
      return {
        msg: '删除成功',
        code: 200,
      };
    } else {
      return {
        msg: '删除失败',
        code: 1001,
      };
    }
  }

  // 删除所有数据
  async removeAll(): Promise<any> {
    const rs = await this.MachineModel.deleteMany({});
    if (rs.acknowledged) {
      return {
        msg: '删除成功',
        code: 1000,
      };
    }
  }

  // 新增：查询机器地址的代币余额
  async getMachineBalance(mashineId: string): Promise<any> {
    return this.blockchainService.getMachineInfoForDBCScan(mashineId);
  }

  // 领取奖励
  async reward(machineId: string): Promise<any> {
    return this.blockchainService.claimReward(machineId);
  }

  // 获得质押时间
  // async getPledgeTime(machineId: string): Promise<any> {
  //   return this.blockchainService.getMachineTime(machineId);
  // }

  // 解除质押
  async unStake(machineId: string): Promise<any> {
    return this.blockchainService.unstake(machineId);
  }
}
