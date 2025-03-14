import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { MachineService } from './machine.service';

@Controller('machine')
export class MachineController {
  constructor(private readonly machineService: MachineService) {}

  @Post()
  create(@Body() createMachineDto) {
    return this.machineService.create(createMachineDto);
  }

  @Get()
  findAll(@Query('address') address: string) {
    return this.machineService.findAll(address);
  }

  @Delete('unStake')
  remove(@Query('id') id: string) {
    console.log(id, 'KKKKKKKKKKK');
    return this.machineService.remove(id);
  }
  // 删除所有数据
  @Delete()
  removeAll() {
    return this.machineService.removeAll();
  }

  @Get('userMashine/:mashineId')
  async getBalance(@Param('mashineId') address: string) {
    return this.machineService.getMachineBalance(address);
  }

  // 领取奖励
  @Get('getReward')
  async reward(@Query('mashineId') machineId: string) {
    console.log(machineId);
    return this.machineService.reward(machineId);
  }

  // 获取质押时间并根据时间自动解除质押
  // @Get('getMachineTime')
  // async getMachineTime(@Query('mashineId') machineId: string) {
  //   console.log(machineId);
  //   return this.machineService.getPledgeTime(machineId);
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.machineService.findOne(id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateMachineDto) {
  //   return this.machineService.update(id, updateMachineDto);
  // }
}
