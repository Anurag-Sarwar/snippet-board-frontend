import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client'; // 1. IMPORT SOCKET CLIENT

const API_BASE = 'http://localhost:5000/api';
const socket = io('http://localhost:5000'); // 2. CONNECT TO BACKEND TUNNEL

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [newSnippet, setNewSnippet] = useState('');
  const [snippets, setSnippets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // --- LOCALSTORAGE HYDRATION ---
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedName = localStorage.getItem('username');
    if (savedToken && savedName) {
      setIsLoggedIn(true);
      setUsername(savedName);
      fetchSnippets();
    }
  }, []);

  // --- 3. THE MAGIC REAL-TIME LISTENER ---
  useEffect(() => {
    // Whenever the backend shouts 'receive_snippet', do this:
    socket.on('receive_snippet', (newIncomingSnippet) => {
      setSnippets((prevSnippets) => {
        // Prevent duplicates just in case
        if (prevSnippets.some(s => s._id === newIncomingSnippet._id)) return prevSnippets;
        // Instantly push the new snippet to the top of the feed!
        return [newIncomingSnippet, ...prevSnippets];
      });
    });

    // Clean up the listener if the user leaves the page
    return () => socket.off('receive_snippet');
  }, []);

  // --- API FUNCTIONS ---
  const fetchSnippets = async () => {
    try {
      const response = await axios.get(`${API_BASE}/snippets`);
      setSnippets(response.data);
    } catch (err) {
      console.error('Error fetching snippets:', err.message);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    const endpoint = isLoginView ? '/auth/login' : '/auth/register';
    
    try {
      const response = await axios.post(`${API_BASE}${endpoint}`, authForm);
      const { token, username: returnedName } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('username', returnedName);
      
      setUsername(returnedName);
      setIsLoggedIn(true);
      fetchSnippets(); 
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.response?.data?.message || 'Authentication failed.');
    }
  };

  const handlePostSnippet = async (e) => {
    e.preventDefault();
    if (!newSnippet.trim()) return;
    setErrorMessage('');

    try {
      const token = localStorage.getItem('token');
      // We send it to the database. The database saves it, tags it with AI, and then uses the Socket to broadcast it back!
      await axios.post(
        `${API_BASE}/snippets`,
        { content: newSnippet },
        { headers: { Authorization: token } } 
      );
      
      setNewSnippet(''); 
      // Notice we removed the manual state update here, because our Socket listener above will catch it automatically!
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to sync snippet.');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUsername('');
    setSnippets([]);
    setAuthForm({ username: '', email: '', password: '' });
  };

  const filteredSnippets = snippets.filter(item => 
    item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.aiTags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // --- RENDERING ---
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-4 font-sans">
        <div className="w-full max-w-md rounded-2xl bg-[#1e293b] p-8 shadow-2xl border border-slate-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-teal-400 tracking-tight">SnippetBoard</h1>
            <p className="text-slate-400 text-sm mt-2">
              {isLoginView ? 'Access your developer workspace' : 'Create your engineer profile'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-lg text-center">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            {!isLoginView && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Username</label>
                <input
                  type="text"
                  required
                  className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500 transition-colors"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
              <input
                type="email"
                required
                className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500 transition-colors"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Password</label>
              <input
                type="password"
                required
                className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500 transition-colors"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              />
            </div>

            <button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold py-3 px-4 rounded-lg transition-all shadow-lg active:scale-[0.98]">
              {isLoginView ? 'Sign In' : 'Register Account'}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-slate-700 pt-4">
            <button
              onClick={() => setIsLoginView(!isLoginView)}
              className="text-sm text-teal-400 hover:underline bg-transparent border-none cursor-pointer focus:outline-none"
            >
              {isLoginView ? "Don't have an account? Sign Up" : 'Already registered? Sign In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans">
      <nav className="bg-[#1e293b] border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-black text-teal-400 tracking-tight">SnippetBoard</span>
          <span className="hidden sm:inline px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400 border border-slate-700 animate-pulse text-emerald-400">Live</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium">Signed in as</p>
            <p className="text-sm font-bold text-teal-300">@{username}</p>
          </div>
          <button onClick={handleLogout} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded-md border border-slate-700 transition-colors">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 p-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl">
            <h2 className="text-lg font-bold text-slate-200 mb-4">Create Workspace</h2>
            {errorMessage && (
              <div className="mb-3 p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded text-center">
                {errorMessage}
              </div>
            )}
            <form onSubmit={handlePostSnippet} className="space-y-4">
              <textarea
                required
                rows="6"
                placeholder="Paste terminal logs, code blocks, or documentation..."
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-4 text-sm text-slate-300 font-mono focus:outline-none focus:border-teal-500 placeholder:text-slate-500 resize-none"
                value={newSnippet}
                onChange={(e) => setNewSnippet(e.target.value)}
              />
              <button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg shadow-lg transition-all">
                Broadcast Snippet
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-800 shadow-md">
            <input
              type="text"
              placeholder="Filter boards dynamically by exact code match or AI tags..."
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-500 placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            {filteredSnippets.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No indexed snippets found matching current criteria.
              </div>
            ) : (
              filteredSnippets.map((item) => (
                <div key={item._id} className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-md hover:border-slate-700 transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-teal-400">@{item.author?.username || 'anonymous'}</span>
                    <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="bg-[#0f172a] rounded-lg p-4 border border-slate-800 font-mono text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap mb-4">
                    {item.content}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.aiTags?.map((tag, idx) => (
                      <span key={idx} className="text-[10px] uppercase font-extrabold tracking-wider bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;