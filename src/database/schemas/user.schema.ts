import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type UserDocument = mongoose.HydratedDocument<User>;

@Schema()
export class User {
  @Prop()
  name: string;

  @Prop({ unique: true })
  wallet: string;

  @Prop()
  twitter: string;

  @Prop()
  telegram: string;

  @Prop()
  website: string;

  @Prop()
  profit: string;

  @Prop()
  loss: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
