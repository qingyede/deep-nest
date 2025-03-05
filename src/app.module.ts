import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MachineModule } from './machine/machine.module';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MachineModule,
    MongooseModule.forRoot('mongodb://localhost:27017/machine'),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
