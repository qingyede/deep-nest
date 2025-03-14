// src/blockchain/blockchain.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as stakingContractAbi from './abi/stakingContractAbi.json'; // 加载 ABI
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Machine } from '../machine/machine.schema';

@Injectable()
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor(
    private configService: ConfigService,
    @InjectModel(Machine.name) private MachineModel: Model<Machine>,
  ) {
    const rpcUrl = 'https://rpc-testnet.dbcwallet.io';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // 读取私钥（建议从环境变量中获取）
    const privateKey =
      '4edcc831171df477093ae0f34b3141bbab9b6ac76bd95776793ef5129a3b266a';
    if (!privateKey) {
      throw new Error('Private key is missing in environment variables');
    }

    // 使用私钥创建 signer
    this.signer = new ethers.Wallet(privateKey, this.provider);

    // 连接合约，使用 signer 进行交易
    const contractAddress = '0x7FDC6ed8387f3184De77E0cF6D6f3B361F906C21';
    this.contract = new ethers.Contract(
      contractAddress,
      stakingContractAbi,
      this.signer, // 使用 signer 进行写操作
    );
  }

  // 调用 getMachineInfoForDBCScan 方法
  async getMachineInfoForDBCScan(machineId: string): Promise<any> {
    try {
      const result = await this.contract.getMachineInfoForDBCScan(machineId);
      console.log(1);
      return {
        isStaking: result.isStaking,
        gpuType: result.gpuType,
        gpuCount: Number(result.gpuCount),
        mem: ethers.formatUnits(result.mem, 0), // uint256，无小数
        projectName: result.projectName,
        totalRewardAmount: ethers.formatUnits(result.totalRewardAmount, 18), // 假设 18 位小数，需确认代币精度
        claimedRewardAmount: ethers.formatUnits(result.claimedRewardAmount, 18),
        lockedRewardAmount: ethers.formatUnits(result.lockedRewardAmount, 18),
      };
    } catch (error) {
      throw new Error(`Failed to fetch machine info: ${error.message}`);
    }
  }

  // 领取奖励
  async claimReward(machineId: string): Promise<any> {
    try {
      console.log(`Claiming reward for machineId: ${machineId}`);

      // 发送交易
      const tx = await this.contract.claim(machineId);
      console.log(`交易发送成功，交易哈希: ${tx.hash}`);

      // 等待交易确认
      const receipt = await tx.wait();
      console.log(
        `交易确认完成，区块号: ${receipt.blockNumber}, 状态: ${receipt.status}`,
      );

      // 检查交易状态
      if (receipt.status === 1) {
        return {
          success: true,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
        };
      } else {
        throw new Error('交易失败，可能是因为合约逻辑回滚');
      }
    } catch (error) {
      console.error('失败:', error);
      throw new Error(`Claim reward failed: ${error.message}`);
    }
  }

  // 获取质押时间解除质押
  // async unstake(machineId: string): Promise<any> {
  //   try {
  //     const result = await this.contract.getStakeEndTimestamp(machineId);
  //     // 返回状态和时间戳（仍使用 BigInt 类型）
  //     // return { ended: result === 0n, timestamp: result.toString(), code: 200 };
  //     if (result === 0n) {
  //       try {
  //         console.log(machineId);

  //         // 发送 stake 交易
  //         const tx = await this.contract.unStake(machineId);

  //         console.log(`解除质押交易已发送，交易x哈希: ${tx.hash}`);

  //         // 等待交易确认
  //         const receipt = await tx.wait();
  //         console.log(
  //           `交易已确认，区块号xx: ${receipt.blockNumber}, 状态: ${receipt.status}`,
  //         );

  //         // 检查交易状态
  //         if (receipt.status === 1) {
  //           // 在这里删除数据库中的数据
  //           // 删除数据库中的对应记录
  //           const deleteResult = await this.MachineModel.deleteOne({
  //             machineId,
  //           }).exec();
  //           if (deleteResult.deletedCount === 0) {
  //             console.warn(`数据库中未找到 machineId 为 ${machineId} 的机器`);
  //             return {
  //               code: 1001,
  //               success: true,
  //               transactionHash: tx.hash,
  //               blockNumber: receipt.blockNumber,
  //               msg: '解除质押成功,但是数据库中未找到机器',
  //             };
  //           } else {
  //             console.log(
  //               `成功从数据库中删除 machineId 为 ${machineId} 的机器`,
  //             );
  //             return {
  //               code: 1000,
  //               success: true,
  //               transactionHash: tx.hash,
  //               blockNumber: receipt.blockNumber,
  //               msg: '解除质押成功',
  //             };
  //           }
  //         } else {
  //           return {
  //             code: 1001,
  //             msg: '解除质押失败，可能是合约逻辑回滚',
  //           };
  //         }
  //       } catch (error) {
  //         return {
  //           code: 1001,
  //           success: false,
  //           msg: error.message,
  //         };
  //       }
  //     } else {
  //       return {
  //         ended: result === 0n,
  //         timestamp: result.toString(),
  //         code: 1001,
  //         msg: '质押还未结束，不能解除质押!',
  //       };
  //     }
  //   } catch (error) {
  //     throw new Error(`Failed to fetch machine info: ${error.message}`);
  //   }
  // }
  async unstake(machineId: string): Promise<any> {
    try {
      const result = await this.contract.getStakeEndTimestamp(machineId);
      console.log(`质押结束时间 for ${machineId}: ${result.toString()}`);
      if (result === 0n) {
        try {
          console.log(`尝试解除质押: ${machineId}`);
          const tx = await this.contract.unStake(machineId);
          console.log(`解除质押交易已发送，交易哈希: ${tx.hash}`);
          const receipt = await tx.wait();
          console.log(
            `交易确认，区块号: ${receipt.blockNumber}, 状态: ${receipt.status}`,
          );
          if (receipt.status === 1) {
            const deleteResult = await this.MachineModel.deleteOne({
              machineId,
            }).exec();
            if (deleteResult.deletedCount === 0) {
              console.warn(`数据库中未找到 machineId 为 ${machineId} 的机器`);
              return {
                code: 1001,
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                msg: '解除质押成功,但数据库中未找到机器',
              };
            } else {
              console.log(`成功删除 machineId 为 ${machineId} 的数据库记录`);
              return {
                code: 1000,
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                msg: '解除质押成功',
              };
            }
          } else {
            return { code: 1001, msg: '解除质押失败，交易状态非1' };
          }
        } catch (error) {
          console.error(`解除质押交易失败 for ${machineId}: ${error.message}`);
          return { code: 1001, success: false, msg: error.message };
        }
      } else {
        return {
          ended: result === 0n,
          timestamp: result.toString(),
          code: 1001,
          msg: '质押还未结束，不能解除质押',
        };
      }
    } catch (error) {
      console.error(`获取质押时间失败 for ${machineId}: ${error.message}`);
      return {
        code: 1001,
        success: false,
        msg: `获取质押时间失败: ${error.message}`,
      };
    }
  }
  // 质押 NFT
  async stake(createMachineDto): Promise<any> {
    try {
      console.log(createMachineDto);

      // 发送 stake 交易
      const tx = await this.contract.stake(
        createMachineDto.address,
        createMachineDto.machineId,
        createMachineDto.nftTokenIds.map((id: string) => BigInt(id)),
        createMachineDto.nftTokenIdBalances.map((balance: string) =>
          BigInt(balance),
        ),
        createMachineDto.rentId,
      );

      console.log(`质押交易已发送，交易哈希: ${tx.hash}`);

      // 等待交易确认
      const receipt = await tx.wait();
      console.log(
        `交易已确认，区块号xx: ${receipt.blockNumber}, 状态: ${receipt.status}`,
      );

      // 检查交易状态
      if (receipt.status === 1) {
        return {
          code: 1000,
          success: true,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          msg: 'NFT质押成功',
        };
      } else {
        return {
          code: 1001,
          msg: '交易失败，可能是合约逻辑回滚',
        };
      }
    } catch (error) {
      return {
        code: 1001,
        success: false,
        msg: error.message,
      };
    }
  }
}
