// src/blockchain/blockchain.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as stakingContractAbi from './abi/stakingContractAbi.json'; // 加载 ABI

@Injectable()
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor(private configService: ConfigService) {
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

  // 获取质押时间
  async getMachineTime(machineId: string): Promise<any> {
    try {
      const result = await this.contract.getStakeEndTimestamp(machineId);
      // 返回状态和时间戳（仍使用 BigInt 类型）
      return { ended: result === 0n, timestamp: result.toString(), code: 200 };
    } catch (error) {
      throw new Error(`Failed to fetch machine info: ${error.message}`);
    }
  }
}
