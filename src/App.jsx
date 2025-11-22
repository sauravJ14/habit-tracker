import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  ChevronLeft, ChevronRight, Trash2, Check, X, Activity, 
  TrendingUp, ShieldAlert, Trophy, Calendar, Leaf, Skull, Plus, LogOut, User,
  Moon, Sun, Lock
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  signInAnonymously,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query 
} from 'firebase/firestore';

// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyANDPmkWdf0v3IjKH3ETGwj4WS9q8_0lRM",
  authDomain: "habit-tracker-88805.firebaseapp.com",
  projectId: "habit-tracker-88805",
  storageBucket: "habit-tracker-88805.firebasestorage.app",
  messagingSenderId: "846535830526",
  appId: "1:846535830526:web:0e1d148744d58581bd2eaf",
  measurementId: "G-E7J2GH0FRT"
};

// Initialize Firebase
const app = initializeApp(
  typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : (typeof firebaseConfig !== 'undefined' ? firebaseConfig : {})
);

const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'habit-tracker-v1';

// --- Helper Functions ---
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const formatDateKey = (date) => date.toISOString().split('T')[0]; // YYYY-MM-DD

// --- Sub-Component: Habit Table Section ---
const HabitSection = ({ title, type, habits, daysArray, toggleHabit, deleteHabit, daysInMonth, isDarkMode }) => {
  if (habits.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mb-8 transition-colors">
      <div className={`p-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2 ${
        type === 'build' ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : 'bg-rose-50/50 dark:bg-rose-900/20'
      }`}>
        {type === 'build' ? <Leaf className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <Skull className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
        <h3 className={`font-bold text-sm uppercase tracking-widest ${
          type === 'build' ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
        }`}>
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto pb-2">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
              <th className="p-4 text-left font-semibold text-slate-700 dark:text-slate-300 min-w-[200px] sticky left-0 bg-gray-50 dark:bg-slate-900 z-10 border-r border-gray-200 dark:border-slate-700">
                Habit
              </th>
              {daysArray.map((d) => (
                <th key={d.day} className={`p-1 text-center min-w-[32px] border-r border-dashed border-gray-200 dark:border-slate-700 last:border-none ${d.isWeekend ? 'bg-gray-50/50 dark:bg-slate-800/50' : ''}`}>
                  <div className={`text-[10px] mb-1 font-medium uppercase ${d.isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`}>
                    {d.weekday[0]}
                  </div>
                  <div className={`text-sm font-bold ${d.isToday ? 'bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-full mx-auto shadow-sm' : 'text-slate-700 dark:text-slate-300'}`}>
                    {d.day}
                  </div>
                </th>
              ))}
              <th className="p-4 text-center min-w-[80px] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => (
              <tr key={habit.id} className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                <td className="p-3 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-gray-50 dark:group-hover:bg-slate-700/30 transition-colors z-10 border-r border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{habit.icon}</span>
                      <div>
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{habit.title}</div>
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
                  const bgClass = habit.type === 'build' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/30';
                  
                  // Lock logic: If date is STRICTLY before today (past), it is locked.
                  const todayKey = formatDateKey(new Date());
                  const isPast = d.dateKey < todayKey;
                  
                  return (
                    <td 
                      key={d.day} 
                      className={`p-1 text-center border-r border-dashed border-gray-200 dark:border-slate-700 select-none transition-colors relative
                        ${d.isWeekend ? 'bg-gray-50/30 dark:bg-slate-800/30' : ''}
                        ${isCompleted ? `${bgClass}/50` : (isPast ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer')}
                      `}
                      onClick={() => !isPast && toggleHabit(habit.id, d.dateKey)}
                      title={isPast ? "Past dates are locked" : ""}
                    >
                      <div className={`
                        w-5 h-5 mx-auto rounded flex items-center justify-center transition-all duration-200
                        ${isCompleted 
                          ? `${colorClass} text-white shadow-sm scale-100` 
                          : 'bg-gray-100 dark:bg-slate-700 text-transparent scale-75 hover:scale-90'
                        }
                      `}>
                        <Check className="w-3 h-3" strokeWidth={4} />
                      </div>
                      {isPast && !isCompleted && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-20">
                            <Lock className="w-3 h-3 text-slate-400" />
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="p-2 text-center">
                  <span className={`text-xs font-bold ${habit.type === 'build' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {Math.round((Object.keys(habit.completedDates || {}).length / daysInMonth) * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function HabitTracker() {
  // --- State ---
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [authLoading, setAuthLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  
  // Quick Add Form State
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitType, setNewHabitType] = useState('build'); // 'build' or 'break'

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await getRedirectResult(auth);
      } catch (error) {
        console.error("Redirect login failed:", error);
      }
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) {
          console.error("Custom token failed", e);
        }
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
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      try {
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
      } catch (redirError) {
        alert("Login failed. Try Guest Mode.");
      }
    }
  };

  const handleGuestLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Guest login failed:", error);
      alert("Guest login failed.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setHabits([]); 
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
    
    // Lock Logic Check
    const todayKey = formatDateKey(new Date());
    if (dateKey < todayKey) {
      // Silently return or alert if preferred. Visually it is locked.
      return;
    }

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
    if (!user || !window.confirm('Are you sure you want to delete this habit?')) return;
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

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return {
        day: i + 1,
        dateKey: formatDateKey(d),
        weekday: d.toLocaleString('default', { weekday: 'narrow' }),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: formatDateKey(d) === formatDateKey(new Date())
      };
    });
  }, [year, month, daysInMonth]);

  // --- Analytics ---
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

    return { dailyData };
  }, [habits, daysArray]);

  // --- Filtered Habits ---
  const buildHabits = habits.filter(h => h.type === 'build');
  const breakHabits = habits.filter(h => h.type === 'break');

  // --- Login Screen ---
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-slate-400">
      <div className="flex flex-col items-center animate-pulse">
        <Leaf className="w-8 h-8 mb-4 text-emerald-400" />
        <span>Loading FocusLab...</span>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-lg border border-gray-100 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
            <Leaf className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to FocusLab</h1>
          <p className="text-slate-500 mb-8">Track your habits and build a better version of yourself.</p>
          
          <div className="space-y-3">
            <button 
              onClick={handleGoogleLogin}
              className="w-full bg-white text-slate-700 border border-gray-200 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
            >
              <div className="w-5 h-5">
                 <svg viewBox="0 0 24 24">
                   <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                   <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                   <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/>
                   <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                 </svg>
              </div>
              Sign in with Google
            </button>

            <button 
              onClick={handleGuestLogin}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-3"
            >
              <User className="w-5 h-5" />
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    // Dark Mode Wrapper
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-4 md:p-8 overflow-x-hidden transition-colors duration-300">
        
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
             {/* User Photo or Fallback */}
             <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border-2 border-emerald-500 p-0.5 shadow-sm overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                    <User className="w-6 h-6" />
                  </div>
                )}
             </div>
             <div>
               <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                 {monthName} Tracker
               </h1>
               <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium uppercase tracking-widest">
                 {user.isAnonymous ? 'Guest User' : (user.displayName || 'User')} • {year}
               </p>
             </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Dark Mode Toggle */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
               {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Month Navigation */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-600 dark:text-slate-400">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold min-w-[100px] text-center uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {monthName}
              </span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-600 dark:text-slate-400">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Sign Out Button */}
            <button 
              onClick={handleLogout}
              className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-500 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 items-start">
          
          {/* Left Sidebar / Controls */}
          <div className="space-y-6 sticky top-8 z-20">
            {/* Quick Add Widget */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">New Habit</h3>
              
              <form onSubmit={handleAddHabit} className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="e.g., Read 20 mins" 
                    value={newHabitTitle}
                    onChange={(e) => setNewHabitTitle(e.target.value)}
                    className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500 transition-all"
                  />
                  <button 
                    type="submit"
                    disabled={!newHabitTitle.trim()}
                    className="bg-slate-900 dark:bg-slate-700 text-white w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewHabitType('build')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border ${
                      newHabitType === 'build'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Leaf className="w-3.5 h-3.5" /> Build
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewHabitType('break')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border ${
                      newHabitType === 'break'
                        ? 'bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Skull className="w-3.5 h-3.5" /> Break
                  </button>
                </div>
              </form>
            </div>

            {/* Mini Stats Card */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Summary</h3>
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Activity className="w-4 h-4 text-emerald-500" /> Active Habits
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-200">{habits.length}</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Check className="w-4 h-4 text-blue-500" /> Total Checks
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-200">
                      {habits.reduce((acc, h) => acc + Object.keys(h.completedDates || {}).length, 0)}
                    </span>
                 </div>
               </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="space-y-8 overflow-hidden">
            
            {/* Habit Sections */}
            <HabitSection 
              title="Build Habits" 
              type="build" 
              habits={buildHabits} 
              daysArray={daysArray} 
              toggleHabit={toggleHabit} 
              deleteHabit={deleteHabit}
              daysInMonth={daysInMonth}
              isDarkMode={darkMode}
            />

            <HabitSection 
              title="Break Habits" 
              type="break" 
              habits={breakHabits} 
              daysArray={daysArray} 
              toggleHabit={toggleHabit} 
              deleteHabit={deleteHabit}
              daysInMonth={daysInMonth}
              isDarkMode={darkMode}
            />
            
            {habits.length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700">
                <div className="flex flex-col items-center gap-2">
                  <Calendar className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Add a habit using the sidebar to start.</p>
                </div>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2 uppercase tracking-wider">
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f1f5f9'} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} interval={4} />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{
                          borderRadius: '8px', 
                          border: 'none', 
                          backgroundColor: darkMode ? '#1e293b' : '#fff',
                          color: darkMode ? '#fff' : '#000',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
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
    </div>
  );
}
