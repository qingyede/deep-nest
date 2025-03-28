// gpu-machine/gpu-machine.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GpuMachine } from './gpu.schema';
import { CreateGpuMachineDto } from './dto/create-gpu-machine.dto';
import { GpuWeb3Service } from '../gpu-web3/gpu-web3.service';

@Injectable()
export class GpuMachineService {
  constructor(
    @InjectModel(GpuMachine.name) private gpuMachineModel: Model<GpuMachine>,
    private readonly blockchainService: GpuWeb3Service,
  ) {}

  async create(createGpuMachineDto: CreateGpuMachineDto): Promise<any> {
    try {
      const { machineId, walletAddress } = createGpuMachineDto;
      const machineInfo =
        await this.blockchainService.getMachineInfoForDBCScan(machineId);
      const newGpuMachine = new this.gpuMachineModel({
        machineId,
        walletAddress,
        ...machineInfo,
      });
      const savedMachine = await newGpuMachine.save();
      return {
        code: 1000,
        msg: 'Machine created successfully',
        data: savedMachine,
      };
    } catch (error) {
      return {
        code: 1001,
        msg: `Failed to create machine: ${error.message}`,
        data: null,
      };
    }
  }

  async findByWalletAddress(walletAddress: string): Promise<any> {
    try {
      const machines = await this.gpuMachineModel
        .find({ walletAddress })
        .exec();
      return {
        code: 1000,
        msg: 'Machines retrieved successfully',
        data: machines,
      };
    } catch (error) {
      return {
        code: 1001,
        msg: `Failed to retrieve machines: ${error.message}`,
        data: [],
      };
    }
  }

  async deleteByWalletAddress(walletAddress: string): Promise<any> {
    try {
      const result = await this.gpuMachineModel
        .deleteMany({ walletAddress })
        .exec();
      return {
        code: 1000,
        msg: `Deleted ${result.deletedCount} machines for wallet ${walletAddress}`,
        data: { deletedCount: result.deletedCount },
      };
    } catch (error) {
      return {
        code: 1001,
        msg: `Failed to delete machines: ${error.message}`,
        data: { deletedCount: 0 },
      };
    }
  }
}
