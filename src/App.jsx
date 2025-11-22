import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  ChevronLeft, ChevronRight, Trash2, Check, X, Activity, 
  TrendingUp, ShieldAlert, Trophy, Calendar, Leaf, Skull, Plus, LogOut, User,
  Moon, Sun, Lock, Smartphone, Target, Zap, CheckCircle
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

// --- Tailwind Configuration Override ---
if (typeof window !== 'undefined') {
  window.tailwind = window.tailwind || {};
  window.tailwind.config = {
    ...window.tailwind.config,
    darkMode: 'class', 
  };
}

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

// FIX: Use Local Time construction to prevent Timezone offsets shifting dates
const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- COLOR PALETTES ---
const POSITIVE_COLORS = [
  '#10b981', // Emerald-500
  '#06b6d4', // Cyan-500
  '#3b82f6', // Blue-500
  '#84cc16', // Lime-500
  '#14b8a6', // Teal-500
  '#6366f1', // Indigo-500
];

const NEGATIVE_COLORS = [
  '#f43f5e', // Rose-500
  '#ef4444', // Red-500
  '#f97316', // Orange-500
  '#d946ef', // Fuchsia-500
  '#e11d48', // Rose-700
  '#db2777', // Pink-600
];

// Daily Progress Colors
const PROGRESS_COLORS = {
  'Done': '#10b981', // Emerald
  'Remaining': '#e2e8f0', // Slate-200 (Light mode default)
  'RemainingDark': '#334155', // Slate-700 (Dark mode default)
};

// Helper to deterministically assign a color based on type and index
const getHabitColor = (habit, allHabits) => {
  if (habit.type === 'build') {
    const buildHabits = allHabits.filter(h => h.type === 'build');
    const index = buildHabits.findIndex(h => h.id === habit.id);
    return POSITIVE_COLORS[index % POSITIVE_COLORS.length];
  } else {
    const breakHabits = allHabits.filter(h => h.type === 'break');
    const index = breakHabits.findIndex(h => h.id === habit.id);
    return NEGATIVE_COLORS[index % NEGATIVE_COLORS.length];
  }
};

// --- Custom Tooltip for Area Chart ---
const CustomAreaTooltip = ({ active, payload, label, darkMode }) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-3 rounded-lg shadow-lg border text-xs ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-200 text-slate-700'}`}>
        <p className="font-bold mb-2 border-b pb-1 border-dashed border-gray-500/30">Day {label}</p>
        <ul className="space-y-1">
          {payload.map((entry, idx) => (
            <li key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                 <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                 <span className="font-medium">{entry.name}</span>
              </span>
              <span className="font-mono font-bold">{entry.value}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
};

// --- Sub-Component: Habit Table Section ---
const HabitSection = ({ title, type, habits, daysArray, toggleHabit, deleteHabit, daysInMonth, isDarkMode }) => {
  if (habits.length === 0) return null;

  // --- Auto-Scroll Logic ---
  useEffect(() => {
    const timer = setTimeout(() => {
      const todayElement = document.getElementById(`today-column-${type}`);
      if (todayElement) {
        todayElement.scrollIntoView({ 
          behavior: 'smooth', 
          inline: 'center', 
          block: 'nearest' 
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [daysArray, type]); 

  const dailyTotals = daysArray.map(d => {
    const completedCount = habits.filter(h => h.completedDates?.[d.dateKey]).length;
    const totalActive = habits.length;
    return totalActive > 0 ? Math.round((completedCount / totalActive) * 100) : 0;
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mb-8 transition-colors">
      <div className={`p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between ${
        type === 'build' ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : 'bg-rose-50/50 dark:bg-rose-900/20'
      }`}>
        <div className="flex items-center gap-2">
          {type === 'build' ? <Leaf className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <Skull className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          <h3 className={`font-bold text-sm uppercase tracking-widest ${
            type === 'build' ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
          }`}>
            {title}
          </h3>
        </div>
      </div>
      
      {/* Scrollable Container */}
      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
              <th className="p-4 text-left font-semibold text-slate-700 dark:text-slate-300 min-w-[200px] sticky left-0 bg-gray-50 dark:bg-slate-900 z-20 border-r border-gray-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                Habit
              </th>
              {daysArray.map((d) => (
                <th 
                  key={d.day} 
                  id={d.isToday ? `today-column-${type}` : undefined}
                  className={`p-1 text-center min-w-[36px] border-r border-dashed border-gray-200 dark:border-slate-700 last:border-none ${d.isWeekend ? 'bg-gray-50/50 dark:bg-slate-800/50' : ''}`}
                >
                  <div className={`text-[10px] mb-1 font-medium uppercase ${d.isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`}>
                    {d.weekday[0]}
                  </div>
                  <div className={`text-sm font-bold ${d.isToday ? 'bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-full mx-auto shadow-sm' : 'text-slate-700 dark:text-slate-300'}`}>
                    {d.day}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => {
              const completedCount = Object.keys(habit.completedDates || {}).length;
              const habitGoal = habit.goal || daysInMonth;
              const progressPercent = Math.min(100, Math.round((completedCount / habitGoal) * 100));

              return (
                <tr key={habit.id} className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                  <td className="p-3 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-gray-50 dark:group-hover:bg-slate-700/30 transition-colors z-20 border-r border-gray-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="text-lg flex-shrink-0">{habit.icon}</span>
                          <div className="truncate max-w-[120px]">
                            <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate" title={habit.title}>{habit.title}</div>
                          </div>
                        </div>
                        <button onClick={() => deleteHabit(habit.id)} className="text-gray-300 hover:text-rose-500 transition-all p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="mt-1">
                         <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-1">
                            <span>{completedCount} / {habitGoal}</span>
                            <span>{progressPercent}%</span>
                         </div>
                         <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                           <div className={`h-full rounded-full transition-all duration-500 ${habit.type === 'build' ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${progressPercent}%` }} />
                         </div>
                      </div>
                    </div>
                  </td>
                  {daysArray.map((d) => {
                    const isCompleted = habit.completedDates?.[d.dateKey];
                    const colorClass = habit.type === 'build' ? 'bg-emerald-500' : 'bg-rose-500';
                    const bgClass = habit.type === 'build' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/30';
                    const todayKey = formatDateKey(new Date());
                    const isPast = d.dateKey < todayKey;
                    return (
                      <td key={d.day} className={`p-1 text-center border-r border-dashed border-gray-200 dark:border-slate-700 select-none transition-colors relative align-middle ${d.isWeekend ? 'bg-gray-50/30 dark:bg-slate-800/30' : ''} ${isCompleted ? `${bgClass}/50` : (isPast ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer')}`} onClick={() => !isPast && toggleHabit(habit.id, d.dateKey)}>
                        <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center transition-all duration-200 ${isCompleted ? `${colorClass} text-white shadow-sm scale-100` : 'bg-gray-100 dark:bg-slate-700 text-transparent scale-75 hover:scale-90'}`}>
                          <Check className="w-3.5 h-3.5" strokeWidth={4} />
                        </div>
                        {isPast && !isCompleted && (<div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-20"><Lock className="w-3 h-3 text-slate-400" /></div>)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
             <tr className="bg-slate-50 dark:bg-slate-900/80 font-bold text-xs text-slate-500 dark:text-slate-400 border-t-2 border-gray-200 dark:border-slate-700">
                <td className="p-3 sticky left-0 bg-slate-50 dark:bg-slate-900/80 z-20 border-r border-gray-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] uppercase tracking-wider">Daily Progress</td>
                {dailyTotals.map((total, idx) => (<td key={idx} className="p-1 text-center border-r border-dashed border-gray-200 dark:border-slate-700"><span className={`${total === 100 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{total}%</span></td>))}
             </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default function HabitTracker() {
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [authLoading, setAuthLoading] = useState(true);
  
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitType, setNewHabitType] = useState('build');
  const [newHabitGoal, setNewHabitGoal] = useState(20); 

  useEffect(() => {
    const initAuth = async () => {
      try { await getRedirectResult(auth); } catch (error) { console.error(error); }
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch (e) { console.error(e); }
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
    if (!user) { setHabits([]); setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedHabits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedHabits.sort((a, b) => a.createdAt - b.createdAt);
      setHabits(fetchedHabits);
      setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });
    return () => unsubscribe();
  }, [user]);

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch { try { await signInWithRedirect(auth, new GoogleAuthProvider()); } catch { alert("Login failed."); } }
  };

  const handleGuestLogin = async () => {
    try { await signInAnonymously(auth); } catch { alert("Guest login failed."); }
  };

  const handleLogout = async () => { try { await signOut(auth); setHabits([]); } catch (error) { console.error(error); } };

  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitTitle.trim() || !user) return;
    const icon = newHabitType === 'build' ? '🌱' : '💀';
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'), {
        title: newHabitTitle, 
        type: newHabitType, 
        icon: icon, 
        goal: parseInt(newHabitGoal) || 20,
        createdAt: Date.now(), 
        completedDates: {} 
      });
      setNewHabitTitle('');
      setNewHabitGoal(20);
    } catch (error) { console.error(error); }
  };

  const toggleHabit = async (habitId, dateKey) => {
    if (!user) return;
    if (dateKey < formatDateKey(new Date())) return;
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const newCompletedDates = { ...habit.completedDates };
    if (newCompletedDates[dateKey]) delete newCompletedDates[dateKey];
    else newCompletedDates[dateKey] = true;
    try { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habitId), { completedDates: newCompletedDates }); } catch (error) { console.error(error); }
  };

  const deleteHabit = async (habitId) => {
    if (!user || !window.confirm('Are you sure?')) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habitId)); } catch (error) { console.error(error); }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return {
        day: i + 1, dateKey: formatDateKey(d), weekday: d.toLocaleString('default', { weekday: 'narrow' }),
        isWeekend: d.getDay() === 0 || d.getDay() === 6, isToday: formatDateKey(d) === formatDateKey(new Date())
      };
    });
  }, [year, month, daysInMonth]);

  // --- Statistics Calculations ---
  const stats = useMemo(() => {
    if (habits.length === 0) return null;

    // 1. Goal Analysis Data
    const goalData = habits.map((h) => ({
      name: h.title,
      actual: Object.keys(h.completedDates || {}).length,
      goal: h.goal || daysInMonth,
      type: h.type,
      id: h.id 
    }));

    // 2. Cumulative Trend Data
    const runningCounts = {};
    habits.forEach(h => { runningCounts[h.id] = 0; });

    const cumulativeData = daysArray.map(day => {
      const dataPoint = { day: day.day };
      habits.forEach(h => {
        if (h.completedDates?.[day.dateKey]) {
          runningCounts[h.id] += 1;
        }
        dataPoint[h.title] = runningCounts[h.id]; 
        dataPoint[h.id] = runningCounts[h.id];
      });
      return dataPoint;
    });

    // 3. Weekday Consistency (Radar Chart Data) - FIXED LOGIC
    const weekdayCounts = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };
    const weekdayOpportunities = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };
    const todayKey = formatDateKey(new Date());

    daysArray.forEach(d => {
      const dateObj = new Date(year, month, d.day);
      const shortDay = dateObj.toLocaleString('en-US', { weekday: 'short' });

      if (d.dateKey <= todayKey) {
        if (weekdayOpportunities[shortDay] !== undefined) {
           weekdayOpportunities[shortDay]++;
           habits.forEach(h => {
             if (h.completedDates?.[d.dateKey]) {
               weekdayCounts[shortDay]++;
             }
           });
        }
      }
    });

    const radarData = Object.keys(weekdayCounts).map(day => {
       const totalPossible = weekdayOpportunities[day] * habits.length;
       const actual = weekdayCounts[day];
       const percent = totalPossible > 0 ? Math.round((actual / totalPossible) * 100) : 0;
       return { subject: day, A: percent, fullMark: 100 };
    });

    // 4. Daily Progress (Pie Chart) - REPLACES HABIT HEALTH
    const todayDateKey = formatDateKey(new Date());
    const totalHabits = habits.length;
    const completedToday = habits.filter(h => h.completedDates?.[todayDateKey]).length;
    const remainingToday = totalHabits - completedToday;

    const dailyProgressData = [
      { name: 'Done', value: completedToday },
      { name: 'Remaining', value: remainingToday }
    ];

    return { cumulativeData, goalData, radarData, dailyProgressData, completedToday, totalHabits };
  }, [habits, daysArray, daysInMonth, year, month]);

  const buildHabits = habits.filter(h => h.type === 'build');
  const breakHabits = habits.filter(h => h.type === 'break');

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-slate-400 animate-pulse">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-lg text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3">
            <Leaf className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">FocusLab</h1>
          <p className="text-slate-500 mb-8">Build better habits.</p>
          <div className="space-y-3">
            <button onClick={handleGoogleLogin} className="w-full bg-white text-slate-700 border py-3.5 rounded-xl font-bold hover:bg-gray-50 flex items-center justify-center gap-3">Sign in with Google</button>
            <button onClick={handleGuestLogin} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 flex items-center justify-center gap-3">Guest Mode</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-3 md:p-8 overflow-x-hidden transition-colors duration-300">
        
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white dark:bg-slate-800 border-2 border-emerald-500 p-0.5 shadow-sm overflow-hidden shrink-0">
                {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" /> : <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400"><User className="w-6 h-6" /></div>}
             </div>
             <div>
               <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{monthName}</h1>
               <p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">{year}</p>
             </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 self-end md:self-auto">
            <button onClick={() => setDarkMode(!darkMode)} className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-2.5 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-xs font-bold min-w-[80px] text-center uppercase">{monthName.substring(0,3)}</span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <button onClick={handleLogout} className="bg-white dark:bg-slate-800 text-rose-500 p-2.5 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          
          {/* Sidebar */}
          <div className="space-y-4 sticky top-4 z-30">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">New Habit</h3>
              <form onSubmit={handleAddHabit} className="space-y-3">
                <div className="space-y-2">
                  <input type="text" placeholder="Habit Name..." value={newHabitTitle} onChange={(e) => setNewHabitTitle(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500" />
                  <div className="flex gap-2">
                    <div className="relative w-20 shrink-0">
                        <input type="number" min="1" max="31" value={newHabitGoal} onChange={(e) => setNewHabitGoal(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg pl-2 pr-1 py-2 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500" />
                        <span className="absolute right-2 top-2.5 text-[10px] text-gray-400 pointer-events-none">/mo</span>
                    </div>
                    <div className="flex-1 flex gap-1">
                       <button type="button" onClick={() => setNewHabitType('build')} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${newHabitType === 'build' ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 dark:text-slate-400'}`}><Leaf className="w-3 h-3" /></button>
                       <button type="button" onClick={() => setNewHabitType('break')} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${newHabitType === 'break' ? 'bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 dark:text-slate-400'}`}><Skull className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <button type="submit" disabled={!newHabitTitle.trim()} className="w-full bg-slate-900 dark:bg-slate-700 text-white py-2.5 rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-50 text-sm font-bold gap-2"><Plus className="w-4 h-4" /> Add Habit</button>
                </div>
              </form>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex justify-between items-center">
               <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Activity className="w-4 h-4 text-emerald-500" /> Active</div>
               <span className="font-bold text-slate-900 dark:text-slate-200">{habits.length}</span>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 min-w-0">
            <HabitSection title="Build Habits" type="build" habits={buildHabits} daysArray={daysArray} toggleHabit={toggleHabit} deleteHabit={deleteHabit} daysInMonth={daysInMonth} isDarkMode={darkMode} />
            <HabitSection title="Break Habits" type="break" habits={breakHabits} daysArray={daysArray} toggleHabit={toggleHabit} deleteHabit={deleteHabit} daysInMonth={daysInMonth} isDarkMode={darkMode} />
            
            {habits.length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700">
                <div className="flex flex-col items-center gap-2"><Smartphone className="w-10 h-10 opacity-20" /><p className="text-sm">Add a habit to start tracking.</p></div>
              </div>
            )}

            {/* ROW 1: Trends & Goals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Habit Trends Chart (Cumulative Area) */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Habit Trends (Cumulative)</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.cumulativeData || []}>
                      <defs>
                        {habits.map((habit, idx) => {
                          const color = getHabitColor(habit, habits);
                          return (
                            <linearGradient key={habit.id} id={`gradient-${habit.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                              <stop offset="95%" stopColor={color} stopOpacity={0}/>
                            </linearGradient>
                          );
                        })}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f1f5f9'} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} interval={4} />
                      <YAxis hide domain={[0, 'auto']} />
                      <Tooltip content={<CustomAreaTooltip darkMode={darkMode} />} cursor={{stroke: '#cbd5e1', strokeWidth: 2}} />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                      {habits.map((habit, index) => (
                        <Area 
                          key={habit.id}
                          type="monotone" 
                          dataKey={habit.title}
                          name={habit.title}
                          stroke={getHabitColor(habit, habits)} 
                          fill={`url(#gradient-${habit.id})`}
                          strokeWidth={2} 
                          fillOpacity={1}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Goal Analysis Table */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Target className="w-4 h-4" /> Goal Analysis</h3>
                <div className="flex-1 overflow-auto scrollbar-hide">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold border-b border-gray-100 dark:border-slate-700">
                           <th className="pb-2 pl-1 font-bold tracking-wider">Habit</th>
                           <th className="pb-2 text-center w-12 tracking-wider">Goal</th>
                           <th className="pb-2 text-center w-12 tracking-wider">Actual</th>
                           <th className="pb-2 pl-4 tracking-wider">Progress</th>
                        </tr>
                     </thead>
                     <tbody className="text-sm">
                        {stats?.goalData.map((entry) => {
                            const originalHabit = habits.find(h => h.id === entry.id) || {type: entry.type, id: entry.id};
                            const color = getHabitColor(originalHabit, habits);
                            const percent = Math.min(100, Math.round((entry.actual / entry.goal) * 100));
                            
                            return (
                              <tr key={entry.id} className="border-b border-gray-50 dark:border-slate-700/50 last:border-none hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                 <td className="py-3 pl-1 font-medium text-slate-700 dark:text-slate-200 truncate max-w-[100px]">{entry.name}</td>
                                 <td className="py-3 text-center text-slate-500 dark:text-slate-400 font-mono text-xs">{entry.goal}</td>
                                 <td className="py-3 text-center font-bold text-slate-800 dark:text-slate-100 font-mono text-xs">{entry.actual}</td>
                                 <td className="py-3 pl-4 align-middle">
                                    <div className="h-2.5 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                       <div 
                                          className="h-full rounded-full transition-all duration-700 ease-out"
                                          style={{ width: `${percent}%`, backgroundColor: color }}
                                       />
                                    </div>
                                 </td>
                              </tr>
                            );
                        })}
                     </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ROW 2: Weekday Consistency & Daily Progress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Weekday Consistency Radar (FIXED) */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap className="w-4 h-4" /> Weekday Consistency</h3>
                 <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                       <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats?.radarData || []}>
                          <PolarGrid stroke={darkMode ? '#334155' : '#e2e8f0'} />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: darkMode ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar
                            name="Consistency"
                            dataKey="A"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="#10b981"
                            fillOpacity={0.3}
                          />
                          <Tooltip 
                            contentStyle={{borderRadius: '8px', border: 'none', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#000', fontSize: '12px'}}
                            formatter={(value) => [`${value}%`, 'Consistency']}
                          />
                       </RadarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Daily Progress Pie Chart (NEW) */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Today's Focus</h3>
                 <div className="h-64 w-full flex items-center justify-center relative">
                   {stats?.totalHabits > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                              data={stats.dailyProgressData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              startAngle={90}
                              endAngle={-270}
                            >
                              {stats.dailyProgressData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.name === 'Done' ? PROGRESS_COLORS.Done : (darkMode ? PROGRESS_COLORS.RemainingDark : PROGRESS_COLORS.Remaining)} 
                                  strokeWidth={0} 
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{borderRadius: '8px', border: 'none', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#000', fontSize: '12px'}}
                            />
                         </PieChart>
                      </ResponsiveContainer>
                      {/* Center Label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                         <span className="text-3xl font-bold text-slate-900 dark:text-white">
                           {Math.round((stats.completedToday / stats.totalHabits) * 100)}%
                         </span>
                         <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Done</span>
                      </div>
                    </>
                   ) : (
                     <div className="text-slate-400 text-sm">No habits to track today</div>
                   )}
                 </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
