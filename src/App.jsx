import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  ChevronLeft, ChevronRight, Trash2, Check, X, Activity, 
  TrendingUp, ShieldAlert, Trophy, Calendar, Leaf, Skull, Plus, LogOut, User,
  Moon, Sun, Lock, Smartphone, Target, Zap, CheckCircle, LayoutGrid, MoreHorizontal,
  Pencil, Save, Filter
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

// UNCOMMENT THE LINE BELOW FOR VERCEL ANALYTICS
// import { Analytics } from "@vercel/analytics/react";

// --- Tailwind Configuration Override ---
if (typeof window !== 'undefined') {
  window.tailwind = window.tailwind || {};
  window.tailwind.config = {
    ...window.tailwind.config,
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          border: "hsl(var(--border))",
          input: "hsl(var(--input))",
          ring: "hsl(var(--ring))",
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          primary: {
            DEFAULT: "hsl(var(--primary))",
            foreground: "hsl(var(--primary-foreground))",
          },
          secondary: {
            DEFAULT: "hsl(var(--secondary))",
            foreground: "hsl(var(--secondary-foreground))",
          },
          destructive: {
            DEFAULT: "hsl(var(--destructive))",
            foreground: "hsl(var(--destructive-foreground))",
          },
          muted: {
            DEFAULT: "hsl(var(--muted))",
            foreground: "hsl(var(--muted-foreground))",
          },
          accent: {
            DEFAULT: "hsl(var(--accent))",
            foreground: "hsl(var(--accent-foreground))",
          },
          popover: {
            DEFAULT: "hsl(var(--popover))",
            foreground: "hsl(var(--popover-foreground))",
          },
          card: {
            DEFAULT: "hsl(var(--card))",
            foreground: "hsl(var(--card-foreground))",
          },
        },
      }
    }
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

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- COLOR PALETTES ---
const POSITIVE_COLORS = ['#10b981', '#06b6d4', '#3b82f6', '#84cc16', '#14b8a6', '#6366f1'];
const NEGATIVE_COLORS = ['#f43f5e', '#ef4444', '#f97316', '#d946ef', '#e11d48', '#db2777'];

const PROGRESS_COLORS = {
  'Done': '#18181b', // Zinc-900 for light mode
  'DoneDark': '#f4f4f5', // Zinc-100 for dark mode
  'Remaining': '#e4e4e7', // Zinc-200
  'RemainingDark': '#27272a', // Zinc-800
};

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
      <div className={`px-3 py-2 rounded-md border text-xs shadow-md ${darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-50' : 'bg-white border-zinc-200 text-zinc-900'}`}>
        <p className="font-semibold mb-2 pb-1 border-b border-zinc-200 dark:border-zinc-800">Date: {label}</p>
        <ul className="space-y-1">
          {payload.map((entry, idx) => (
            <li key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                 <span className="text-muted-foreground">{entry.name}</span>
              </span>
              <span className="font-mono font-medium">{entry.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
};

// --- Sub-Component: Habit Table Section ---
const HabitSection = ({ title, type, habits, daysArray, toggleHabit, deleteHabit, updateHabitTitle, daysInMonth, isDarkMode }) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const scrollContainerRef = useRef(null); 

  const startEditing = (habit) => {
    setEditingId(habit.id);
    setEditTitle(habit.title);
  };

  const saveEdit = (habitId) => {
    if (editTitle.trim()) {
      updateHabitTitle(habitId, editTitle);
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  // --- FIX: Ultra-Robust Auto-Scroll ---
  useLayoutEffect(() => {
    const scrollLogic = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const todayColumn = container.querySelector('[data-is-today="true"]');
      
      if (todayColumn) {
        // Calculate center position manually
        const containerWidth = container.clientWidth;
        const columnLeft = todayColumn.offsetLeft;
        const columnWidth = todayColumn.clientWidth;
        
        // Target scroll position
        const targetScroll = columnLeft - (containerWidth / 2) + (columnWidth / 2);
        
        container.scrollTo({
          left: targetScroll,
          behavior: 'auto' // Instant jump, no smooth animation that might get interrupted
        });
      }
    };

    // Run immediately after layout paint
    scrollLogic();
    
    // Also run after a tiny delay in case of images/fonts shifting layout
    const timer = setTimeout(scrollLogic, 100);
    
    return () => clearTimeout(timer);
  }, [daysArray, habits.length]); // Re-run when data changes

  if (habits.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-8">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-4 rounded-full ${type === 'build' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          <h3 className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
          {habits.length} habits
        </span>
      </div>
      
      <div ref={scrollContainerRef} className="overflow-x-auto pb-2 scrollbar-hide relative">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="p-4 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 min-w-[220px] sticky left-0 bg-white dark:bg-zinc-900 z-20 border-r border-zinc-200 dark:border-zinc-800 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                Habit Name
              </th>
              {daysArray.map((d) => (
                <th 
                  key={d.day} 
                  data-is-today={d.isToday ? "true" : "false"}
                  className={`p-1 text-center min-w-[40px] border-r border-dashed border-zinc-100 dark:border-zinc-800/50 last:border-none ${d.isWeekend ? 'bg-zinc-50/50 dark:bg-zinc-900/50' : ''} ${d.isToday ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
                >
                  <div className={`text-[10px] font-medium uppercase mb-1 ${d.isToday ? 'text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {d.weekday[0]}
                  </div>
                  <div className={`text-sm font-medium w-7 h-7 mx-auto flex items-center justify-center rounded-full ${d.isToday ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {d.day}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => {
              const checkedCount = Object.keys(habit.completedDates || {}).length;
              const habitGoal = habit.goal || daysInMonth;
              let actualScore = 0;
              if (habit.type === 'build') {
                actualScore = checkedCount;
              } else {
                actualScore = Math.max(0, habitGoal - checkedCount);
              }
              const progressPercent = Math.min(100, Math.round((actualScore / habitGoal) * 100));

              return (
                <tr key={habit.id} className="border-b border-zinc-100 dark:border-zinc-800/50 group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="p-3 sticky left-0 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50/50 dark:group-hover:bg-zinc-900/50 transition-colors z-20 border-r border-zinc-200 dark:border-zinc-800 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] align-top">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between h-7">
                        {editingId === habit.id ? (
                          <div className="flex items-center gap-1 w-full">
                            <input 
                              type="text" 
                              value={editTitle} 
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="flex-1 min-w-0 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-1 focus:outline-none focus:border-zinc-500"
                              autoFocus
                            />
                            <button onClick={() => saveEdit(habit.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-3 h-3" /></button>
                            <button onClick={cancelEdit} className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[140px]" title={habit.title}>
                              {habit.title}
                            </span>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => startEditing(habit)}
                                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => deleteHabit(habit.id)}
                                className="text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="mt-1">
                         <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mb-1.5">
                            <span>{actualScore} / {habitGoal}</span>
                            <span>{progressPercent}%</span>
                         </div>
                         <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                           <div 
                             className={`h-full rounded-full transition-all duration-500 ${habit.type === 'build' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                             style={{ width: `${progressPercent}%` }}
                           />
                         </div>
                      </div>
                    </div>
                  </td>
                  {daysArray.map((d) => {
                    const isCompleted = habit.completedDates?.[d.dateKey];
                    const todayKey = formatDateKey(new Date());
                    const isFuture = d.dateKey > todayKey;
                    const isPast = d.dateKey < todayKey;
                    
                    let cellContent = null;
                    let cellClass = "";
                    
                    if (habit.type === 'build') {
                       if (isCompleted) {
                         cellClass = "bg-emerald-500 border-emerald-500 text-white shadow-sm";
                         cellContent = <Check className="w-4 h-4" strokeWidth={3} />;
                       } else {
                         cellClass = "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-transparent hover:border-zinc-300 dark:hover:border-zinc-700";
                         cellContent = <Check className="w-4 h-4" strokeWidth={3} />;
                       }
                    } else {
                       if (isCompleted) {
                         cellClass = "bg-rose-500 border-rose-500 text-white shadow-sm";
                         cellContent = <X className="w-4 h-4" strokeWidth={3} />;
                       } else {
                         cellClass = "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-transparent hover:border-zinc-300 dark:hover:border-zinc-700";
                         cellContent = <X className="w-4 h-4" strokeWidth={3} />;
                       }
                    }

                    return (
                      <td 
                        key={d.day} 
                        className={`p-1 text-center border-r border-dashed border-zinc-100 dark:border-zinc-800/50 relative align-middle 
                          ${d.isWeekend ? 'bg-zinc-50/30 dark:bg-zinc-900/30' : ''} 
                          ${isFuture ? 'opacity-30 pointer-events-none' : ''}
                        `}
                        onClick={() => !isFuture && toggleHabit(habit.id, d.dateKey)}
                      >
                        <div className={`
                          w-8 h-8 mx-auto rounded-md border flex items-center justify-center transition-all duration-200 cursor-pointer
                          ${cellClass}
                        `}>
                          {cellContent}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
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
  
  // State for Analytics Filtering - DEFAULTS TO BUILD
  const [analyticsFilter, setAnalyticsFilter] = useState('build'); 
  
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitType, setNewHabitType] = useState('build');
  const [newHabitGoal, setNewHabitGoal] = useState(31); 

  // --- AUTO UPDATE GOAL BASED ON TYPE ---
  useEffect(() => {
    if (newHabitType === 'build') {
      setNewHabitGoal(31);
    } else {
      setNewHabitGoal(4);
    }
  }, [newHabitType]);

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
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'), {
        title: newHabitTitle, 
        type: newHabitType, 
        goal: parseInt(newHabitGoal),
        createdAt: Date.now(), 
        completedDates: {} 
      });
      setNewHabitTitle('');
      // Reset goal based on current type to be safe
      setNewHabitGoal(newHabitType === 'build' ? 31 : 4);
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

  const updateHabitTitle = async (habitId, newTitle) => {
    if (!user || !newTitle.trim()) return;
    try { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habitId), { title: newTitle }); } catch (error) { console.error(error); }
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

    // FILTER LOGIC
    const filteredHabits = habits.filter(h => {
      if (analyticsFilter === 'all') return true;
      return h.type === analyticsFilter;
    });

    // 1. Goal Analysis Data
    const goalData = filteredHabits.map((h) => {
      const checkedCount = Object.keys(h.completedDates || {}).length;
      const goal = h.goal || daysInMonth;
      let actual = 0;
      if (h.type === 'build') {
        actual = checkedCount;
      } else {
        actual = Math.max(0, goal - checkedCount); 
      }
      return {
        name: h.title,
        actual: actual,
        goal: goal,
        type: h.type,
        id: h.id 
      };
    });

    // 2. Cumulative Trend Data
    const runningCounts = {};
    filteredHabits.forEach(h => { runningCounts[h.id] = 0; });
    const todayKey = formatDateKey(new Date());

    const cumulativeData = daysArray.map(day => {
      const displayDate = new Date(year, month, day.day).toLocaleString('default', { month: 'short', day: 'numeric' });
      const dataPoint = { day: displayDate, originalDate: day.dateKey };
      
      if (day.dateKey <= todayKey) {
        filteredHabits.forEach(h => {
          const isChecked = h.completedDates?.[day.dateKey];
          if (h.type === 'build') {
            if (isChecked) runningCounts[h.id] += 1;
          } else {
            if (!isChecked) runningCounts[h.id] += 1;
          }
          
          const percentage = Math.round((runningCounts[h.id] / day.day) * 100);
          dataPoint[h.title] = percentage; 
          dataPoint[h.id] = percentage;
        });
      }
      return dataPoint;
    });

    // 3. Weekday Consistency
    const weekdayCounts = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };
    const weekdayOpportunities = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };

    daysArray.forEach(d => {
      const dateObj = new Date(year, month, d.day);
      const shortDay = dateObj.toLocaleString('en-US', { weekday: 'short' });

      if (d.dateKey <= todayKey) {
        if (weekdayOpportunities[shortDay] !== undefined) {
           weekdayOpportunities[shortDay] += filteredHabits.length;
           
           filteredHabits.forEach(h => {
             const isChecked = h.completedDates?.[d.dateKey];
             if (h.type === 'build') {
               if (isChecked) weekdayCounts[shortDay]++;
             } else {
               if (!isChecked) weekdayCounts[shortDay]++;
             }
           });
        }
      }
    });

    const radarData = Object.keys(weekdayCounts).map(day => {
       const totalPossible = weekdayOpportunities[day];
       const actual = weekdayCounts[day];
       const percent = totalPossible > 0 ? Math.round((actual / totalPossible) * 100) : 0;
       return { subject: day, A: percent, fullMark: 100 };
    });

    // 4. Daily Progress (Filtered for SUCCESS METRIC)
    let successCount = 0;
    
    // Use analyticsFilter to decide which habits to count for "Today's Success"
    // If 'all' is selected, we DEFAULT to BUILD habits only to prevent inflation
    // If specific filter is selected (e.g. 'break'), we show that specific success
    const successHabits = analyticsFilter === 'all' 
      ? habits.filter(h => h.type === 'build') 
      : filteredHabits;
    
    successHabits.forEach(h => {
      const isChecked = h.completedDates?.[todayKey];
      if (h.type === 'build') {
        if (isChecked) successCount++;
      } else {
        if (!isChecked) successCount++;
      }
    });
    
    const totalForSuccess = successHabits.length;
    const remainingCount = Math.max(0, totalForSuccess - successCount);

    const dailyProgressData = [
      { name: 'Done', value: successCount },
      { name: 'Remaining', value: remainingCount }
    ];

    return { 
      cumulativeData, 
      goalData, 
      radarData, 
      dailyProgressData, 
      completedToday: successCount, 
      totalHabits: totalForSuccess, 
      filteredHabits 
    };
  }, [habits, daysArray, daysInMonth, year, month, analyticsFilter]);

  const buildHabits = habits.filter(h => h.type === 'build');
  const breakHabits = habits.filter(h => h.type === 'break');

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-400 animate-pulse">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-md p-8 rounded-xl shadow-sm border border-zinc-200 text-center">
          <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center mx-auto mb-6">
            <Leaf className="w-6 h-6 text-zinc-900" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2 tracking-tight">FocusLab</h1>
          <p className="text-zinc-500 mb-8 text-sm">Master your routine, one day at a time.</p>
          <div className="space-y-3">
            <button onClick={handleGoogleLogin} className="w-full bg-white text-zinc-900 border border-zinc-200 py-2.5 rounded-md font-medium hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2 text-sm">Sign in with Google</button>
            <button onClick={handleGuestLogin} className="w-full bg-zinc-900 text-white py-2.5 rounded-md font-medium hover:bg-zinc-900/90 transition-colors flex items-center justify-center gap-2 text-sm">Continue as Guest</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      {/* UNCOMMENT BELOW FOR PRODUCTION */}
      {/* <Analytics /> */}
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-4 md:p-8 overflow-x-hidden transition-colors duration-300">
        
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-50 rounded-md flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-zinc-50 dark:text-zinc-900" />
                </div>
                <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-white hidden md:block">FocusLab</span>
             </div>
             <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden md:block"></div>
             <div>
               <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight leading-none">{monthName}</h1>
               <p className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-widest font-medium mt-0.5">{year}</p>
             </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 self-end md:self-auto w-full md:w-auto justify-end">
             <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-md border border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-bold min-w-[60px] text-center uppercase text-zinc-700 dark:text-zinc-300">{monthName.substring(0,3)}</span>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400"><ChevronRight className="w-4 h-4" /></button>
             </div>
             <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block"></div>
             <button onClick={() => setDarkMode(!darkMode)} className="bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 p-2 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">{darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
             <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden border border-zinc-200 dark:border-zinc-700">
                {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400"><User className="w-4 h-4" /></div>}
             </div>
             <button onClick={handleLogout} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-2"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
          {/* Sidebar */}
          <div className="space-y-4 sticky top-4 z-30">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Create Habit</h3>
              <form onSubmit={handleAddHabit} className="space-y-3">
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">Name</label>
                    <input type="text" placeholder="e.g. Read 30 mins" value={newHabitTitle} onChange={(e) => setNewHabitTitle(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">Goal (Days/Mo)</label>
                    <div className="flex gap-2">
                      <div className="relative w-20 shrink-0">
                          <input type="number" min="1" max="31" value={newHabitGoal} onChange={(e) => setNewHabitGoal(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md pl-3 pr-1 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all" />
                      </div>
                      <div className="flex-1 flex gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-md border border-zinc-200 dark:border-zinc-800">
                         <button type="button" onClick={() => setNewHabitType('build')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${newHabitType === 'build' ? 'bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>Build</button>
                         <button type="button" onClick={() => setNewHabitType('break')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${newHabitType === 'break' ? 'bg-white dark:bg-zinc-800 text-rose-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>Break</button>
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={!newHabitTitle.trim()} className="w-full bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 py-2.5 rounded-md flex items-center justify-center hover:bg-zinc-900/90 dark:hover:bg-zinc-100/90 disabled:opacity-50 text-sm font-medium transition-colors mt-2">Create Habit</button>
                </div>
              </form>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex justify-between items-center">
               <div className="flex items-center gap-2.5">
                 <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600">
                   <Activity className="w-4 h-4" />
                 </div>
                 <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Active Habits</span>
               </div>
               <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">{habits.length}</span>
            </div>
            
            {/* New Analytics Filter Control */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
               <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Filter className="w-3 h-3" /> Analytics View</h3>
               <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-md border border-zinc-200 dark:border-zinc-800">
                  <button onClick={() => setAnalyticsFilter('build')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${analyticsFilter === 'build' ? 'bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm' : 'text-zinc-400'}`}>Build</button>
                  <button onClick={() => setAnalyticsFilter('break')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${analyticsFilter === 'break' ? 'bg-white dark:bg-zinc-800 text-rose-600 shadow-sm' : 'text-zinc-400'}`}>Break</button>
                  <button onClick={() => setAnalyticsFilter('all')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${analyticsFilter === 'all' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-400'}`}>All</button>
               </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-8 min-w-0">
            {/* Tables */}
            <div className="space-y-6">
              <HabitSection title="Build Habits" type="build" habits={buildHabits} daysArray={daysArray} toggleHabit={toggleHabit} deleteHabit={deleteHabit} updateHabitTitle={updateHabitTitle} daysInMonth={daysInMonth} isDarkMode={darkMode} />
              <HabitSection title="Break Habits" type="break" habits={breakHabits} daysArray={daysArray} toggleHabit={toggleHabit} deleteHabit={deleteHabit} updateHabitTitle={updateHabitTitle} daysInMonth={daysInMonth} isDarkMode={darkMode} />
            </div>
            
            {habits.length === 0 && (
              <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-400">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <h3 className="text-zinc-900 dark:text-zinc-100 font-medium">No habits yet</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">Create your first habit using the form on the left to start tracking your progress.</p>
                </div>
              </div>
            )}

            {/* Analytics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CHART 1: Trends */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-zinc-500" /> Consistency</h3>
                  <span className="text-[10px] font-medium px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">% Over Time</span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.cumulativeData || []}>
                      <defs>
                        {stats?.filteredHabits?.map((habit, idx) => {
                          const color = getHabitColor(habit, habits);
                          return (
                            <linearGradient key={habit.id} id={`gradient-${habit.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={color} stopOpacity={0}/>
                            </linearGradient>
                          );
                        })}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#27272a' : '#f4f4f5'} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fontSize: 10, fill: '#a1a1aa'}} interval={4} />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip content={<CustomAreaTooltip darkMode={darkMode} />} cursor={{stroke: '#a1a1aa', strokeWidth: 1, strokeDasharray: '4 4'}} />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '11px', paddingTop: '16px', color: '#71717a'}} />
                      {stats?.filteredHabits?.map((habit, index) => (
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

              {/* CHART 2: Goal Table */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Target className="w-4 h-4 text-zinc-500" /> Goals</h3>
                  <span className="text-[10px] font-medium px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">Monthly</span>
                </div>
                <div className="flex-1 overflow-auto scrollbar-hide">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="text-[10px] uppercase text-zinc-400 dark:text-zinc-500 font-semibold border-b border-zinc-100 dark:border-zinc-800">
                           <th className="pb-3 pl-1 font-semibold tracking-wider">Habit</th>
                           <th className="pb-3 text-center w-12 tracking-wider">Goal</th>
                           <th className="pb-3 text-center w-12 tracking-wider">Actual</th>
                           <th className="pb-3 pl-4 tracking-wider">Progress</th>
                        </tr>
                     </thead>
                     <tbody className="text-sm">
                        {stats?.goalData.map((entry) => {
                            const originalHabit = habits.find(h => h.id === entry.id) || {type: entry.type, id: entry.id};
                            const color = getHabitColor(originalHabit, habits);
                            const percent = Math.min(100, Math.round((entry.actual / entry.goal) * 100));
                            
                            return (
                              <tr key={entry.id} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-none hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                 <td className="py-3 pl-1 font-medium text-zinc-700 dark:text-zinc-200 truncate max-w-[100px]">{entry.name}</td>
                                 <td className="py-3 text-center text-zinc-500 dark:text-zinc-400 font-mono text-xs">{entry.goal}</td>
                                 <td className="py-3 text-center font-semibold text-zinc-900 dark:text-zinc-100 font-mono text-xs">{entry.actual}</td>
                                 <td className="py-3 pl-4 align-middle">
                                    <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
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

              {/* CHART 3: Radar */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Zap className="w-4 h-4 text-zinc-500" /> Consistency</h3>
                    <span className="text-[10px] font-medium px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">By Weekday</span>
                 </div>
                 <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                       <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats?.radarData || []}>
                          <PolarGrid stroke={darkMode ? '#27272a' : '#e4e4e7'} />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: darkMode ? '#71717a' : '#a1a1aa', fontSize: 11, fontWeight: 500 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar
                            name="Consistency"
                            dataKey="A"
                            stroke={analyticsFilter === 'break' ? '#f43f5e' : '#10b981'}
                            strokeWidth={2}
                            fill={analyticsFilter === 'break' ? '#f43f5e' : '#10b981'}
                            fillOpacity={0.2}
                          />
                          <Tooltip 
                            contentStyle={{borderRadius: '6px', border: 'none', backgroundColor: darkMode ? '#09090b' : '#fff', color: darkMode ? '#fff' : '#000', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            formatter={(value) => [`${value}%`, 'Consistency']}
                          />
                       </RadarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* CHART 4: Daily Pie */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-zinc-500" /> Daily Focus</h3>
                    <span className="text-[10px] font-medium px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">Today ({analyticsFilter === 'break' ? 'Break' : 'Build'})</span>
                 </div>
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
                              paddingAngle={4}
                              dataKey="value"
                              startAngle={90}
                              endAngle={-270}
                              cornerRadius={4}
                            >
                              {stats.dailyProgressData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.name === 'Done' ? (analyticsFilter === 'break' ? '#f43f5e' : '#10b981') : (darkMode ? '#27272a' : '#e4e4e7')} 
                                  strokeWidth={0} 
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{borderRadius: '6px', border: 'none', backgroundColor: darkMode ? '#09090b' : '#fff', color: darkMode ? '#fff' : '#000', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            />
                         </PieChart>
                      </ResponsiveContainer>
                      {/* Center Label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                         <span className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tighter">
                           {Math.round((stats.completedToday / stats.totalHabits) * 100)}%
                         </span>
                         <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mt-1 font-medium">Success</span>
                      </div>
                    </>
                   ) : (
                     <div className="text-zinc-400 text-sm">No habits to track today</div>
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
