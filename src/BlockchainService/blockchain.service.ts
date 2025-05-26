// src/blockchain/blockchain.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as stakingContractAbi from './abi/stakingContractAbi.json'; // 加载 ABI
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Machine } from '../machine/machine.schema';
// import axios, { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import { WalletReward } from '../machine/wallet-reward.schema';

@Injectable()
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor(
    private configService: ConfigService,
    @InjectModel(Machine.name) private MachineModel: Model<Machine>,
    @InjectModel(WalletReward.name)
    private WalletRewardModel: Model<WalletReward>,
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

  //  获取全部机器信息

  async getAllMachineInfos() {
    const endpoint = 'https://dbcswap.io/subgraph/name/long-staking-state';

    // 构建 where 字段的字符串，根据 gpuType 判断是否需要添加该字段
    const whereClause = `
      where: {
        isStaking: true
      }
    `;

    const query = `
      query {
        machineInfos(
          first: 1000,
          orderBy: totalCalcPoint,
          orderDirection: desc,
          ${whereClause}
        ) {
         machineId
stakeEndTimestamp
        }
      }
    `;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const res: any = await response.json();
    console.log(JSON.stringify(res.data.machineInfos), 'resres');
    if (res.data.machineInfos.length !== 0) {
      return res.data.machineInfos;
    } else {
      return [];
    }
  }

  async getAllMachineInfos2() {
    const endpoint = 'https://dbcswap.io/subgraph/name/long-staking-state';

    // 构建 where 字段的字符串，根据 gpuType 判断是否需要添加该字段
    const whereClause = `
      where: {
        isStaking: true
      }
    `;

    const query = `
      query {
        machineInfos(
          first: 1000,
          orderBy: totalCalcPoint,
          orderDirection: desc,
          ${whereClause}
        ) {
         machineId
stakeEndTimestamp
holder
        }
      }
    `;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const res: any = await response.json();
    if (res.data.machineInfos.length !== 0) {
      return res.data.machineInfos;
    } else {
      return [];
    }
  }

  // 查询全部机器判断是否到期自动解除质押
  async getMachineInfoForDBCScanAndUnstake(): Promise<any> {
    try {
      const arr = await this.getAllMachineInfos();
      console.log(arr.length);
      const newArr = arr
        .filter(
          (item) =>
            Number(item.stakeEndTimestamp) < Math.floor(Date.now() / 1000),
        )
        .map((item) => ({ machineId: item.machineId }));
      console.log(newArr, '过滤后的机器列表');
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
    } catch (error) {
      return {
        code: 1001,
        success: false,
        msg: `获取机器信息失败: ${error.message}`,
      };
    }
  }

  // 续租
  async renew(data: any) {
    console.log(data);

    try {
      // 发送 续租 交易
      const tx = await this.contract.addStakeHours(
        data.holder,
        data.machineIds,
        data.additionHoursList,
      );
      console.log(`续租交易已发送，交易哈希: ${tx.hash}`);

      // 等待交易确认
      const receipt = await tx.wait();
      // 检查交易状态
      if (receipt.status === 1) {
        return {
          code: 1000,
          success: true,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          msg: '续租成功',
        };
      } else {
        return {
          msg: '续租失败',
          code: 1001,
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

  // 生成奖励数

  async syncLockedRewardToDatabase() {
    const machines = await this.getAllMachineInfos2(); // 获取 machineId + holder

    const walletRewardMap: Map<string, number> = new Map();

    for (const machine of machines) {
      try {
        const machineId = machine.machineId;
        const wallet = machine.holder.toLowerCase(); // 钱包地址

        // 查询合约：machineId2LockedRewardDetail
        const detail =
          await this.contract.machineId2LockedRewardDetail(machineId);

        // 使用 formatUnits 转为正常的数值（18 位精度）
        const totalAmount = Number(ethers.formatUnits(detail.totalAmount, 18));
        const claimedAmount = Number(
          ethers.formatUnits(detail.claimedAmount, 18),
        );
        const lockedReward = totalAmount - claimedAmount;

        // 累加到对应钱包
        const currentTotal = walletRewardMap.get(wallet) || 0;
        walletRewardMap.set(wallet, currentTotal + lockedReward);

        // 打印每台机器的奖励数据
        console.log(`machineId: ${machineId}, wallet: ${wallet}`);
        console.log(`  totalAmount: ${totalAmount}`);
        console.log(`  claimedAmount: ${claimedAmount}`);
        console.log(`  lockedReward: ${lockedReward}`);
      } catch (err) {
        console.error(`处理失败 machineId: ${machine.machineId}`, err.message);
      }
    }

    // 写入数据库
    for (const [wallet, lockedReward] of walletRewardMap.entries()) {
      console.log(`钱包: ${wallet}, 累计锁定奖励: ${lockedReward}`);

      await this.WalletRewardModel.updateOne(
        { walletAddress: wallet },
        {
          $set: {
            walletAddress: wallet,
            lockedReward: lockedReward.toString(), // 存字符串防止浮点精度问题
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    console.log('锁定奖励同步任务完成');
  }
  // 获取奖励数据

  async getAllWalletRewards() {
    const result = await this.WalletRewardModel.find()
      .sort({ updatedAt: -1 })
      .lean();

    if (result.length === 0) {
      return {
        code: 10001,
        data: [],
      };
    }

    return {
      code: 200,
      data: result,
    };
  }
}
