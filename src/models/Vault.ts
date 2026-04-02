import mongoose,{Document,Model,Schema, Types} from "mongoose";

export interface IVault extends Document {
    vaultId: string;
    caseId: Types.ObjectId;
    documents: string[];
    createdDate: Date;
    updatedDate: Date;
}
