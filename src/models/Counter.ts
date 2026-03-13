import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICounter extends Document<string> {
    seq: number; 
}

const CounterSchema: Schema<ICounter> = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter: Model<ICounter> = mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);

export default Counter;