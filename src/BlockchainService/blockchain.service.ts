// src/blockchain/blockchain.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as stakingContractAbi from './abi/stakingContractAbi.json'; // 加载 ABI
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Machine } from '../machine/machine.schema';
// import axios, { AxiosResponse } from 'axios';

@Injectable()
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor(
    private configService: ConfigService,
    @InjectModel(Machine.name) private MachineModel: Model<Machine>,
  ) {
    // const rpcUrl = 'https://rpc-testnet.dbcwallet.io';
    const env = this.configService.get<string>('NODE_ENV', 'test');

    const rpcUrl = this.configService.get<string>(
      env === 'production' ? 'RPC_URL_PROD' : 'RPC_URL_TEST',
    );

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // 读取私钥（建议从环境变量中获取）
    const privateKey = process.env.NODE_PRIVATEKEY;
    if (!privateKey) {
      throw new Error('Private key is missing in environment variables');
    }

    console.log(process.env.NODE_PRIVATEKEY, '我的私钥');
    // 使用私钥创建 signer
    this.signer = new ethers.Wallet(privateKey, this.provider);

    // 连接合约，使用 signer 进行交易
    // const contractAddress = '0x7FDC6ed8387f3184De77E0cF6D6f3B361F906C21';

    const contractAddress = this.configService.get<string>(
      env === 'production' ? 'CONTRACT_ADDRESS_PROD' : 'CONTRACT_ADDRESS_TEST',
    );

    console.log(`环境: ${env}`);
    console.log(`RPC URL: ${rpcUrl}`);
    console.log(`长租质押合约地址: ${contractAddress}`);

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

  // 解除质押
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
      console.log(createMachineDto, '质押传过来的参数');

      // 发送 stake 交易
      const tx = await this.contract.stake(
        createMachineDto.address,
        createMachineDto.machineId,
        createMachineDto.nftTokenIds.map((id: string) => BigInt(id)),
        createMachineDto.nftTokenIdBalances.map((balance: string) =>
          BigInt(balance),
        ),
        createMachineDto.rentId,
        createMachineDto.rewardAddress,
      );

      console.log(`质押交易已发送，交易哈希: ${tx.hash}`);

      // 等待交易确认
      const receipt = await tx.wait();

      // 检查交易状态
      if (receipt.status === 1) {
        const mashineData = await this.getMachineInfoForDBCScan(
          createMachineDto.machineId,
        );
        console.log(mashineData, '从合约获取的机器信息');
        createMachineDto.machineInfo = mashineData;

        const createdMachine = await new this.MachineModel(createMachineDto);
        await createdMachine.save(); // 确保保存完成
        console.log(createMachineDto, '存到数据库的数据,质押成功');

        return {
          code: 1000,
          success: true,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          msg: 'NFT质押成功',
        };
      } else {
        return {
          msg: '质押失败',
          code: 1001,
        };
      }
    } catch (error) {
      console.log(error);
      return {
        code: 1001,
        success: false,
        msg: error.message,
      };
    }
  }

  // 质押之前的注销

  async unregister(machineId) {
    const env = this.configService.get<string>('NODE_ENV', 'test');
    const ApiBase = this.configService.get<string>(
      env === 'production' ? 'API_BASE_PROD' : 'API_BASE_TEST',
    );
    const url = `${ApiBase}/api/v0/contract/unregister`;
    console.log(url, 'urlurlurl');
    const data = {
      project_name: 'DeepLink BandWidth',
      staking_type: 2,
      machine_id: machineId,
    };
    console.log(data, 'KKK');

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超时

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(data),
          signal: controller.signal, // 超时控制
        });

        clearTimeout(timeout); // 请求成功后清除超时

        if (response.ok) {
          return await response.json();
        } else {
          const errorText = await response.text();
          return {
            code: 1001,
            msg: `注销请求失败: ${response.status} - ${errorText}`,
          };
        }
      } catch (error) {
        console.log(`Attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          return {
            code: 1001,
            msg: `注销失败: ${error.message || '网络错误'}`,
          };
        }
        // 等待一段时间后重试（指数退避）
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  //根据钱包地址获取长租地址
  async fetchGraphQLData2(add) {
    const endpoint = 'https://dbcswap.io/subgraph/name/long-staking-state';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            stateSummaries(first: 1) {
              totalCalcPoint
            }
            stakeHolders(where: {
              holder: "${add}"
            }) {
              holder
              totalClaimedRewardAmount
              totalReleasedRewardAmount
              machineInfos(first: 1000) {
               machineId
               stakeEndTimestamp
              }
            }
          }
        `,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const res: any = await response.json();
    if (res.data.stakeHolders.length !== 0) {
      return res.data.stakeHolders[0].machineInfos;
    } else {
      return [];
    }
  }
  // 查询全部机器判断是否到期自动解除质押
  async getMachineInfoForDBCScanAndUnstake(): Promise<any> {
    try {
      //根据钱包地址获取长租地址
      const deleteResult = await this.MachineModel.find().exec();
      console.log(deleteResult);
      for (const item of deleteResult) {
        console.log(item.address, '地址1');
        const arr = await this.fetchGraphQLData2(item.address);

        const newArr = arr
          .filter(
            (item) =>
              Number(item.stakeEndTimestamp) < Math.floor(Date.now() / 1000),
          )
          .map((item) => ({ machineId: item.machineId }));
        if (newArr.length !== 0) {
          console.log(newArr, 'newArr');

          for (const machine of newArr) {
            try {
              console.log(`尝试解除质押: ${machine.machineId}`);
              const tx = await this.contract.unStake(machine.machineId);
              console.log(`发送成功: ${tx.hash}`);
              const receipt = await tx.wait();
              console.log(`已确认: ${receipt.blockNumber}`);
              if (receipt.status === 1) {
                console.log('解除质押成功');
              } else {
                throw new Error('解除质押失败');
              }
            } catch (err) {
              console.error(`失败: ${machine.machineId}`, err.message);
            }
          }
        }
      }
    } catch (error) {
      return {
        code: 1001,
        success: false,
        msg: `获取机器信息失败: ${error.message}`,
      };
    }
  }
}
