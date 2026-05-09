'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Lawyer {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  professionalDocument?: string;
  profileImage?: string;
}

export default function LawyerSearch() {
  const [searchName, setSearchName] = useState('');
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHasSearched(true);
    
    try {
      const response = await fetch(`/api/lawyers/search?name=${encodeURIComponent(searchName)}`);
      const data = await response.json();
      setLawyers(data.lawyers || []);
    } catch (error) {
      console.error('Error searching lawyers:', error);
      setLawyers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChatClick = (lawyer: Lawyer) => {
    const query = new URLSearchParams({
      userId: lawyer.userId,
      userName: lawyer.fullName
    }).toString();
    router.push(`/chat?${query}`);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow md:p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Find Lawyers</h2>
      
      <form onSubmit={handleSearch} className="mb-6">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Lawyer Name
            </label>
            <input
              type="text"
              id="name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter lawyer name"
            />
          </div>
        </div>
        
        <div className="mt-4">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching...
              </>
            ) : (
              'Search Lawyers'
            )}
          </button>
        </div>
      </form>
      
      {hasSearched && (
        <div>
          <h3 className="text-md font-medium text-gray-900 mb-2">
            {lawyers.length} {lawyers.length === 1 ? 'Lawyer' : 'Lawyers'} Found
          </h3>
          
          {lawyers.length > 0 ? (
            <div className="flow-root">
              <ul className="divide-y divide-gray-200">
                {lawyers.map((lawyer) => (
                  <li key={lawyer.userId} className="py-4">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {lawyer.profileImage ? (
                          <img
                            src={lawyer.profileImage}
                            alt={lawyer.fullName}
                            className="w-16 h-16 rounded-xl object-cover border-2 border-gray-200"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.style.display = 'none';
                              target.parentElement!.innerHTML = '<div class="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg></div>';
                            }}
                          />
                        ) : (
                          <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between">
                          <h4 className="text-base font-medium text-gray-900 truncate">
                            {lawyer.fullName}
                          </h4>
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {lawyer.address}
                        </p>
                        <div className="mt-2 flex flex-col space-y-1">
                          <p className="text-sm text-gray-600 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {lawyer.email}
                          </p>
                          <p className="text-sm text-gray-600 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {lawyer.phoneNumber}
                          </p>
                        </div>
                      </div>
                      <div className="self-center">
                        <button 
                          onClick={() => handleChatClick(lawyer)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Chat
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No lawyers found</h3>
              <p className="mt-2 text-sm text-gray-500">
                Try adjusting your search terms to find what you&apos;re looking for.
              </p>
            </div>
          )}
        </div>
      )}
      
      {!hasSearched && (
        <div className="text-center py-12">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Find Legal Professionals</h3>
          <p className="mt-2 text-sm text-gray-500">
            Search for lawyers by name to find experienced legal professionals.
          </p>
        </div>
      )}
    </div>
  );
}
