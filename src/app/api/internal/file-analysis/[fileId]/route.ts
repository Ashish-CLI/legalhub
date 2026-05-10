import { NextRequest, NextResponse } from 'next/server';
import FileAnalysis from '@/models/FileAnalysis';
import dbConnect from '@/lib/mongodb';
import { fileAnalysisQueue } from '@/lib/fileAnalysis';

/**
 * GET /api/internal/file-analysis/[fileId]
 * 
 * Get the analysis status of a file.
 * Clients poll this endpoint to check if their file has been analyzed and uploaded.
 * 
 * Response:
 * - status: 'pending' | 'safe' | 'unsafe' | 'error'
 * - cloudinaryUrl: (if safe and uploaded)
 * - verdict: (analysis details if completed)
 * - errorMessage: (if error or unsafe)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // First check in-memory queue
    const queueJobs = fileAnalysisQueue.getAll();
    const queueJob = queueJobs.find((j) => j.fileId === fileId);

    if (queueJob) {
      // Return status from in-memory queue (for ongoing analysis)
      return NextResponse.json(
        {
          fileId,
          status: queueJob.status,
          verdict: queueJob.verdict || null,
          cloudinaryUrl: queueJob.cloudinaryUrl || null,
          errorMessage: queueJob.errorMessage || null,
          createdAt: queueJob.createdAt,
          updatedAt: queueJob.updatedAt,
          source: 'queue', // Indicate this is from in-memory queue
        },
        { status: 200 }
      );
    }

    // Check MongoDB for completed/archived records
    await dbConnect();
    const record = await FileAnalysis.findOne({ fileId }).lean();

    if (!record) {
      return NextResponse.json(
        { error: 'File analysis record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        fileId,
        status: record.status,
        verdict: record.verdict || null,
        cloudinaryUrl: record.cloudinaryUrl || null,
        errorMessage: record.errorMessage || null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        source: 'database', // Indicate this is from database
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[FileAnalysisStatus] Error fetching analysis status:`, error);
    return NextResponse.json(
      {
        error: 'Failed to fetch analysis status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
