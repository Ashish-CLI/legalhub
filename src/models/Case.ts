import mongoose,{Document,Model,Schema, Types} from "mongoose";

export interface ICase extends Document {
    caseId: string ;
    title: string ;
    description: string ;
    clientId: string ;
    lawyerId: string ;
    caseFile: string ;
    judgeId?: string ;
    vaultId?: Types.ObjectId ;
    status: 'pending' | 'active' | 'closed' | 'rejected' | 'analyzing';
    analysisFileId?: string;
    openDate: Date ;
    closeDate?: Date ;
    updatedDate: Date ;
    acceptedByAdminId?: string ;
    decision?: {
        summary: string;
        decidedAt: Date;
        judgeId: string;
    };
}

const CaseSchema: Schema<ICase> = new Schema({
    caseId: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true ,
    },
    description: {
        type: String,
        required: true
    },
    clientId: {
        type: String,
        ref: 'User',
        required: true,
        index: true
    },
    lawyerId: {
        type: String,
        ref: 'User',
        required: true,
        index: true
    },
    caseFile: {
        type: String,
        required: true
    },
    judgeId: {
        type: String,
        ref: 'User',
        index: true 
    },
    vaultId: {
        type: Schema.Types.ObjectId,
        ref: 'Vault',
    },
    status: {
        type : String,
        enum : ['pending', 'active' , 'closed', 'rejected', 'analyzing'],
        default : 'pending'
    },
    analysisFileId: {
        type: String,
        ref: 'FileAnalysis',
        index: true,
        required: false
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
        type: String,
        ref: 'User',
        required: false
    },
    decision: {
        summary: {
            type: String,
            required: false,
        },
        decidedAt: {
            type: Date,
            required: false,
        },
        judgeId: {
            type: String,
            ref: 'User',
            required: false,
        },
    }
},{timestamps: true} )

const existingCaseModel = mongoose.models.Case as Model<ICase> | undefined;

if (existingCaseModel && !existingCaseModel.schema.path("decision.summary")) {
    existingCaseModel.schema.add({
        decision: {
            summary: {
                type: String,
                required: false,
            },
            decidedAt: {
                type: Date,
                required: false,
            },
            judgeId: {
                type: String,
                ref: "User",
                required: false,
            },
        },
    });
}

const Case: Model<ICase> = existingCaseModel || mongoose.model<ICase>('Case', CaseSchema);

export default Case ;
