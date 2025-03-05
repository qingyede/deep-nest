import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
  findAll(@Param('address') address: string) {
    return this.machineService.findAll(address);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.machineService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMachineDto) {
    return this.machineService.update(id, updateMachineDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.machineService.remove(id);
  }
  // 删除所有数据
  @Delete()
  removeAll() {
    return this.machineService.removeAll();
  }

  @Get('userMashine/:mashineId')
  async getBalance(@Param('mashineId') address: string) {
    console.log(address, '/////');
    return this.machineService.getMachineBalance(address);
  }
}
