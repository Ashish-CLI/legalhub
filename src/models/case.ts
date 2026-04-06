import mongoose,{Document,Model,Schema, Types} from "mongoose";

export interface ICase extends Document {
    caseId: string ;
    clientId: Types.ObjectId ;
    lawyerId: Types.ObjectId ;
    caseFile: string ;
    judgeId?: Types.ObjectId ;
    vaultId?: Types.ObjectId ;
    status: 'pending' | 'active' | 'closed';
    openDate: Date ;
    closeDate?: Date ;
    updatedDate: Date ;
    acceptedByAdminId: Types.ObjectId ;
}

const CaseSchema: Schema<ICase> = new Schema({
    caseId: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    clientId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    lawyerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    caseFile: {
        type: String,
        required: true
    },
    judgeId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true 
    },
    vaultId: {
        type: Schema.Types.ObjectId,
        ref: 'Vault',
    },
    status: {
        type : String,
        enum : ['pending', 'active' , 'closed'],
        default : 'pending'
    },
    openDate: {
        type: Date,
        default: Date.now
    },
    closeDate: {
        type: Date,
    },
    updatedDate: {
        type: Date,
        default: Date.now
    },
    acceptedByAdminId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
},{timestamps: true} )


const Case: Model<ICase> = mongoose.model<ICase>('Case', CaseSchema);

export default Case ;