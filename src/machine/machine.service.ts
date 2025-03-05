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
    // 检查数据库中是否已存在相同的 machineId
    const existingMachine = await this.MachineModel.findOne({
      machineId: createMachineDto.machineId,
    }).exec();
    if (existingMachine) {
      return {
        msg: 'Machine already exists',
        code: 1001,
      };
    }

    const mashineData = await this.getMachineBalance(
      createMachineDto.machineId,
    );
    console.log(mashineData, '/////');
    createMachineDto.machineInfo = mashineData;
    // 如果不存在，创建新记录
    const createdMachine = new this.MachineModel(createMachineDto);
    return createdMachine.save();
  }

  async findAll(address): Promise<any> {
    const rs = await this.MachineModel.find(address);
    console.log(rs, '////');

    return {
      code: 1000,
      msg: '查询成功',
      data: rs,
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

  async remove(machineId: string): Promise<any> {
    return this.MachineModel.findByIdAndDelete(machineId).exec();
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
}
