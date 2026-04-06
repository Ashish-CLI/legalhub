import mongoose,{Document,Model,Schema, Types} from "mongoose";

export interface IVault extends Document {
    vaultId: string;
    caseId: Types.ObjectId;
    evidence?: {
        url: string;
        type: "image" | "pdf" | "video" | "audio" | "file"
    };
    judgeId?: Types.ObjectId;
    createdDate: Date;
    updatedDate: Date;

}
