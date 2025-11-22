import fs from 'fs';
import path from 'path';

const appCode = `import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  ChevronLeft, ChevronRight, Trash2, Check, X, Activity, 
  TrendingUp, ShieldAlert, Trophy, Calendar, Leaf, Skull, Plus, LogOut 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect, // Import Redirect for mobile support
  getRedirectResult,  // Import Result handler
  GoogleAuthProvider, 
  signOut,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query 
} from 'firebase/firestore';

// --- Firebase Setup ---

// 1. GO TO YOUR FIREBASE CONSOLE -> PROJECT SETTINGS
// 2. COPY YOUR CONFIG OBJECT AND PASTE IT BELOW
// 3. UNCOMMENT THE BLOCK BELOW
/*
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
*/

// Initialize Firebase (Conditional check is for the chat preview only)
const app = initializeApp(
  typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) // Use chat config if available
    : (typeof firebaseConfig !== 'undefined' ? firebaseConfig : {}) // Use your config in production
);

const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'habit-tracker-v1'; // Fixed ID for your app

// --- Helper Functions ---
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const formatDateKey = (date) => date.toISOString().split('T')[0]; // YYYY-MM-DD

export default function HabitTracker() {
  // --- State ---
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [authLoading, setAuthLoading] = useState(true);
  
  // Quick Add Form State
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitType, setNewHabitType] = useState('build'); // 'build' or 'break'

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      // 1. Check if user is returning from a Google Redirect (Mobile fix)
      try {
        await getRedirectResult(auth);
      } catch (error) {
        console.error("Redirect login failed:", error);
      }

      // 2. Handle chat-preview specific auth tokens if present
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setHabits([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedHabits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedHabits.sort((a, b) => a.createdAt - b.createdAt);
      setHabits(fetchedHabits);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching habits:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Actions ---
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Use Redirect for mobile compatibility instead of Popup
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      // Fallback to popup if redirect fails immediately (rare)
      try {
         const provider = new GoogleAuthProvider();
         await signInWithPopup(auth, provider);
      } catch (popupError) {
         alert("Login failed. Please try using a different browser.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitTitle.trim() || !user) return;

    const icon = newHabitType === 'build' ? '🌱' : '💀';

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'), {
        title: newHabitTitle,
        type: newHabitType,
        icon: icon,
        createdAt: Date.now(),
        completedDates: {} 
      });
      setNewHabitTitle('');
    } catch (error) {
      console.error("Error adding habit:", error);
    }
  };

  const toggleHabit = async (habitId, dateKey) => {
    if (!user) return;
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const newCompletedDates = { ...habit.completedDates };
    if (newCompletedDates[dateKey]) {
      delete newCompletedDates[dateKey];
    } else {
      newCompletedDates[dateKey] = true;
    }

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habitId), {
        completedDates: newCompletedDates
      });
    } catch (error) {
      console.error("Error updating habit:", error);
    }
  };

  const deleteHabit = async (habitId) => {
    if (!user || !confirm('Are you sure you want to delete this habit?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habitId));
    } catch (error) {
      console.error("Error deleting habit:", error);
    }
  };

  // --- Date Logic ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return {
      day: i + 1,
      dateKey: formatDateKey(d),
      weekday: d.toLocaleString('default', { weekday: 'narrow' }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: formatDateKey(d) === formatDateKey(new Date())
    };
  });

  // --- Analytics Calculations ---
  const stats = useMemo(() => {
    if (habits.length === 0) return null;

    const dailyData = daysArray.map(day => {
      const completedCount = habits.filter(h => h.completedDates?.[day.dateKey]).length;
      const percentage = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;
      return {
        day: day.day,
        progress: percentage,
        completed: completedCount
      };
    });

    const goalData = habits.map(h => {
      let count = 0;
      daysArray.forEach(d => {
        if (h.completedDates?.[d.dateKey]) count++;
      });
      return {
        name: h.title.substring(0, 10) + (h.title.length > 10 ? '...' : ''),
        actual: count,
        goal: Math.floor(daysInMonth * 0.8),
        type: h.type
      };
    });

    return { dailyData, goalData };
  }, [habits, daysArray, daysInMonth]);

  // --- Login Screen ---
  if (authLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-lg border border-gray-100 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Leaf className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to FocusLab</h1>
          <p className="text-slate-500 mb-8">Track your habits and build a better version of yourself.</p>
          
          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-3"
          >
             {/* Simple Google G icon */}
            <div className="bg-white p-1 rounded-full">
               <svg className="w-4 h-4" viewBox="0 0 24 24">
                 <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                 <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                 <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/>
                 <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
               </svg>
            </div>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-slate-800 font-sans p-4 md:p-8 overflow-x-hidden">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            {monthName} Tracker
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium uppercase tracking-widest">
            {user.email ? user.email.split('@')[0] : 'User'} • {year}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Month Navigation */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold min-w-[100px] text-center uppercase tracking-wide text-slate-700">
              {monthName}
            </span>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* Sign Out Button */}
          <button 
            onClick={handleLogout}
            className="bg-white text-slate-500 hover:text-rose-600 p-3 rounded-xl shadow-sm border border-gray-200 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 items-start">
        
        {/* Left Sidebar / Controls */}
        <div className="space-y-6 sticky top-8">
          {/* Quick Add Widget */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Habits</h3>
            
            <form onSubmit={handleAddHabit} className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="New..." 
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newHabitTitle.trim()}
                  className="bg-slate-900 text-white w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 transition-colors flex-shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewHabitType('build')}
                  className={\`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border \${
                    newHabitType === 'build'
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-800 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }\`}
                >
                  <Leaf className="w-3.5 h-3.5" /> Build
                </button>
                <button
                  type="button"
                  onClick={() => setNewHabitType('break')}
                  className={\`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border \${
                    newHabitType === 'break'
                      ? 'bg-rose-100 border-rose-200 text-rose-800 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }\`}
                >
                  <Skull className="w-3.5 h-3.5" /> Break
                </button>
              </div>
            </form>
          </div>

          {/* Mini Stats Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Summary</h3>
             <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Activity className="w-4 h-4 text-emerald-500" /> Active Habits
                  </div>
                  <span className="font-bold text-slate-900">{habits.length}</span>
               </div>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-blue-500" /> Total Checks
                  </div>
                  <span className="font-bold text-slate-900">
                    {habits.reduce((acc, h) => acc + Object.keys(h.completedDates || {}).length, 0)}
                  </span>
               </div>
             </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="space-y-8 overflow-hidden">
          
          {/* Grid Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto pb-2">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-left font-semibold text-slate-700 min-w-[200px] sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                      Habit
                    </th>
                    {daysArray.map((d) => (
                      <th key={d.day} className={\`p-1 text-center min-w-[32px] border-r border-dashed border-gray-200 last:border-none \${d.isWeekend ? 'bg-gray-50/50' : ''}\`}>
                        <div className={\`text-[10px] mb-1 font-medium uppercase \${d.isToday ? 'text-emerald-600' : 'text-gray-400'}\`}>
                          {d.weekday[0]}
                        </div>
                        <div className={\`text-sm font-bold \${d.isToday ? 'bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-full mx-auto shadow-sm' : 'text-slate-700'}\`}>
                          {d.day}
                        </div>
                      </th>
                    ))}
                    <th className="p-4 text-center min-w-[80px] text-xs font-bold text-slate-500 uppercase">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {habits.map((habit) => (
                    <tr key={habit.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">
                      <td className="p-3 sticky left-0 bg-white group-hover:bg-gray-50 transition-colors z-10 border-r border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{habit.icon}</span>
                            <div>
                              <div className="font-medium text-sm text-slate-800">{habit.title}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteHabit(habit.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      {daysArray.map((d) => {
                        const isCompleted = habit.completedDates?.[d.dateKey];
                        const colorClass = habit.type === 'build' ? 'bg-emerald-500' : 'bg-rose-500';
                        const bgClass = habit.type === 'build' ? 'bg-emerald-50' : 'bg-rose-50';
                        
                        return (
                          <td 
                            key={d.day} 
                            className={\`p-1 text-center border-r border-dashed border-gray-200 cursor-pointer select-none transition-colors
                              \${d.isWeekend ? 'bg-gray-50/30' : ''}
                              \${isCompleted ? \`\${bgClass}/50\` : 'hover:bg-gray-100'}
                            \`}
                            onClick={() => toggleHabit(habit.id, d.dateKey)}
                          >
                            <div className={\`
                              w-5 h-5 mx-auto rounded flex items-center justify-center transition-all duration-200
                              \${isCompleted 
                                ? \`\${colorClass} text-white shadow-sm scale-100\` 
                                : 'bg-gray-100 text-transparent scale-75 hover:scale-90'
                              }
                            \`}>
                              <Check className="w-3 h-3" strokeWidth={4} />
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-2 text-center">
                        <span className={\`text-xs font-bold \${habit.type === 'build' ? 'text-emerald-600' : 'text-rose-600'}\`}>
                          {Math.round((Object.keys(habit.completedDates || {}).length / daysInMonth) * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  
                  {habits.length === 0 && (
                    <tr>
                      <td colSpan={daysInMonth + 2} className="p-12 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <Calendar className="w-10 h-10 opacity-20" />
                          <p className="text-sm">Add a habit using the sidebar to start.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Monthly Consistency
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.dailyData || []}>
                    <defs>
                      <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} interval={4} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      cursor={{stroke: '#cbd5e1'}}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="progress" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorProgress)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
`;

// Fix path to handle src relative to cwd
fs.writeFileSync(path.join('src', 'App.jsx'), appCode);
console.log('Successfully updated src/App.jsx with mobile login fix!');