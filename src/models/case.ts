import mongoose,{Document,Schema,Model} from "mongoose";

export interface ICase extends Document{
    caseId: string;
    clientId: string;
    lawyerId: string;
    judgeId?: string;
    vaultId: string;
    caseFile: string;
    caseStatus: 'pending' | 'active' | 'closed';
    createdAt: Date;
    updatedAt: Date;
}

const CaseSchema: Schema<ICase> = new Schema ({
    
    caseId:{
        type: String,
        unique: true
    },

    clientId:{
        type: String,
        required: true
    },

    lawyerId: {
        type: String,
        required: true,
    },

    judgeId: {
        type: String
    },

    vaultId: {
        type: String,
        required: true,
        minlength: 1
    },

    caseFile: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
    },

    caseStatus: {
        type: String,
        enum: ['pending', 'active', 'closed'],
        default: 'pending'
    }

},{timestamps: true});

CaseSchema.index({ clientId: 1 });
CaseSchema.index({ lawyerId: 1 });
CaseSchema.index({ judgeId: 1 }, { sparse: true });

const Case: Model<ICase> = mongoose.model<ICase>('Case', CaseSchema);

export default Case;