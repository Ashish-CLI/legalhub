'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { secureFetch } from '@/lib/csrf-client';
import Link from 'next/link';

interface User {
  _id: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  idDocument: string;
  idDocumentType?: string;
  professionalDocument?: string;
  professionalDocumentType?: string;
  createdAt: string;
}

export default function VerificationRequestsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Helper function to detect if a document is a PDF
  const isPdfDocument = (documentType: string | undefined, documentUrl: string) => {
    // If we have a document type from our validation, use that
    if (documentType) {
      return documentType === 'application/pdf';
    }
    
    if (documentUrl.includes('.pdf')) return true;
    if (documentUrl.includes('cloudinary') && documentUrl.includes('format=pdf')) {
      return true;
    }
    
    return false;
  };

  // Fetch pending verification requests
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/admin/verification');
        const data = await res.json();
        
        if (data.success) {
          setUsers(data.data.users);
        } else {
          setError(data.error || 'Failed to fetch users');
        }
      } catch (err) {
        setError('An error occurred while fetching users');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Handle accept/reject action
  const handleVerification = async (userId: string, action: 'accept' | 'reject') => {
    try {
      const res = await secureFetch(`/api/admin/verification/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Remove the user from the list or update their status
        setUsers(users.filter(user => user.userId !== userId));
        alert(`User ${action}ed successfully`);
      } else {
        alert(data.error || `Failed to ${action} user`);
      }
    } catch (err) {
      console.error(err);
      alert(`An error occurred while ${action}ing the user`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-gray-600">Loading verification requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">Error: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Admin Dashboard
        </Link>
        <Link href="/admin/case-requests" className="ml-4 inline-flex items-center text-amber-700 hover:text-amber-900 mb-4 font-semibold">
          Review Case Requests
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">User Verification Requests</h1>
        <p className="text-gray-600">Review and verify new user registrations</p>
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending verification requests</h3>
          <p className="text-gray-500">All caught up! There are no new user registrations awaiting verification.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <div key={user._id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{user.fullName}</h3>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <p className="text-sm text-gray-500">ID: {user.userId}</p>
                    <p className="text-sm text-gray-500 capitalize">Role: {user.role}</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900">Documents</h4>
                  <div className="mt-2 space-y-4">
                    <div>
                      <p className="text-xs text-gray-500">ID Document</p>
                      {isPdfDocument(user.idDocumentType, user.idDocument) ? (
                        <iframe
                          src={`${user.idDocument}#view=FitH`}
                          className="w-full h-48 mt-1 border rounded"
                          title="ID Document Preview"
                        />
                      ) : (
                        <img
                          src={user.idDocument}
                          alt="ID Document"
                          className="w-full h-48 object-contain mt-1 border rounded"
                        />
                      )}
                      <a
                        href={user.idDocument}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm underline block mt-1"
                      >
                        Open ID Document in New Tab
                      </a>
                    </div>
                    {user.professionalDocument && (
                      <div>
                        <p className="text-xs text-gray-500">Professional Document</p>
                        {isPdfDocument(user.professionalDocumentType, user.professionalDocument) ? (
                          <iframe
                            src={`${user.professionalDocument}#view=FitH`}
                            className="w-full h-48 mt-1 border rounded"
                            title="Professional Document Preview"
                          />
                        ) : (
                          <img
                            src={user.professionalDocument}
                            alt="Professional Document"
                            className="w-full h-48 object-contain mt-1 border rounded"
                          />
                        )}
                        <a
                          href={user.professionalDocument}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm underline block mt-1"
                        >
                          Open Professional Document in New Tab
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={() => handleVerification(user.userId, 'accept')}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleVerification(user.userId, 'reject')}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
