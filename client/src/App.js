import React, { useState, useEffect, useRef } from 'react';

// Determine API base URL
// Priority: REACT_APP_API_BASE_URL -> (production) '/.netlify/functions/prompts' -> (dev) localhost
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (process.env.NODE_ENV === 'production' ? '/.netlify/functions/prompts' : 'http://localhost:5001/api');

if (!process.env.REACT_APP_API_BASE_URL) {
  // Helpful hint in console when running without the env var set
  // In production on Netlify, we fall back to '/api' which proxies to Netlify Functions
  // In development, we fall back to http://localhost:5001/api
  console.warn('REACT_APP_API_BASE_URL is not set. Using default:', API_BASE_URL);
}

// Simple debug helpers
const log = (...args) => console.log('[APP]', ...args);
const logError = (label, err, extra = {}) => {
  console.error(`[APP][Error] ${label}:`, err, extra);
};

function App() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showKnowledgebaseModal, setShowKnowledgebaseModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showEditKnowledgebaseModal, setShowEditKnowledgebaseModal] = useState(false);
  const [showEditInventoryModal, setShowEditInventoryModal] = useState(false);
  const [showEditPromptModal, setShowEditPromptModal] = useState(false);
  const [kbTab, setKbTab] = useState('All');
  const [crawlerMode, setCrawlerMode] = useState('Exact URL');
  const [crawlerUrl, setCrawlerUrl] = useState('');
  const [rtName, setRtName] = useState('');
  const [rtBlock, setRtBlock] = useState('Paragraph');
  const [rtFamily, setRtFamily] = useState('Inter');
  const [rtSize, setRtSize] = useState('14px');
  const [rtLine, setRtLine] = useState('1.5');
  const [rtBold, setRtBold] = useState(false);
  const [rtItalic, setRtItalic] = useState(false);
  const [rtUnderline, setRtUnderline] = useState(false);
  const [rtContent, setRtContent] = useState('');
  const rtRef = useRef(null);
  const [rtSaved, setRtSaved] = useState([]);
  // Upload states for Tables and File Upload tabs
  const [tableDragging, setTableDragging] = useState(false);
  const [tableFiles, setTableFiles] = useState([]);
  const tableInputRef = useRef(null);
  const [fileDragging, setFileDragging] = useState(false);
  const [fileUploadFiles, setFileUploadFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [tableName, setTableName] = useState(''); 
  const [uploadingTable, setUploadingTable] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [savingRichText, setSavingRichText] = useState(false);
  const [editingRichTextId, setEditingRichTextId] = useState(null);
  
  // FAQ states
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqSources, setFaqSources] = useState([]);
  const [savingFaq, setSavingFaq] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState(null);

  const updateInlineStates = () => {
    try {
      setRtBold(document.queryCommandState('bold'));
      setRtItalic(document.queryCommandState('italic'));
      setRtUnderline(document.queryCommandState('underline'));
    } catch {}
  };

  // Fetch uploaded files
  const fetchUploadedFiles = async (promptId = null) => {
    try {
      log('Files:fetch:start', { promptId });
      const url = promptId 
        ? `${API_BASE_URL}/kb-file-sources?prompt_id=${promptId}`
        : `${API_BASE_URL}/kb-file-sources`;
      
      const response = await fetch(url);
      if (response.ok) {
        const files = await response.json();
        setUploadedFiles(files);
        log('Files:fetch:success', { count: files.length, files });
      } else {
        throw new Error(`Failed to fetch files: ${response.status}`);
      }
    } catch (error) {
      logError('Files:fetch', error);
      setUploadedFiles([]);
    }
  };

  // Global error hooks (runtime JS errors & unhandled promise rejections)
  useEffect(() => {
    const onErr = (e) => logError('window.error', e.error || e.message, { filename: e.filename, lineno: e.lineno, colno: e.colno });
    const onRej = (e) => logError('unhandledrejection', e.reason);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  // Drag and drop helpers
  const handleDrop = (ev, type) => {
    ev.preventDefault();
    const items = Array.from(ev.dataTransfer.files || []);
    if (type === 'table') {
      const csvs = items.filter(f => f.name.toLowerCase().endsWith('.csv'));
      setTableFiles(csvs);
      setTableDragging(false);
      log('Table drop received', csvs.map(f=>({ name: f.name, size: f.size })));
    } else if (type === 'files') {
      const allowed = ['pdf','doc','docx'];
      const picked = items.filter(f => allowed.includes(f.name.split('.').pop()?.toLowerCase()))
        .slice(0, 10);
      setFileUploadFiles(picked);
      setFileDragging(false);
      log('Files drop received', picked.map(f=>({ name: f.name, size: f.size })));
    }
  };

  const exec = (cmd, arg = null) => {
    try {
      document.execCommand(cmd, false, arg);
      updateInlineStates();
      rtRef.current && rtRef.current.focus();
    } catch {}
  };
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
      log('fetchPrompts:start', { isRefresh });
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
      const arr = Array.isArray(data) ? data : [];
      setPrompts(arr);
      log('fetchPrompts:success', { count: arr.length });
    } catch (error) {
      logError('fetchPrompts', error);
      setPrompts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  // Delete uploaded file
  const deleteUploadedFile = async (fileId, fileName) => {
    try {
      log('Files:delete:start', { fileId, fileName });
      
      const response = await fetch(`${API_BASE_URL}/kb-file-sources/${fileId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        log('Files:delete:success', { fileId, fileName });
        // Refresh the files list
        if (selectedPrompt) {
          fetchUploadedFiles(selectedPrompt.id);
        }
      } else {
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      logError('Files:delete', error);
    }
  };

  // Fetch rich text sources
  const fetchRichTextSources = async (promptId = null) => {
    try {
      log('RichText:fetch:start', { promptId });
      const url = promptId 
        ? `${API_BASE_URL}/kb-rich-text-sources?prompt_id=${promptId}`
        : `${API_BASE_URL}/kb-rich-text-sources`;
      
      const response = await fetch(url);
      if (response.ok) {
        const sources = await response.json();
        // Update the rtSaved state for backward compatibility
        setRtSaved(sources.map(source => ({
          id: source.id,
          name: source.name,
          content: source.content
        })));
        log('RichText:fetch:success', { count: sources.length, sources });
      } else {
        throw new Error(`Failed to fetch rich text sources: ${response.status}`);
      }
    } catch (error) {
      logError('RichText:fetch', error);
      setRtSaved([]);
    }
  };

  // Save rich text source (CREATE or UPDATE)
  const saveRichTextSource = async () => {
    if (!rtName.trim() || !rtContent.trim()) {
      log('RichText:save:validation', { nameEmpty: !rtName.trim(), contentEmpty: !rtContent.trim() });
      return;
    }

    setSavingRichText(true);
    try {
      const isUpdate = editingRichTextId !== null;
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate 
        ? `${API_BASE_URL}/kb-rich-text-sources/${editingRichTextId}`
        : `${API_BASE_URL}/kb-rich-text-sources`;

      log('RichText:save:start', { 
        name: rtName, 
        contentLength: rtContent.length, 
        promptId: selectedPrompt?.id,
        isUpdate,
        editingId: editingRichTextId
      });
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: rtName,
          content: rtContent,
          block_type: rtBlock,
          font_family: rtFamily,
          font_size: rtSize,
          line_height: rtLine,
          is_bold: rtBold,
          is_italic: rtItalic,
          is_underline: rtUnderline,
          prompt_id: selectedPrompt?.id || null
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        log('RichText:save:success', { result, isUpdate });
        
        // Clear the editor and reset editing state
        setRtName('');
        setRtContent('');
        setEditingRichTextId(null);
        if (rtRef.current) {
          rtRef.current.innerHTML = '';
        }
        
        // Refresh the rich text sources list
        if (selectedPrompt) {
          fetchRichTextSources(selectedPrompt.id);
        }
      } else {
        const errorText = await response.text();
        throw new Error(`${isUpdate ? 'Update' : 'Save'} failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      logError('RichText:save', error);
    } finally {
      setSavingRichText(false);
    }
  };

  // Delete rich text source
  const deleteRichTextSource = async (sourceId, sourceName) => {
    try {
      log('RichText:delete:start', { sourceId, sourceName });
      
      const response = await fetch(`${API_BASE_URL}/kb-rich-text-sources/${sourceId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        log('RichText:delete:success', { sourceId, sourceName });
        // Refresh the rich text sources list
        if (selectedPrompt) {
          fetchRichTextSources(selectedPrompt.id);
        }
      } else {
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      logError('RichText:delete', error);
    }
  };

  // Fetch uploaded files when File Upload tab is selected
  useEffect(() => {
    if (kbTab === 'File Upload' && selectedPrompt) {
      fetchUploadedFiles(selectedPrompt.id);
    }
  }, [kbTab, selectedPrompt]);

  // Fetch rich text sources when Rich Text tab is selected
  useEffect(() => {
    if (kbTab === 'Rich Text' && selectedPrompt) {
      fetchRichTextSources(selectedPrompt.id);
    }
  }, [kbTab, selectedPrompt]);

  // Fetch FAQ sources
  const fetchFaqSources = async (promptId = null) => {
    try {
      log('FAQ:fetch:start', { promptId });
      const url = promptId 
        ? `${API_BASE_URL}/kb-faq-sources?prompt_id=${promptId}`
        : `${API_BASE_URL}/kb-faq-sources`;
      
      const response = await fetch(url);
      if (response.ok) {
        const sources = await response.json();
        setFaqSources(sources);
        log('FAQ:fetch:success', { count: sources.length, sources });
      } else {
        throw new Error(`Failed to fetch FAQ sources: ${response.status}`);
      }
    } catch (error) {
      logError('FAQ:fetch', error);
      setFaqSources([]);
    }
  };

  // Save FAQ source (CREATE or UPDATE)
  const saveFaqSource = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      log('FAQ:save:validation', { questionEmpty: !faqQuestion.trim(), answerEmpty: !faqAnswer.trim() });
      return;
    }

    setSavingFaq(true);
    try {
      const isUpdate = editingFaqId !== null;
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate 
        ? `${API_BASE_URL}/kb-faq-sources/${editingFaqId}`
        : `${API_BASE_URL}/kb-faq-sources`;

      log('FAQ:save:start', { 
        question: faqQuestion.substring(0, 50) + '...', 
        answerLength: faqAnswer.length, 
        promptId: selectedPrompt?.id,
        isUpdate,
        editingId: editingFaqId
      });
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: faqQuestion,
          answer: faqAnswer,
          prompt_id: selectedPrompt?.id || null
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        log('FAQ:save:success', { result, isUpdate });
        
        // Clear the form and reset editing state
        setFaqQuestion('');
        setFaqAnswer('');
        setEditingFaqId(null);
        
        // Refresh the FAQ sources list
        if (selectedPrompt) {
          fetchFaqSources(selectedPrompt.id);
        }
      } else {
        const errorText = await response.text();
        throw new Error(`${isUpdate ? 'Update' : 'Save'} failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      logError('FAQ:save', error);
    } finally {
      setSavingFaq(false);
    }
  };

  // Delete FAQ source
  const deleteFaqSource = async (sourceId, sourceQuestion) => {
    try {
      log('FAQ:delete:start', { sourceId, sourceQuestion: sourceQuestion.substring(0, 50) + '...' });
      
      const response = await fetch(`${API_BASE_URL}/kb-faq-sources/${sourceId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        log('FAQ:delete:success', { sourceId, sourceQuestion });
        // Refresh the FAQ sources list
        if (selectedPrompt) {
          fetchFaqSources(selectedPrompt.id);
        }
      } else {
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      logError('FAQ:delete', error);
    }
  };

  // Fetch FAQ sources when FAQs tab is selected
  useEffect(() => {
    if (kbTab === 'FAQs' && selectedPrompt) {
      fetchFaqSources(selectedPrompt.id);
    }
  }, [kbTab, selectedPrompt]);

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

  

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Modern Header with Gradient */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-white/30 mb-10 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 px-6 sm:px-10 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 tracking-tight">Prompt Management</h1>
                <p className="text-indigo-100 text-sm sm:text-base font-medium">Manage and organize your AI prompts efficiently</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search prompts..."
                    className="w-full pl-11 pr-4 py-3.5 bg-white/20 text-white placeholder:text-indigo-100/70 rounded-xl border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/60 focus:border-transparent focus:bg-white/25 transition-all"
                  />
                  <svg className="w-5 h-5 text-white/90 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="group relative px-4 sm:px-6 py-3 sm:py-3.5 bg-white text-indigo-600 rounded-xl hover:bg-white/95 transition-all duration-200 transform hover:scale-105 hover:shadow-xl border border-white/50 font-semibold w-full sm:w-auto justify-center"
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
                  className="group relative px-4 sm:px-6 py-3 sm:py-3.5 bg-white/15 backdrop-blur-sm text-white rounded-xl hover:bg-white/25 transition-all duration-200 transform hover:scale-105 border border-white/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium w-full sm:w-auto justify-center"
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
          <div className={`p-6 sm:p-8 ${filteredPrompts.length === 0 ? 'min-h-[400px]' : 'min-h-0'}`}>
            {loading ? (
              <div className="flex flex-col justify-center items-center py-16">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200"></div>
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-600 absolute top-0 left-0"></div>
                </div>
                <div className="text-gray-700 font-semibold mt-6 text-lg">Loading prompts...</div>
                <div className="text-gray-500 text-sm mt-2">Please wait a moment</div>
              </div>
            ) : filteredPrompts.length === 0 ? (
              <div className="flex flex-col justify-center items-center py-16">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full p-6 mb-6">
                  <svg className="w-16 h-16 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{searchQuery ? 'No prompts found' : 'No prompts yet'}</h3>
                <p className="text-gray-600 text-center max-w-md mb-6">
                  {searchQuery ? `No prompts match "${searchQuery}". Try a different search term.` : 'Get started by creating your first prompt template.'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg"
                  >
                    Create Your First Prompt
                  </button>
                )}
              </div>
            ) : (
              <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4 mb-6">
                {filteredPrompts.map((prompt) => (
                  <div key={prompt.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md mr-3">
                          <span className="text-white font-bold text-base">{prompt.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">{prompt.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">ID: {String(prompt.id).slice(0, 8)}...</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 mb-4">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Location ID</span>
                        <p className="text-sm font-medium text-gray-900 mt-1">{prompt.location_id}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Business Name</span>
                        <p className="text-sm font-medium text-gray-900 mt-1">{prompt.business_name}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 uppercase">Prompt Content</span>
                          <button
                            onClick={() => {
                              setSelectedPrompt(prompt);
                              setShowViewModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                            title="View full prompt"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-1 line-clamp-2">{prompt.prompt}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 uppercase">Knowledgebase</span>
                          <button
                            onClick={() => {
                              setSelectedPrompt(prompt);
                              setShowKnowledgebaseModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                            title="Enlarge knowledgebase"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-1 line-clamp-2">{prompt.knowledgebase}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 uppercase">Inventory</span>
                          <button
                            onClick={() => {
                              setSelectedPrompt(prompt);
                              setShowInventoryModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                            title="Enlarge inventory"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-1 line-clamp-2">{String(prompt.inventory)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => openEditModal(prompt)}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-semibold shadow-sm text-sm"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteModal(prompt)}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-semibold shadow-sm text-sm"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto mb-6">
                <div className="w-full rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                <table className="w-full table-auto">
                  <thead className="bg-gradient-to-r from-gray-50 via-slate-50 to-gray-100 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-5 py-5 text-left text-xs font-bold text-gray-800 uppercase tracking-wider w-50">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span>Name</span>
                        </div>
                      </th>
                      
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider w-28">
                        <div className="flex items-center space-x-1">
                          <span>Location</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider w-32">
                        <div className="flex items-center space-x-1">
                          <span>Business</span>
                        </div>
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider hidden xl:table-cell w-56">
                        <div className="flex items-center space-x-1">
                          <span>Content</span>
                        </div>
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider hidden xl:table-cell w-44">
                        <div className="flex items-center space-x-1">
                          <span>Knowledge</span>
                        </div>
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider hidden xl:table-cell w-36">
                        <div className="flex items-center space-x-1">
                          <span>Inventory</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider w-28">
                        <div className="flex items-center justify-center">
                          <span>Actions</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredPrompts.map((prompt, index) => (
                      <tr key={prompt.id} className="group odd:bg-white even:bg-slate-50/50 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200 border-b border-gray-100 last:border-0 h-16">
                        <td className="px-3 py-4 whitespace-nowrap w-48">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                                <span className="text-white font-bold text-base">{prompt.name.charAt(0).toUpperCase()}</span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-base font-bold text-gray-900">{prompt.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">ID: {String(prompt.id).slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-3 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-700 truncate block w-24">{prompt.location_id}</span>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900 truncate block w-32">{prompt.business_name}</span>
                        </td>
                        <td className="px-2 py-4 text-sm text-gray-700 w-48 hidden xl:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="line-clamp-2 leading-relaxed flex-1 text-xs">
                              {prompt.prompt}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedPrompt(prompt);
                                setShowViewModal(true);
                              }}
                              className="inline-flex items-center justify-center flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                              title="View full prompt"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-sm text-gray-700 w-40 hidden xl:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="line-clamp-2 leading-relaxed flex-1 text-xs">
                              {prompt.knowledgebase}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedPrompt(prompt);
                                setShowKnowledgebaseModal(true);
                              }}
                              className="inline-flex items-center justify-center flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                              title="Enlarge knowledgebase"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-sm text-gray-700 w-32 hidden xl:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="line-clamp-2 leading-relaxed flex-1 text-xs">
                              {String(prompt.inventory)}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedPrompt(prompt);
                                setShowInventoryModal(true);
                              }}
                              className="inline-flex items-center justify-center flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                              title="Enlarge inventory"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-center w-28">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => openEditModal(prompt)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => openDeleteModal(prompt)}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-all"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Add Prompt Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn p-2 sm:p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden transform animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6">
              <div className="flex items-center">
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center mr-3 sm:mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">Add New Prompt</h2>
                <p className="text-indigo-100 text-sm sm:text-base mt-0.5 sm:mt-1 hidden sm:block">Create a new prompt template for your workflow</p>
              </div>
              </div>
            </div>
            
            <form onSubmit={handleAddPrompt} className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-y-auto max-h-[calc(95vh-140px)] sm:max-h-[calc(90vh-180px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-800 mb-2">
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
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white hover:border-gray-300 text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter prompt name..."
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Location ID
                  </label>
                  <input
                    type="text"
                    name="location_id"
                    value={formData.location_id}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white hover:border-gray-300 text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter location ID..."
                  />
                  
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Business Name
                  </label>
                  <input
                    type="text"
                    name="business_name"
                    value={formData.business_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white hover:border-gray-300 text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter business name..."
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Prompt Content
                </label>
                <textarea
                  name="prompt"
                  value={formData.prompt}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white hover:border-gray-300 resize-y min-h-[120px] text-gray-900 placeholder:text-gray-400"
                  placeholder="Enter your prompt content here..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Knowledgebase
                </label>
                <textarea
                  name="knowledgebase"
                  value={formData.knowledgebase}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white hover:border-gray-300 resize-y min-h-[120px] text-gray-900 placeholder:text-gray-400"
                  placeholder="Enter your knowledgebase here..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Inventory
                </label>
                <textarea
                  name="inventory"
                  value={formData.inventory}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white hover:border-gray-300 resize-y min-h-[120px] text-gray-900 placeholder:text-gray-400"
                  placeholder="Enter your inventory here..."
                  required
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 sm:pt-6 border-t-2 border-gray-100 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 -mb-4 sm:-mb-6 lg:-mb-8 pb-4 sm:pb-6 mt-6 sm:mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ name: '', prompt: '', location_id: '', business_name: '', knowledgebase: '', inventory: '' });
                  }}
                  className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 hover:border-gray-400 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-bold shadow-lg hover:shadow-xl"
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
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-3xl mx-4 transform animate-slideUp max-h-[85vh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
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
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Prompt Content
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowEditPromptModal(true)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                    title="Enlarge editor"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                </div>
                <textarea
                  name="prompt"
                  value={formData.prompt}
                  onChange={handleInputChange}
                  onDoubleClick={() => setShowEditPromptModal(true)}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white resize-none cursor-pointer"
                  placeholder="Enter your prompt content here..."
                  title="Double-click to enlarge editor"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Knowledgebase
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowEditKnowledgebaseModal(true)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Enlarge editor"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                </div>
                <textarea
                  name="knowledgebase"
                  value={formData.knowledgebase}
                  onChange={handleInputChange}
                  onDoubleClick={() => setShowEditKnowledgebaseModal(true)}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white resize-none cursor-pointer"
                  placeholder="Enter your knowledgebase here..."
                  title="Double-click to enlarge editor"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Inventory
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowEditInventoryModal(true)}
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                    title="Enlarge editor"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                </div>
                <textarea
                  name="inventory"
                  value={formData.inventory}
                  onChange={handleInputChange}
                  onDoubleClick={() => setShowEditInventoryModal(true)}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white resize-none cursor-pointer"
                  placeholder="Enter your inventory here..."
                  title="Double-click to enlarge editor"
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
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-md mx-4 transform animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
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
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => {
            setShowViewModal(false);
            setSelectedPrompt(null);
          }}
        >
          <div
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-5xl mx-4 max-h-[85vh] overflow-y-auto transform animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
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
                  {String(selectedPrompt.inventory)}
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

      {/* Knowledgebase Enlarge Modal */}
      {showKnowledgebaseModal && selectedPrompt && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => {
            setShowKnowledgebaseModal(false);
            setSelectedPrompt(null);
            setKbTab('All');
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Knowledge Sources</h2>
                  <p className="text-gray-500 mt-1">Add and manage sources your bot will use to learn and respond to users.</p>
                </div>
                <button
                  onClick={() => {
                    setShowKnowledgebaseModal(false);
                    setSelectedPrompt(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-6 text-sm font-semibold">
                  {['All','Web Crawler','FAQs','Tables','Rich Text','File Upload'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setKbTab(tab); log('kbTab:change', tab); }}
                      className={`pb-2 transition-colors ${kbTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(90vh-150px)] space-y-6">
              {kbTab === 'All' && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">
                    {selectedPrompt.knowledgebase}
                  </pre>
                </div>
              )}
              {kbTab === 'Web Crawler' && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow">
                  <div className="flex items-start mb-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Web Crawler</h3>
                      <p className="text-gray-500">Automatically crawl and extract content from a website to train your bot.</p>
                    </div>
                  </div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Enter Domain</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select value={crawlerMode} onChange={(e)=>setCrawlerMode(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg bg-white min-w-[160px]">
                      <option>Exact URL</option>
                      <option>All URLs with the path</option>
                      <option>All URLs in this domain</option>
                    </select>
                    <input value={crawlerUrl} onChange={(e)=>setCrawlerUrl(e.target.value)} placeholder="Enter URL" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg" />
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Extract Data</button>
                  </div>
                </div>
              )}
              {kbTab === 'FAQs' && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow">
                  <div className="grid grid-cols-12 gap-6">
                    {/* Sidebar Saved FAQs List */}
                    <aside className="col-span-12 md:col-span-4 border border-gray-200 rounded-xl bg-gray-50 p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Saved FAQs</h4>
                      {faqSources.length === 0 ? (
                        <div className="text-xs text-gray-400">No saved FAQs yet</div>
                      ) : (
                        <ul className="space-y-2 max-h-[400px] overflow-y-auto">
                          {faqSources.map(item => (
                            <li key={item.id}>
                              <div className="flex items-start gap-2">
                                <button
                                  className="flex-1 text-left p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
                                  onClick={()=>{
                                    setFaqQuestion(item.question);
                                    setFaqAnswer(item.answer);
                                    setEditingFaqId(item.id);
                                    log('FAQ:load:existing', { id: item.id, question: item.question.substring(0, 50) + '...' });
                                  }}
                                >
                                  <div className="text-sm font-medium text-gray-900 mb-1">{item.question}</div>
                                  <div className="text-xs text-gray-500 line-clamp-2">{item.answer}</div>
                                </button>
                                <button
                                  className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                  title="Delete"
                                  onClick={(e)=>{
                                    e.stopPropagation();
                                    if (window.confirm(`Are you sure you want to delete this FAQ?`)) {
                                      deleteFaqSource(item.id, item.question);
                                    }
                                  }}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </aside>

                    {/* FAQ Form Area */}
                    <section className="col-span-12 md:col-span-8">
                      <div className="flex items-start mb-5">
                        <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center mr-3">
                          <span className="text-gray-700 font-bold">?</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">FAQs</h3>
                          <p className="text-gray-500">Write a question and answer pair to help your bot answer common questions.</p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center mb-2">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold mr-2">Q</span>
                            <span className="text-xs text-gray-500">Your question</span>
                          </div>
                          <textarea
                            value={faqQuestion}
                            onChange={(e)=>setFaqQuestion(e.target.value)}
                            rows={4}
                            placeholder="Your question goes here"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={1000}
                          />
                          <div className="text-xs text-gray-400 text-right mt-1">{faqQuestion.length}/1000 characters</div>
                        </div>
                        <div>
                          <div className="flex items-center mb-2">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-50 text-green-600 text-xs font-semibold mr-2">A</span>
                            <span className="text-xs text-gray-500">Your answer</span>
                          </div>
                          <textarea
                            value={faqAnswer}
                            onChange={(e)=>setFaqAnswer(e.target.value)}
                            rows={5}
                            placeholder="Your answer goes here"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={1000}
                          />
                          <div className="text-xs text-gray-400 text-right mt-1">{faqAnswer.length}/1000 characters</div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <button 
                            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50" 
                            onClick={()=>{
                              setFaqQuestion('');
                              setFaqAnswer('');
                              setEditingFaqId(null);
                              log('FAQ:cancel', { wasEditing: editingFaqId !== null });
                            }}
                          >
                            Cancel
                          </button>
                          <button 
                            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" 
                            onClick={saveFaqSource}
                            disabled={savingFaq || !faqQuestion.trim() || !faqAnswer.trim()}
                          >
                            {savingFaq ? (editingFaqId ? 'Updating...' : 'Saving...') : (editingFaqId ? 'Update' : 'Save')}
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              )}
              {kbTab === 'Tables' && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Table Upload</h3>
                  <div className="flex items-center text-sm text-gray-600 mb-4">
                    <span className="flex items-center text-blue-600 font-semibold">1 <span className="ml-2">Upload File</span></span>
                    <span className="mx-4 text-gray-300">——</span>
                    <span className="text-gray-400">2 Column Selection</span>
                    <span className="mx-4 text-gray-300">——</span>
                    <span className="text-gray-400">3 Summary</span>
                  </div>
                  <div
                    className={`rounded-xl p-10 text-center cursor-pointer transition-colors ${tableDragging ? 'border-2 border-blue-500 bg-blue-50/30' : 'border-2 border-dashed border-blue-200 hover:border-blue-400'}`}
                    onDragOver={(e)=>{e.preventDefault();}}
                    onDragEnter={(e)=>{e.preventDefault(); setTableDragging(true);}}
                    onDragLeave={(e)=>{e.preventDefault(); setTableDragging(false);}}
                    onDrop={(e)=>handleDrop(e,'table')}
                    onClick={()=>tableInputRef.current && tableInputRef.current.click()}
                  >
                    <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 12l-4-4m0 0l-4 4m4-4v12"/></svg>
                    </div>
                    {tableFiles.length === 0 ? (
                      <>
                        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold mb-2">Drag CSV here</div>
                        <div className="text-gray-700">Click to upload or drag and drop</div>
                        <div className="text-xs mt-1 text-gray-500">CSV file only (max 50 MB)</div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-700">
                        Selected: {tableFiles.map(f=>f.name).join(', ')}
                      </div>
                    )}
                    <input ref={tableInputRef} type="file" accept=".csv" className="hidden" onChange={(e)=> {
                      const files = Array.from(e.target.files||[]);
                      setTableFiles(files);
                      log('Tables:fileInput:change', { fileCount: files.length, files: files.map(f => f.name) });
                    }} />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input 
                      value={tableName}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setTableName(newName);
                        log('Tables:nameInput:change', { name: newName });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg" 
                      placeholder="Enter a name for your table source" 
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-5">
                    <button 
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        setTableFiles([]);
                        setTableName('');
                        log('Tables:cancel');
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={(() => {
                        const isDisabled = tableFiles.length === 0 || !tableName.trim() || uploadingTable;
                        log('Tables:nextButton:disabled', { 
                          fileCount: tableFiles.length, 
                          nameLength: tableName.trim().length, 
                          uploading: uploadingTable, 
                          isDisabled 
                        });
                        return isDisabled;
                      })()}
                      onClick={async () => {
                        if (tableFiles.length === 0 || !tableName.trim()) return;
                        
                        setUploadingTable(true);
                        log('Tables:upload:start', { name: tableName, fileCount: tableFiles.length, promptId: selectedPrompt?.id });
                        
                        try {
                          const file = tableFiles[0]; // Take first CSV file
                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('name', tableName);
                          formData.append('prompt_id', selectedPrompt?.id || '');
                          
                          const response = await fetch(`${API_BASE_URL}/kb-table-sources`, {
                            method: 'POST',
                            body: formData,
                          });
                          
                          if (response.ok) {
                            const result = await response.json();
                            log('Tables:upload:success', result);
                            // Reset form
                            setTableFiles([]);
                            setTableName('');
                            // Could show success message or move to next step
                          } else {
                            const errorText = await response.text();
                            throw new Error(`Upload failed: ${response.status} ${errorText}`);
                          }
                        } catch (error) {
                          logError('Tables:upload', error);
                        } finally {
                          setUploadingTable(false);
                        }
                      }}
                    >
                      {uploadingTable ? 'Uploading...' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
              {kbTab === 'Rich Text' && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow">
                  <div className="grid grid-cols-12 gap-6">
                    {/* Sidebar Saved List */}
                    <aside className="col-span-12 md:col-span-3 border border-gray-200 rounded-xl bg-gray-50 p-4">
                      {rtSaved.length === 0 ? (
                        <div className="text-xs text-gray-400">No saved content yet</div>
                      ) : (
                        <ul className="space-y-2 max-h-[400px] overflow-y-auto">
                          {rtSaved.map(item => (
                            <li key={item.id}>
                              <div className="flex items-center gap-2">
                                <button
                                  className="flex-1 text-left p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
                                  onClick={()=>{
                                    setRtName(item.name);
                                    setRtContent(item.content);
                                    setEditingRichTextId(item.id); // Set editing ID
                                    if (rtRef.current) rtRef.current.innerHTML = item.content;
                                    log('RichText:load:existing', { id: item.id, name: item.name });
                                  }}
                                >
                                  <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                                  <div className="text-xs text-gray-500 truncate" dangerouslySetInnerHTML={{__html: item.content}} />
                                </button>
                                <button
                                  className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                  title="Delete"
                                  onClick={(e)=>{
                                    e.stopPropagation();
                                    if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
                                      deleteRichTextSource(item.id, item.name);
                                    }
                                  }}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </aside>

                    {/* Editor Area */}
                    <section className="col-span-12 md:col-span-9">
                      <input
                        value={rtName}
                        onChange={(e)=>setRtName(e.target.value)}
                        className="w-full mb-4 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter Name"
                      />
                      <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-200 rounded-xl bg-gray-50 mb-4 text-sm text-gray-700">
                        <select
                          value={rtBlock}
                          onChange={(e)=>{
                            const v = e.target.value; setRtBlock(v);
                            exec('formatBlock', v === 'Heading' ? 'H2' : 'P');
                          }}
                          className="h-9 px-2 border border-gray-300 rounded-md bg-white"
                        >
                          <option>Paragraph</option>
                          <option>Heading</option>
                        </select>
                        <select value={rtFamily} onChange={(e)=>setRtFamily(e.target.value)} className="h-9 px-2 border border-gray-300 rounded-md bg-white">
                          <option>Inter</option>
                          <option>System</option>
                        </select>
                        <select value={rtSize} onChange={(e)=>setRtSize(e.target.value)} className="h-9 px-2 border border-gray-300 rounded-md bg-white">
                          <option>14px</option>
                          <option>16px</option>
                          <option>18px</option>
                        </select>
                        <select value={rtLine} onChange={(e)=>setRtLine(e.target.value)} className="h-9 px-2 border border-gray-300 rounded-md bg-white">
                          <option>1.2</option>
                          <option>1.5</option>
                          <option>1.8</option>
                        </select>
                        <button
                          onClick={()=>exec('bold')}
                          className={`h-9 w-9 border rounded-md bg-white font-semibold ${rtBold ? 'border-blue-500 text-blue-600' : 'border-gray-300'}`}
                          type="button"
                        >
                          B
                        </button>
                        <button
                          onClick={()=>exec('italic')}
                          className={`h-9 w-9 border rounded-md bg-white italic ${rtItalic ? 'border-blue-500 text-blue-600' : 'border-gray-300'}`}
                          type="button"
                        >
                          I
                        </button>
                        <button
                          onClick={()=>exec('underline')}
                          className={`h-9 w-9 border rounded-md bg-white underline ${rtUnderline ? 'border-blue-500 text-blue-600' : 'border-gray-300'}`}
                          type="button"
                        >
                          U
                        </button>
                      </div>
                      <div className="relative">
                        <div
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[240px]"
                          contentEditable
                          suppressContentEditableWarning
                          ref={rtRef}
                          onInput={(e)=>{ setRtContent(e.currentTarget.innerHTML); updateInlineStates(); }}
                          onMouseUp={updateInlineStates}
                          onKeyUp={updateInlineStates}
                          style={{
                            fontFamily: rtFamily === 'Inter' ? 'Inter, ui-sans-serif, system-ui' : 'ui-sans-serif, system-ui',
                            fontSize: rtSize,
                            lineHeight: rtLine
                          }}
                        />
                        {rtContent.trim().length === 0 && (
                          <span className="pointer-events-none absolute top-3 left-4 text-gray-400">Start typing your content...</span>
                        )}
                      </div>
                      <div className="flex justify-end gap-3 mt-4">
                        <button
                          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                          onClick={()=>{
                            setRtName('');
                            setRtContent('');
                            setEditingRichTextId(null); // Clear editing state
                            if (rtRef.current) rtRef.current.innerHTML = '';
                            log('RichText:cancel', { wasEditing: editingRichTextId !== null });
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={saveRichTextSource}
                          disabled={savingRichText || !rtName.trim() || !rtContent.trim()}
                        >
                          {savingRichText ? (editingRichTextId ? 'Updating...' : 'Saving...') : (editingRichTextId ? 'Update' : 'Save')}
                        </button>
                      </div>
                    </section>
                  </div>
                </div>
              )}
              {kbTab === 'File Upload' && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow">
                  <div className="flex items-start mb-4">
                    <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 12l-4-4m0 0l-4 4m4-4v12"/></svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Upload Files</h3>
                      <p className="text-gray-500">Upload files to your knowledge base to train your AI assistant.</p>
                    </div>
                  </div>
                  <div
                    className={`rounded-xl p-10 text-center text-gray-500 cursor-pointer transition-colors ${fileDragging ? 'border-2 border-blue-500 bg-blue-50/30' : 'border-2 border-dashed border-blue-200 hover:border-blue-400'}`}
                    onDragOver={(e)=>{e.preventDefault();}}
                    onDragEnter={(e)=>{e.preventDefault(); setFileDragging(true);}}
                    onDragLeave={(e)=>{e.preventDefault(); setFileDragging(false);}}
                    onDrop={(e)=>handleDrop(e,'files')}
                    onClick={()=>fileInputRef.current && fileInputRef.current.click()}
                  >
                    {fileUploadFiles.length === 0 ? (
                      <>
                        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold mb-2">Drag files here</div>
                        <div>
                          Drop files here or <span className="text-blue-600">browse</span>
                        </div>
                        <div className="text-xs mt-1">Supports PDF, DOC, DOCX</div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-700">
                        Selected: {fileUploadFiles.map(f=>f.name).join(', ')}
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" multiple className="hidden" onChange={(e)=> {
                      const files = Array.from(e.target.files||[]);
                      setFileUploadFiles(files);
                      log('Files:fileInput:change', { fileCount: files.length, files: files.map(f => f.name) });
                    }} />
                  </div>
                  <div className="flex justify-end gap-3 mt-5">
                    <button 
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        setFileUploadFiles([]);
                        log('Files:cancel');
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={(() => {
                        const isDisabled = fileUploadFiles.length === 0 || uploadingFiles;
                        log('Files:uploadButton:disabled', { 
                          fileCount: fileUploadFiles.length, 
                          uploading: uploadingFiles, 
                          isDisabled 
                        });
                        return isDisabled;
                      })()}
                      onClick={async () => {
                        if (fileUploadFiles.length === 0) return;
                        
                        setUploadingFiles(true);
                        log('Files:upload:start', { fileCount: fileUploadFiles.length, promptId: selectedPrompt?.id });
                        
                        try {
                          const results = [];
                          
                          // Upload each file
                          for (const file of fileUploadFiles) {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('prompt_id', selectedPrompt?.id || '');
                            
                            const response = await fetch(`${API_BASE_URL}/kb-file-sources`, {
                              method: 'POST',
                              body: formData,
                            });
                            
                            if (response.ok) {
                              const result = await response.json();
                              results.push(result);
                              log('Files:upload:fileSuccess', { file: file.name, result });
                            } else {
                              const errorText = await response.text();
                              throw new Error(`Upload failed for ${file.name}: ${response.status} ${errorText}`);
                            }
                          }
                          
                          log('Files:upload:allSuccess', { totalFiles: results.length, results });
                          // Reset form
                          setFileUploadFiles([]);
                          // Refresh uploaded files list
                          if (selectedPrompt) {
                            fetchUploadedFiles(selectedPrompt.id);
                          }
                        } catch (error) {
                          logError('Files:upload', error);
                        } finally {
                          setUploadingFiles(false);
                        }
                      }}
                    >
                      {uploadingFiles ? 'Uploading...' : 'Upload Files'}
                    </button>
                  </div>
                  
                  {/* Uploaded Files List */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-6 border-t pt-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Uploaded Files ({uploadedFiles.length})</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {uploadedFiles.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                {file.mime_type?.includes('pdf') ? (
                                  <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                                <p className="text-xs text-gray-500">
                                  {(file.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(file.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                file.status === 'uploaded' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {file.status}
                              </span>
                              {/* Only show download button on localhost */}
                              {API_BASE_URL.includes('localhost') && (
                                <button 
                                  onClick={() => window.open(`${API_BASE_URL.replace('/api', '')}${file.file_url}`, '_blank')}
                                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                                  title="Download file"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </button>
                              )}
                              {!API_BASE_URL.includes('localhost') && (
                                <span className="text-xs text-gray-400 px-2">View only</span>
                              )}
                              {/* Delete button */}
                              <button 
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete "${file.file_name}"?`)) {
                                    deleteUploadedFile(file.id, file.file_name);
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                title="Delete file"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Enlarge Modal */}
      {showInventoryModal && selectedPrompt && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => {
            setShowInventoryModal(false);
            setSelectedPrompt(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-8 py-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Inventory</h2>
                  <p className="text-purple-100 mt-1">Prompt: {selectedPrompt.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowInventoryModal(false);
                    setSelectedPrompt(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">
                  {String(selectedPrompt.inventory)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Knowledgebase Enlarge Modal */}
      {showEditKnowledgebaseModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setShowEditKnowledgebaseModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Edit Knowledgebase</h2>
                  <p className="text-blue-100 mt-1">Large editor for easier editing</p>
                </div>
                <button
                  onClick={() => setShowEditKnowledgebaseModal(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-8">
              <textarea
                name="knowledgebase"
                value={formData.knowledgebase}
                onChange={handleInputChange}
                rows={20}
                className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white resize-none text-base leading-relaxed"
                placeholder="Enter your knowledgebase content here..."
              />
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditKnowledgebaseModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Inventory Enlarge Modal */}
      {showEditInventoryModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setShowEditInventoryModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-8 py-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Edit Inventory</h2>
                  <p className="text-purple-100 mt-1">Large editor for easier editing</p>
                </div>
                <button
                  onClick={() => setShowEditInventoryModal(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-8">
              <textarea
                name="inventory"
                value={formData.inventory}
                onChange={handleInputChange}
                rows={20}
                className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-gray-50 hover:bg-white resize-none text-base leading-relaxed"
                placeholder="Enter your inventory content here..."
              />
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditInventoryModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Prompt Content Enlarge Modal */}
      {showEditPromptModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setShowEditPromptModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Edit Prompt Content</h2>
                  <p className="text-green-100 mt-1">Large editor for easier editing</p>
                </div>
                <button
                  onClick={() => setShowEditPromptModal(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-8">
              <textarea
                name="prompt"
                value={formData.prompt}
                onChange={handleInputChange}
                rows={20}
                className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-gray-50 hover:bg-white resize-none text-base leading-relaxed"
                placeholder="Enter your prompt content here..."
              />
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditPromptModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  Done
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
