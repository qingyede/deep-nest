// src/wallet-reward/wallet-reward.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class WalletReward extends Document {
  @Prop({ required: true, unique: true })
  walletAddress: string;

  @Prop({ required: true })
  lockedReward: string;

  @Prop()
  updatedAt: Date;
}

export const WalletRewardSchema = SchemaFactory.createForClass(WalletReward);
