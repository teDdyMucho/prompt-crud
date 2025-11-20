import React, { useState, useEffect } from 'react';

// Determine API base URL
// Priority: REACT_APP_API_BASE_URL -> (production) '/.netlify/functions/prompts' -> (dev) localhost
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (process.env.NODE_ENV === 'production' ? '/.netlify/functions/prompts' : 'http://localhost:5000/api');

if (!process.env.REACT_APP_API_BASE_URL) {
  // Helpful hint in console when running without the env var set
  // In production on Netlify, we fall back to '/api' which proxies to Netlify Functions
  // In development, we fall back to http://localhost:5000/api
  console.warn('REACT_APP_API_BASE_URL is not set. Using default:', API_BASE_URL);
}

function App() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    prompt: '',
    location_id: '',
    business_name: '',
    knowledgebase: '',
    inventory: ''
  });


  // Fetch prompts from API
  const fetchPrompts = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await fetch(`${API_BASE_URL}/prompts`, {
        headers: { Accept: 'application/json' },
      });
      const text = await response.text();
      let data = [];
      try {
        data = text ? JSON.parse(text) : [];
      } catch (e) {
        console.error('Invalid JSON from API:', text);
        throw new Error('Invalid JSON from API');
      }
      if (!response.ok) {
        const msg = typeof data === 'object' && data && data.error ? data.error : text;
        throw new Error(`HTTP ${response.status}: ${msg}`);
      }
      setPrompts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      setPrompts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const filteredPrompts = (Array.isArray(prompts) ? prompts : []).filter(p => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const fields = [
      p.name,
      p.location_id,
      p.business_name,
      p.knowledgebase,
      typeof p.inventory === 'string' ? p.inventory : JSON.stringify(p.inventory || {}),
      p.prompt,
    ];
    return fields.some(f => (f || '').toString().toLowerCase().includes(q));
  });

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add new prompt
  const handleAddPrompt = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        setShowAddModal(false);
        setFormData({ name: '', prompt: '', location_id: '', business_name: '', knowledgebase: '', inventory: '' });
        fetchPrompts();
      }
    } catch (error) {
      console.error('Error adding prompt:', error);
    }
  };

  // Edit prompt
  const handleEditPrompt = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/prompts/${selectedPrompt.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        setShowEditModal(false);
        setSelectedPrompt(null);
        setFormData({ name: '', prompt: '', location_id: '', business_name: '', knowledgebase: '', inventory: '' });
        fetchPrompts();
      }
    } catch (error) {
      console.error('Error updating prompt:', error);
    }
  };

  // Delete prompt
  const handleDeletePrompt = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/prompts/${selectedPrompt.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        setSelectedPrompt(null);
        fetchPrompts();
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
    }
  };

  // Open edit modal
  const openEditModal = (prompt) => {
    setSelectedPrompt(prompt);
    setFormData({
      name: prompt.name,
      prompt: prompt.prompt,
      location_id: prompt.location_id,
      business_name: prompt.business_name,
      knowledgebase: prompt.knowledgebase,
      inventory: prompt.inventory
    });
    setShowEditModal(true);
  };

  // Open delete modal
  const openDeleteModal = (prompt) => {
    setSelectedPrompt(prompt);
    setShowDeleteModal(true);
  };

  // Open view modal
  const openViewModal = (prompt) => {
    setSelectedPrompt(prompt);
    setShowViewModal(true);
  };

  // Truncate text for table display
  const truncateText = (text, maxLines = 2) => {
    const words = text.split(' ');
    const wordsPerLine = 8;
    const maxWords = maxLines * wordsPerLine;
    
    if (words.length > maxWords) {
      return words.slice(0, maxWords).join(' ') + '...';
    }
    return text;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Modern Header with Gradient */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 px-4 sm:px-8 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Prompt Management</h1>
                <p className="text-indigo-100 text-sm">Manage and organize your AI prompts efficiently</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search prompts..."
                    className="w-full pl-10 pr-3 py-3 bg-white/15 text-white placeholder:text-indigo-100/80 rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent"
                  />
                  <svg className="w-5 h-5 text-white/80 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                  </svg>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="group relative px-5 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-white/30"
                >
                  <span className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium">Add New Prompt</span>
                  </span>
                </button>
                <button
                  onClick={() => fetchPrompts(true)}
                  disabled={refreshing}
                  className="group relative px-5 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl hover:bg-white/20 transition-all duration-300 transform hover:scale-105 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center space-x-2">
                    <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="font-medium">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Table */}
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <div className="text-gray-600 font-medium">Loading prompts...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[720px] overflow-hidden rounded-xl border border-gray-200/50">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 sm:px-8 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span>Name</span>
                        </div>
                      </th>
                      
                      <th className="px-6 sm:px-8 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <span>Location ID</span>
                        </div>
                      </th>
                      <th className="px-6 sm:px-8 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <span>Business Name</span>
                        </div>
                      </th>
                      <th className="px-6 sm:px-8 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                        <div className="flex items-center space-x-2">
                          <span>Knowledgebase</span>
                        </div>
                      </th>
                      <th className="px-6 sm:px-8 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                        <div className="flex items-center space-x-2">
                          <span>Inventory</span>
                        </div>
                      </th>
                      <th className="px-6 sm:px-8 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wider hidden xs:table-cell sm:table-cell">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                          <span>Actions</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredPrompts.map((prompt, index) => (
                      <tr key={prompt.id} className="group odd:bg-white even:bg-gray-50 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200">
                        <td className="px-6 sm:px-8 py-4 sm:py-6 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">{prompt.name.charAt(0)}</span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm sm:text-base font-semibold text-gray-900">{prompt.name}</div>
                              <div className="text-[10px] sm:text-xs text-gray-500">ID: {prompt.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 sm:px-8 py-4 sm:py-6 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{prompt.location_id}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-4 sm:py-6 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{prompt.business_name}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-4 sm:py-6 text-sm text-gray-900 max-w-md hidden sm:table-cell">
                          <div className="line-clamp-2 leading-relaxed">
                            {prompt.knowledgebase}
                          </div>
                        </td>
                        <td className="px-6 sm:px-8 py-4 sm:py-6 text-sm text-gray-900 max-w-md hidden sm:table-cell">
                          <div className="line-clamp-2 leading-relaxed">
                            {JSON.stringify(prompt.inventory)}
                          </div>
                        </td>
                        <td className="px-6 sm:px-8 py-4 sm:py-6 whitespace-nowrap text-sm space-x-3 hidden xs:table-cell sm:table-cell">
                          <button
                            onClick={() => openEditModal(prompt)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all duration-200 transform hover:scale-105 font-medium"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => openDeleteModal(prompt)}
                            className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-all duration-200 transform hover:scale-105 font-medium"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Add Prompt Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto transform animate-slideUp">
            <div className="flex items-center mb-6">
              <div className="h-12 w-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Add New Prompt</h2>
                <p className="text-gray-600 text-sm">Create a new prompt template for your workflow</p>
              </div>
            </div>
            
            <form onSubmit={handleAddPrompt} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Prompt Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter prompt name..."
                    required
                  />
                </div>
                
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Location ID
                  </label>
                  <input
                    type="text"
                    name="location_id"
                    value={formData.location_id}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter location ID..."
                  />
                  
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Business Name
                  </label>
                  <input
                    type="text"
                    name="business_name"
                    value={formData.business_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter business name..."
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Prompt Content
                </label>
                <textarea
                  name="prompt"
                  value={formData.prompt}
                  onChange={handleInputChange}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white resize-none"
                  placeholder="Enter your prompt content here..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Knowledgebase
                </label>
                <textarea
                  name="knowledgebase"
                  value={formData.knowledgebase}
                  onChange={handleInputChange}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white resize-none"
                  placeholder="Enter your knowledgebase here..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Inventory
                </label>
                <textarea
                  name="inventory"
                  value={formData.inventory}
                  onChange={handleInputChange}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white resize-none"
                  placeholder="Enter your inventory here..."
                  required
                />
              </div>
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ name: '', prompt: '', location_id: '', business_name: '', knowledgebase: '', inventory: '' });
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg"
                >
                  Create Prompt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Edit Prompt Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-3xl mx-4 transform animate-slideUp max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center mb-6">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Edit Prompt</h2>
                <p className="text-gray-600 text-sm">Update your prompt template</p>
              </div>
            </div>
            
            <form onSubmit={handleEditPrompt} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Prompt Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter prompt name..."
                    required
                  />
                </div>
                
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Location ID
                  </label>
                  <input
                    type="text"
                    name="location_id"
                    value={formData.location_id}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter location ID..."
                  />
                  
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Business Name
                  </label>
                  <input
                    type="text"
                    name="business_name"
                    value={formData.business_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter business name..."
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Prompt Content
                </label>
                <textarea
                  name="prompt"
                  value={formData.prompt}
                  onChange={handleInputChange}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white resize-none"
                  placeholder="Enter your prompt content here..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Knowledgebase
                </label>
                <textarea
                  name="knowledgebase"
                  value={formData.knowledgebase}
                  onChange={handleInputChange}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white resize-none"
                  placeholder="Enter your knowledgebase here..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Inventory
                </label>
                <textarea
                  name="inventory"
                  value={formData.inventory}
                  onChange={handleInputChange}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white resize-none"
                  placeholder="Enter your inventory here..."
                  required
                />
              </div>
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPrompt(null);
                    setFormData({ name: '', prompt: '', location_id: '', business_name: '', knowledgebase: '', inventory: '' });
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg"
                >
                  Update Prompt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-md mx-4 transform animate-slideUp">
            <div className="flex items-center mb-6">
              <div className="h-12 w-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Delete Prompt</h2>
                <p className="text-gray-600 text-sm">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-800 font-medium">
                Are you sure you want to delete "{selectedPrompt?.name}"?
              </p>
              <p className="text-red-600 text-sm mt-1">
                This will permanently remove the prompt from your system.
              </p>
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedPrompt(null);
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePrompt}
                className="px-8 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced View Full Prompt Modal */}
      {showViewModal && selectedPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-4xl mx-4 max-h-[85vh] overflow-y-auto transform animate-slideUp">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Prompt Details</h2>
                  <p className="text-gray-600 text-sm">Full prompt information and content</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedPrompt(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <h3 className="font-semibold text-blue-900">Prompt Name</h3>
                </div>
                <p className="text-blue-800 font-medium text-lg">{selectedPrompt.name}</p>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <h3 className="font-semibold text-green-900">Location ID</h3>
                </div>
                <p className="text-green-800 font-medium text-lg">{selectedPrompt.location_id}</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-100">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="font-semibold text-yellow-900">Business Name</h3>
                </div>
                <p className="text-yellow-800 font-medium text-lg">{selectedPrompt.business_name}</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
              <div className="flex items-center mb-4">
                <svg className="w-5 h-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="font-semibold text-gray-900">Prompt Content</h3>
              </div>
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">
                  {selectedPrompt.prompt}
                </pre>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <div className="flex items-center mb-4">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="font-semibold text-blue-900">Knowledgebase</h3>
              </div>
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">
                  {selectedPrompt.knowledgebase}
                </pre>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
              <div className="flex items-center mb-4">
                <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="font-semibold text-purple-900">Inventory</h3>
              </div>
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">
                  {JSON.stringify(selectedPrompt.inventory)}
                </pre>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                ID: {selectedPrompt.id}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    openEditModal(selectedPrompt);
                  }}
                  className="px-6 py-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-all duration-200 transform hover:scale-105 font-medium"
                >
                  Edit Prompt
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedPrompt(null);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
