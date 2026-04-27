/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addYears,
  subYears,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  isSameDay,
  isSameWeek,
  isSameYear,
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isToday,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isBefore,
  isWithinInterval,
  startOfDay
} from 'date-fns';
import { 
  Calendar,
  Layers,
  LayoutGrid,
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  Download,
  Sun,
  Moon,
  X,
  LogIn,
  LogOut,
  Loader2,
  Maximize2,
  Minimize2,
  Settings,
  Bell,
  User
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ComposedChart, Line, Bar, Tooltip, ResponsiveContainer, ReferenceLine, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import Holidays from 'date-holidays';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  query,
  where,
  onSnapshot
} from './lib/firebase';

import ACCENT_PALETTES from './colors.json';

const hd = new Holidays('GH');

const ACCENT_COLORS = [
  { name: 'Indigo', id: 'indigo', hex: '#6366f1' },
  { name: 'Blue', id: 'blue', hex: '#3b82f6' },
  { name: 'Teal', id: 'teal', hex: '#14b8a6' },
  { name: 'Emerald', id: 'emerald', hex: '#10b981' },
  { name: 'Green', id: 'green', hex: '#22c55e' },
  { name: 'Amber', id: 'amber', hex: '#f59e0b' },
  { name: 'Orange', id: 'orange', hex: '#f97316' },
  { name: 'Red', id: 'red', hex: '#ef4444' },
  { name: 'Rose', id: 'rose', hex: '#f43f5e' },
  { name: 'Violet', id: 'violet', hex: '#8b5cf6' },
];

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface DayFare {
  morning: string;
  evening: string;
  crossedOut?: boolean;
}

interface MonthlyFares {
  [dateKey: string]: DayFare;
}

const STORAGE_KEY = 'transport_fares_data';

const CURRENCY_SYMBOLS: Record<string, string> = {
  'GHS': '₵',
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'NGN': '₦',
  'ZAR': 'R'
};

function FareInput({ valueInGhs, rate, onChange, placeholder, typeContext }: { valueInGhs: string, rate: number, onChange: (v: string) => void, placeholder: string, typeContext: 'morning' | 'evening' }) {
  const [localVal, setLocalVal] = useState('');

  useEffect(() => {
    if (valueInGhs) {
      const converted = (parseFloat(valueInGhs) * rate);
      const str = converted.toFixed(2).replace(/\.?0+$/, '');
      if (parseFloat(localVal || '0') !== converted) {
        setLocalVal(str);
      }
    } else {
      setLocalVal('');
    }
  }, [valueInGhs, rate]);

  return (
    <div className="relative group">
      <div className={cn(
        "absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors",
        valueInGhs ? "text-current opacity-70" : "text-slate-400 dark:text-slate-500"
      )}>
        {typeContext === 'morning' ? <Sun size={12} /> : <Moon size={12} />}
      </div>
      <input
        type="number"
        step="any"
        placeholder={placeholder}
        value={localVal}
        onChange={(e) => {
          setLocalVal(e.target.value);
          const num = parseFloat(e.target.value);
          if (!isNaN(num)) {
            onChange((num / rate).toString());
          } else if (e.target.value === '') {
            onChange('');
          }
        }}
        className={cn(
          "w-full pl-7 pr-2 py-1 sm:py-1.5 text-xs font-medium rounded outline-none transition-all placeholder:text-center sm:placeholder:text-left",
          valueInGhs
            ? typeContext === 'morning'
              ? "bg-secondary-50 dark:bg-secondary-900/40 text-secondary-700 dark:text-secondary-300 placeholder:text-secondary-300 dark:placeholder:text-secondary-500 shadow-inner"
              : "bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 placeholder:text-primary-300 dark:placeholder:text-primary-500 shadow-inner"
            : typeContext === 'morning'
              ? "bg-transparent border border-dashed border-slate-300/60 dark:border-slate-600 text-slate-600 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 group-hover:border-slate-400 dark:group-hover:border-slate-500 focus:border-secondary-400 focus:bg-secondary-50 dark:focus:bg-secondary-900/20 focus:text-secondary-700 dark:focus:text-secondary-300"
              : "bg-transparent border border-dashed border-slate-300/60 dark:border-slate-600 text-slate-600 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 group-hover:border-slate-400 dark:group-hover:border-slate-500 focus:border-primary-400 focus:bg-primary-50 dark:focus:bg-primary-900/20 focus:text-primary-700 dark:focus:text-primary-300"
        )}
      />
    </div>
  );
}

const CustomTooltip = ({ active, payload, currentSymbol, currentDate }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), parseInt(data.date));
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl p-3 z-50">
        <p className="font-bold text-slate-800 dark:text-slate-200 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
          {format(dateObj, 'MMM do')}
        </p>
        <div className="flex justify-between gap-4 text-sm mb-1">
          <span className="text-secondary-500 font-medium">Morning</span>
          <span className="font-bold text-secondary-700 dark:text-secondary-300">{currentSymbol}{(data.morningParsed || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4 text-sm mb-1">
          <span className="text-primary-500 font-medium">Evening</span>
          <span className="font-bold text-primary-700 dark:text-primary-300">{currentSymbol}{(data.eveningParsed || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4 text-sm mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="font-bold text-slate-500 dark:text-slate-400">Total</span>
          <span className="font-black text-slate-900 dark:text-white">{currentSymbol}{(data.total || 0).toFixed(2)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Authentication State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [fares, setFares] = useState<MonthlyFares>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'GHS');
  const [rates, setRates] = useState<Record<string, number>>({'GHS': 1});

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/GHS')
      .then(res => res.json())
      .then(data => {
        if(data && data.rates) {
          setRates(data.rates);
        }
      })
      .catch(err => console.error("Failed to fetch rates", err));
  }, []);

  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  const currentRate = rates[currency] || 1;
  const currentSymbol = CURRENCY_SYMBOLS[currency] || currency;

  const [isCompactMode, setIsCompactMode] = useState(false);
  const [view, setView] = useState<'day' | 'week' | 'month' | 'year'>('month');

  // Auto-detect screen size for default view
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setView(isMobile ? 'day' : 'month');
  }, []);

  const [remindersEnabled, setRemindersEnabled] = useState(() => localStorage.getItem('remindersEnabled') === 'true');
  const [morningReminderTime, setMorningReminderTime] = useState(() => localStorage.getItem('morningReminderTime') || '08:00');
  const [eveningReminderTime, setEveningReminderTime] = useState(() => localStorage.getItem('eveningReminderTime') || '18:00');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || 'indigo');
  const [recurringMorning, setRecurringMorning] = useState(() => localStorage.getItem('recurringMorning') || '');
  const [recurringEvening, setRecurringEvening] = useState(() => localStorage.getItem('recurringEvening') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'appearance' | 'reminders' | 'recurring' | 'account'>('appearance');

  const getHolidayInfo = useCallback((day: Date) => {
    const pubHoliday = hd.isHoliday(day);
    if (pubHoliday !== false && pubHoliday.length > 0) {
      return { isHoliday: true, name: pubHoliday[0].name };
    }
    
    return { isHoliday: false, name: '' };
  }, []);

  const getIsCrossedOut = useCallback((day: Date, dayFare: DayFare | undefined) => {
    if (dayFare && dayFare.crossedOut !== undefined) {
      return dayFare.crossedOut;
    }
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const pubHolidayInfo = getHolidayInfo(day);
    const hasEnteredFare = dayFare ? (parseFloat(dayFare.morning) > 0 || parseFloat(dayFare.evening) > 0) : false;
    return (isWeekend || pubHolidayInfo.isHoliday) && !hasEnteredFare;
  }, [getHolidayInfo]);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync from Firestore when logged in
  useEffect(() => {
    if (!user) return;
    
    // Listen to user preferences (currency)
    const prefsPath = `users/${user.uid}/settings`;
    const unsubPrefs = onSnapshot(doc(db, prefsPath, 'preferences'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.currency) setCurrency(data.currency);
        if (data.remindersEnabled !== undefined) setRemindersEnabled(data.remindersEnabled);
        if (data.morningReminderTime) setMorningReminderTime(data.morningReminderTime);
        if (data.eveningReminderTime) setEveningReminderTime(data.eveningReminderTime);
        if (data.accentColor) setAccentColor(data.accentColor);
        if (data.recurringMorning !== undefined) setRecurringMorning(data.recurringMorning);
        if (data.recurringEvening !== undefined) setRecurringEvening(data.recurringEvening);
      }
    }, (err) => {
      if (err.message.includes('permission')) {
        handleFirestoreError(err, OperationType.GET, prefsPath);
      }
    });

    // Listen to all user fares
    const faresPath = `users/${user.uid}/fares`;
    const unsubFares = onSnapshot(query(collection(db, faresPath), where('userId', '==', user.uid)), (snapshot) => {
      const data: MonthlyFares = {};
      snapshot.forEach(doc => {
        data[doc.id] = doc.data() as DayFare;
      });
      setFares(prev => {
        // Merge cloud with local to not overwrite completely immediately, or just take cloud
        // For simplicity, let's take cloud state as source of truth for all synced days
        return { ...prev, ...data };
      });
    }, (err) => {
      if (err.message.includes('permission')) {
        handleFirestoreError(err, OperationType.LIST, faresPath);
      }
    });

    return () => {
      unsubPrefs();
      unsubFares();
    };
  }, [user]);

  // Handle Login/Logout
  const syncLocalDataToCloud = async (uid: string, localFares: MonthlyFares) => {
    const fareDocPath = `users/${uid}/fares`;
    const promises = Object.entries(localFares).map(([dateKey, fare]) => {
      return setDoc(doc(db, fareDocPath, dateKey), {
        ...fare,
        userId: uid,
        updatedAt: serverTimestamp()
      });
    });
    try {
      await Promise.all(promises);
      console.log("Successfully synced local data to cloud");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, fareDocPath);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // No longer automatically syncing local data to cloud on login
      // Local data will be merged with cloud data via the onSnapshot listener
    } catch (err: any) {
      console.error("Login failed", err);
      if (err.code === 'auth/unauthorized-domain') {
        alert("Login failed: This domain is not authorized for Firebase auth. Please add this domain to your Firebase Console -> Authentication -> Settings -> Authorized domains.");
      } else {
        alert("Login failed: " + err.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFares({}); // Clear out on logout or keep local? We might keep local. Let's rely on local storage.
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  // Sync Settings to Firestore and localStorage
  useEffect(() => {
    localStorage.setItem('currency', currency);
    localStorage.setItem('remindersEnabled', String(remindersEnabled));
    localStorage.setItem('morningReminderTime', morningReminderTime);
    localStorage.setItem('eveningReminderTime', eveningReminderTime);
    localStorage.setItem('accentColor', accentColor);
    localStorage.setItem('recurringMorning', recurringMorning);
    localStorage.setItem('recurringEvening', recurringEvening);

    if (user) {
      const prefsPath = `users/${user.uid}/settings`;
      setDoc(doc(db, prefsPath, 'preferences'), {
        userId: user.uid,
        currency,
        remindersEnabled,
        morningReminderTime,
        eveningReminderTime,
        accentColor,
        recurringMorning,
        recurringEvening
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, prefsPath));
    }
  }, [currency, remindersEnabled, morningReminderTime, eveningReminderTime, accentColor, recurringMorning, recurringEvening, user]);

  // Save to localStorage whenever fares change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fares));
  }, [fares]);

  // Auto-populate recurring fares (current week only) & mark past empty days as "no work"
  useEffect(() => {
    let updated = false;
    const newFares = { ...fares };
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ 
      start: view === 'year' ? startOfYear(currentDate) : (view === 'month' ? startOfMonth(currentDate) : startOfWeek(currentDate, { weekStartsOn: 1 })), 
      end: view === 'year' ? endOfYear(currentDate) : (view === 'month' ? endOfMonth(currentDate) : endOfWeek(currentDate, { weekStartsOn: 1 }))
    });

    days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const holidayInfo = getHolidayInfo(day);
      const isPast = isBefore(day, today);
      
      if (!newFares[dateKey]) {
        if (isPast) {
          // Rule 1: Set previous dates with no values to "no work"
          newFares[dateKey] = {
            morning: '0',
            evening: '0',
            crossedOut: true
          };
          updated = true;
        } else if ((recurringMorning || recurringEvening) && isWithinInterval(day, { start: weekStart, end: weekEnd })) {
          // Rule 2: Recurring cost only for work days in the CURRENT week
          if (!isWeekend && !holidayInfo.isHoliday) {
            newFares[dateKey] = {
              morning: recurringMorning,
              evening: recurringEvening
            };
            updated = true;
          }
        }
      }
    });

    if (updated) {
      setFares(newFares);
    }
  }, [view, currentDate, recurringMorning, recurringEvening, getHolidayInfo, fares]);

  // Handle Notifications
  useEffect(() => {
    if (!remindersEnabled) return;

    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const checkReminders = () => {
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      
      const lastRemindedDate = localStorage.getItem('lastRemindedDate');
      const todayStr = format(now, 'yyyy-MM-dd');
      const lastRemindedTime = localStorage.getItem('lastRemindedTime');

      if (lastRemindedDate === todayStr && lastRemindedTime === currentTimeStr) {
        return; // Already reminded for this minute
      }

      const showNotification = (title: string, body: string) => {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      };

      if (currentTimeStr === morningReminderTime) {
        showNotification("Morning Commute", "Don't forget to log your morning transit fare.");
        localStorage.setItem('lastRemindedDate', todayStr);
        localStorage.setItem('lastRemindedTime', currentTimeStr);
      } else if (currentTimeStr === eveningReminderTime) {
        showNotification("Evening Commute", "Don't forget to log your evening transit fare.");
        localStorage.setItem('lastRemindedDate', todayStr);
        localStorage.setItem('lastRemindedTime', currentTimeStr);
      }
    };

    const interval = setInterval(checkReminders, 20000); // Check every 20 seconds
    checkReminders(); // check immediately

    return () => clearInterval(interval);
  }, [remindersEnabled, morningReminderTime, eveningReminderTime]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const handleNext = () => {
    switch(view) {
      case 'day': setCurrentDate(prev => addDays(prev, 1)); break;
      case 'week': setCurrentDate(prev => addWeeks(prev, 1)); break;
      case 'month': setCurrentDate(prev => addMonths(prev, 1)); break;
      case 'year': setCurrentDate(prev => addYears(prev, 1)); break;
    }
  };

  const handlePrev = () => {
    switch(view) {
      case 'day': setCurrentDate(prev => subDays(prev, 1)); break;
      case 'week': setCurrentDate(prev => subWeeks(prev, 1)); break;
      case 'month': setCurrentDate(prev => subMonths(prev, 1)); break;
      case 'year': setCurrentDate(prev => subYears(prev, 1)); break;
    }
  };

  const handleNextMonth = handleNext;
  const handlePrevMonth = handlePrev;

  const handleFareChange = (date: Date, type: 'morning' | 'evening', value: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setFares(prev => {
      const current = (prev[dateKey] as DayFare) || { morning: '', evening: '' };
      const updated = {
        ...current,
        [type]: value,
        crossedOut: false
      };
      
      const newState = {
        ...prev,
        [dateKey]: updated
      };
      
      if (user) {
        const fareDocPath = `users/${user.uid}/fares`;
        setDoc(doc(db, fareDocPath, dateKey), {
          ...updated,
          userId: user.uid,
          updatedAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, fareDocPath));
      }
      
      return newState;
    });
  };

  const handleToggleCrossOut = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setFares(prev => {
      const current = prev[dateKey] || { morning: '', evening: '' };
      const currentlyCrossedOut = getIsCrossedOut(date, current);
      const updated = {
        ...current,
        crossedOut: !currentlyCrossedOut
      };
      const newState = {
        ...prev,
        [dateKey]: updated
      };
      
      if (user) {
        const fareDocPath = `users/${user.uid}/fares`;
        setDoc(doc(db, fareDocPath, dateKey), {
          ...updated,
          userId: user.uid,
          updatedAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, fareDocPath));
      }
      
      return newState;
    });
  };

  const { totalThisMonth, avgDaily, chartData, activeDaysCount, forecast } = useMemo(() => {
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    let total = 0;
    let activeDays = 0;
    
    // First pass to get total and active days correctly
    daysInMonth.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayFare = fares[dateKey];
      const crossedOut = getIsCrossedOut(day, dayFare);
      if (!crossedOut && dayFare) {
        const morning = parseFloat(dayFare.morning) || 0;
        const evening = parseFloat(dayFare.evening) || 0;
        if (morning + evening > 0) activeDays++;
        total += (morning + evening) * currentRate;
      }
    });

    const avg = activeDays > 0 ? total / activeDays : 0;

    let cumulative = 0;
    const chart = daysInMonth.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayFare = fares[dateKey];
      const crossedOut = getIsCrossedOut(day, dayFare);
      let dayTotalGhs = 0;
      let mParsed = 0;
      let eParsed = 0;
      if (!crossedOut && dayFare) {
        const morning = parseFloat(dayFare.morning) || 0;
        const evening = parseFloat(dayFare.evening) || 0;
        mParsed = morning * currentRate;
        eParsed = evening * currentRate;
        dayTotalGhs = morning + evening;
      }
      const dayTotalSelected = dayTotalGhs * currentRate;
      cumulative += dayTotalSelected;
      
      return {
        date: format(day, 'd'),
        total: dayTotalSelected,
        cumulative: cumulative,
        average: avg,
        morningParsed: mParsed,
        eveningParsed: eParsed
      };
    });

    const today = new Date();
    // Forecast if current month is selected
    let currentForecast = total;
    if (isSameMonth(currentDate, today)) {
        const passedWorkDays = daysInMonth.filter(d => d <= today && !getIsCrossedOut(d, fares[format(d, 'yyyy-MM-dd')])).length;
        const totalWorkDays = daysInMonth.filter(d => !getIsCrossedOut(d, fares[format(d, 'yyyy-MM-dd')])).length;
        
        const avgPerWorkDay = passedWorkDays > 0 ? total / passedWorkDays : 0;
        currentForecast = total + (totalWorkDays - passedWorkDays) * avgPerWorkDay;
    }

    return {
      totalThisMonth: total,
      avgDaily: avg,
      chartData: chart,
      activeDaysCount: activeDays,
      forecast: currentForecast
    };
  }, [fares, monthStart, monthEnd, currentDate, currentRate]);

  const exportToExcel = () => {
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const data = daysInMonth.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayFare = fares[dateKey] || { morning: '', evening: '' };
      const crossedOut = getIsCrossedOut(day, dayFare);
      const m = crossedOut ? 0 : (parseFloat(dayFare.morning) || 0) * currentRate;
      const e = crossedOut ? 0 : (parseFloat(dayFare.evening) || 0) * currentRate;
      return {
        Date: format(day, 'MMM dd, yyyy'),
        'Day': format(day, 'EEEE'),
        'Crossed Out': crossedOut ? 'Yes' : 'No',
        [`Morning Fare (${currentSymbol})`]: m,
        [`Evening Fare (${currentSymbol})`]: e,
        [`Total Daily (${currentSymbol})`]: m + e
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, format(currentDate, 'MMM yyyy'));
    XLSX.writeFile(workbook, `Transport_Fares_${format(currentDate, 'MMM_yyyy')}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-4 md:p-8 flex flex-col transition-colors duration-200">
      <style>{`
        :root {
          --theme-50: ${(ACCENT_PALETTES as any)[accentColor]?.['50']};
          --theme-100: ${(ACCENT_PALETTES as any)[accentColor]?.['100']};
          --theme-200: ${(ACCENT_PALETTES as any)[accentColor]?.['200']};
          --theme-300: ${(ACCENT_PALETTES as any)[accentColor]?.['300']};
          --theme-400: ${(ACCENT_PALETTES as any)[accentColor]?.['400']};
          --theme-500: ${(ACCENT_PALETTES as any)[accentColor]?.['500']};
          --theme-600: ${(ACCENT_PALETTES as any)[accentColor]?.['600']};
          --theme-700: ${(ACCENT_PALETTES as any)[accentColor]?.['700']};
          --theme-800: ${(ACCENT_PALETTES as any)[accentColor]?.['800']};
          --theme-900: ${(ACCENT_PALETTES as any)[accentColor]?.['900']};
        }
      `}</style>
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col h-full">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Transit Ledger</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Personal Commute & Expense Tracker</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={() => setShowSettings(true)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl shadow-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors relative"
              title="Settings & Reminders"
            >
              <Settings size={18} />
              {user && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" title="Data Synced to Cloud" />
              )}
            </button>
          </div>
        </div>

        {/* Main Bento Grid */}
        <div className={cn("flex-1 grid gap-4 overflow-hidden", isCompactMode ? "grid-cols-1" : "grid-cols-1 md:grid-cols-12 grid-rows-none md:grid-rows-6")}>
          
          {/* Calendar Card (The Core Tracker) */}
          <div className={cn("bg-white dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl border border-primary-100 dark:border-primary-900 shadow-sm p-4 sm:p-6 flex flex-col transition-colors", isCompactMode ? "col-span-1 min-h-0" : "md:col-span-8 md:row-span-6 overflow-hidden")}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-1 sm:gap-3">
                  <button onClick={handlePrev} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                    <ChevronLeft size={20} />
                  </button>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white min-w-[120px] sm:min-w-[140px] text-center">
                    {view === 'day' ? format(currentDate, 'MMM dd, yyyy') : 
                     view === 'week' ? `Week of ${format(startOfWeek(currentDate, {weekStartsOn: 1}), 'MMM dd')}` : 
                     view === 'month' ? format(currentDate, 'MMMM yyyy') : 
                     format(currentDate, 'yyyy')}
                  </h2>
                  <button onClick={handleNext} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                    <ChevronRight size={20} />
                  </button>
                </div>
                {isCompactMode && (
                  <div className="text-sm font-semibold text-primary-600 dark:text-primary-400 ml-auto sm:ml-0">
                    Total: {currentSymbol}{totalThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>

              {/* View Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                {[
                  { id: 'day', label: 'Day' },
                  { id: 'week', label: 'Week' },
                  { id: 'month', label: 'Month' },
                  { id: 'year', label: 'Year' }
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setView(v.id as any)}
                    className={cn(
                      "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                      view === v.id 
                        ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600" 
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex gap-2">
                <div className="w-3 h-3 rounded-full bg-secondary-100 dark:bg-secondary-900/50 border border-secondary-200 dark:border-secondary-800" title="Morning (AM)"></div>
                <div className="w-3 h-3 rounded-full bg-primary-100 dark:bg-primary-900/50 border border-primary-200 dark:border-primary-800" title="Evening (PM)"></div>
              </div>
            </div>
            
            <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 flex-1">
              {view === 'month' && (
                <div className="min-w-[550px]">
                  {/* Calendar Header */}
                  <div className="grid grid-cols-7 mb-2 border-b border-slate-100 dark:border-slate-800 pb-2 transition-colors">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <div key={day} className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{day}</div>
                    ))}
                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 auto-rows-[minmax(84px,1fr)] md:grid-rows-5 flex-1 gap-1.5 sm:gap-2">
                    {calendarDays.map((day) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const dayFare = fares[dateKey] || { morning: '', evening: '' };
                      const currentMonth = isSameMonth(day, monthStart);
                      const today = isToday(day);
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                      return (
                        <div
                          key={dateKey}
                          className={cn(
                            "border rounded-xl p-1 sm:p-2 flex flex-col justify-between transition-colors relative overflow-hidden",
                            !currentMonth ? "border-transparent bg-slate-50/50 dark:bg-slate-900/40 opacity-40 grayscale" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary-300 dark:hover:border-primary-600 shadow-sm",
                            today && "border-primary-400 dark:border-primary-500 ring-4 ring-primary-50 dark:ring-primary-900/20",
                            getIsCrossedOut(day, dayFare) && "opacity-75 grayscale bg-slate-50/80 dark:bg-slate-900/80"
                          )}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className={cn(
                              "text-[10px] sm:text-xs font-bold",
                              today ? "text-primary-600 dark:text-primary-400" : (isWeekend && currentMonth ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"),
                              (!currentMonth || getIsCrossedOut(day, dayFare)) && "text-slate-400 dark:text-slate-600"
                            )}>
                              {format(day, 'dd')}{today && <span className="hidden sm:inline"> Today</span>}
                            </span>
                            <div className="flex items-center gap-1 z-10">
                              {isWeekend && currentMonth && !today && (
                                <span className="hidden lg:block text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-1 rounded uppercase font-bold tracking-wider">Wkd</span>
                              )}
                              {currentMonth && (
                                <button
                                  onClick={() => handleToggleCrossOut(day)}
                                  className={cn(
                                    "p-0.5 rounded transition-colors",
                                    getIsCrossedOut(day, dayFare) ? "text-red-500 hover:text-red-600" : "text-slate-300 hover:text-red-400 dark:text-slate-600 dark:hover:text-red-400"
                                  )}
                                  title="Cross out off-days"
                                >
                                  <X size={12} strokeWidth={3} />
                                </button>
                              )}
                            </div>
                          </div>

                          {currentMonth && (
                            <div className="space-y-1 mt-auto flex-1 flex flex-col justify-end">
                              {getIsCrossedOut(day, dayFare) && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                  <div className="absolute w-[120%] h-[2px] bg-red-400/30 -rotate-[25deg]"></div>
                                  <span className="text-[10px] sm:text-xs font-black text-red-500/60 dark:text-red-400/60 uppercase tracking-widest bg-white/80 dark:bg-slate-900/80 px-1 py-0.5 rounded backdrop-blur-sm shadow-sm ring-1 ring-red-100 dark:ring-red-900/50 -rotate-[10deg] shadow-sm">
                                    {getHolidayInfo(day).isHoliday && (!dayFare || dayFare.crossedOut === undefined) ? getHolidayInfo(day).name || 'Holiday' : 'No Work'}
                                  </span>
                                </div>
                              )}
                              <div className={cn("space-y-1 transition-all", getIsCrossedOut(day, dayFare) ? "opacity-20 pointer-events-none select-none blur-[1px]" : "opacity-100")}>
                                <div className="group">
                                  <FareInput 
                                    valueInGhs={dayFare.morning}
                                    rate={currentRate}
                                    onChange={(v) => handleFareChange(day, 'morning', v)}
                                    placeholder="AM"
                                    typeContext="morning"
                                  />
                                </div>
                                <div className="group">
                                  <FareInput 
                                    valueInGhs={dayFare.evening}
                                    rate={currentRate}
                                    onChange={(v) => handleFareChange(day, 'evening', v)}
                                    placeholder="PM"
                                    typeContext="evening"
                                  />
                                </div>
                              </div>
                              {/* Daily Total Line */}
                              {!dayFare.crossedOut && (parseFloat(dayFare.morning) > 0 || parseFloat(dayFare.evening) > 0) && (
                                <div className={cn(
                                  "text-[10px] sm:text-[11px] font-bold text-right pt-1 mt-1 border-t transition-opacity",
                                  isDarkMode ? "border-slate-800 text-primary-300" : "border-slate-100 text-primary-600"
                                )}>
                                  {currentSymbol}{(((parseFloat(dayFare.morning) || 0) + (parseFloat(dayFare.evening) || 0)) * currentRate).toFixed(2)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {view === 'day' && (
                <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto space-y-8">
                  <div className="text-center space-y-2">
                    <p className="text-sm font-bold uppercase tracking-widest text-primary-500 dark:text-primary-400">{format(currentDate, 'EEEE')}</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{format(currentDate, 'MMMM do')}</h3>
                  </div>
                  
                  <div className="w-full space-y-6">
                    {(() => {
                      const dateKey = format(currentDate, 'yyyy-MM-dd');
                      const dayFare = fares[dateKey] || { morning: '', evening: '' };
                      const crossedOut = getIsCrossedOut(currentDate, dayFare);
                      
                      return (
                        <div className={cn(
                          "bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border-2 transition-all relative overflow-hidden",
                          crossedOut ? "border-red-200 dark:border-red-900/30" : "border-slate-100 dark:border-slate-800"
                        )}>
                          {crossedOut && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                             <div className="absolute w-[120%] h-[4px] bg-red-400/20 -rotate-[15deg]"></div>
                             <span className="text-xl font-black text-red-500/60 dark:text-red-400/60 uppercase tracking-[0.2em] bg-white/90 dark:bg-slate-900/90 px-4 py-2 rounded-2xl backdrop-blur-md shadow-2xl ring-2 ring-red-100 dark:ring-red-900/50 -rotate-[5deg]">
                               {getHolidayInfo(currentDate).isHoliday && (!dayFare || dayFare.crossedOut === undefined) ? getHolidayInfo(currentDate).name || 'Holiday' : 'No Work'}
                             </span>
                           </div>
                          )}

                          <div className={cn("space-y-6", crossedOut && "opacity-20 blur-sm pointer-events-none")}>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                                <Sun size={14} className="text-secondary-500" /> Morning fare
                              </label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">{currentSymbol}</span>
                                <input 
                                  type="number"
                                  step="any"
                                  value={dayFare.morning ? (parseFloat(dayFare.morning) * currentRate).toFixed(2).replace(/\.?0+$/, '') : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? '' : (parseFloat(e.target.value) / currentRate).toString();
                                    handleFareChange(currentDate, 'morning', val);
                                  }}
                                  placeholder="0.00"
                                  className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-2xl font-black text-slate-900 dark:text-white outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-all shadow-sm"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                                <Moon size={14} className="text-primary-500" /> Evening fare
                              </label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">{currentSymbol}</span>
                                <input 
                                  type="number"
                                  step="any"
                                  value={dayFare.evening ? (parseFloat(dayFare.evening) * currentRate).toFixed(2).replace(/\.?0+$/, '') : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? '' : (parseFloat(e.target.value) / currentRate).toString();
                                    handleFareChange(currentDate, 'evening', val);
                                  }}
                                  placeholder="0.00"
                                  className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-2xl font-black text-slate-900 dark:text-white outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-all shadow-sm"
                                />
                              </div>
                            </div>

                            <div className="pt-4 border-t-2 border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <span className="font-bold text-slate-500">Daily Total</span>
                                <span className="text-3xl font-black text-primary-600 dark:text-primary-400">
                                  {currentSymbol}{(((parseFloat(dayFare.morning) || 0) + (parseFloat(dayFare.evening) || 0)) * currentRate).toFixed(2)}
                                </span>
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => handleToggleCrossOut(currentDate)}
                            className={cn(
                              "mt-6 w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                              crossedOut 
                                ? "bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-none" 
                                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                            )}
                          >
                            <X size={16} strokeWidth={3} />
                            {crossedOut ? "Marked as Off-day" : "Mark as Off-day"}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {view === 'week' && (
                <div className="flex flex-col gap-4">
                  {eachDayOfInterval({
                    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                    end: endOfWeek(currentDate, { weekStartsOn: 1 })
                  }).map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayFare = fares[dateKey] || { morning: '', evening: '' };
                    const crossedOut = getIsCrossedOut(day, dayFare);
                    const isFocus = isSameDay(day, currentDate);
                    const total = ((parseFloat(dayFare.morning) || 0) + (parseFloat(dayFare.evening) || 0)) * currentRate;

                    return (
                      <div 
                        key={dateKey}
                        className={cn(
                          "group transition-all rounded-2xl border-2 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                          isFocus ? "border-primary-400 bg-white dark:bg-slate-800 shadow-md ring-1 ring-primary-50 dark:ring-primary-900/20" : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200",
                          crossedOut && "opacity-60 grayscale border-dashed"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold transition-colors shadow-sm",
                            isToday(day) ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                          )}>
                            <span className="text-[10px] uppercase leading-none">{format(day, 'EEE')}</span>
                            <span className="text-lg leading-tight">{format(day, 'd')}</span>
                          </div>
                          <div>
                            {crossedOut ? (
                              <span className="text-sm font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <X size={14} strokeWidth={3} /> {getHolidayInfo(day).isHoliday && (!dayFare || dayFare.crossedOut === undefined) ? getHolidayInfo(day).name || 'Holiday' : 'No Work'}
                              </span>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                                <div className="w-24">
                                  <FareInput 
                                    valueInGhs={dayFare.morning}
                                    rate={currentRate}
                                    onChange={(v) => handleFareChange(day, 'morning', v)}
                                    placeholder="AM"
                                    typeContext="morning"
                                  />
                                </div>
                                <div className="w-24">
                                  <FareInput 
                                    valueInGhs={dayFare.evening}
                                    rate={currentRate}
                                    onChange={(v) => handleFareChange(day, 'evening', v)}
                                    placeholder="PM"
                                    typeContext="evening"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-48 pl-16 sm:pl-0">
                          <button 
                            onClick={() => handleToggleCrossOut(day)}
                            className={cn(
                              "p-2 rounded-lg transition-colors border shadow-sm",
                              crossedOut ? "bg-red-500 text-white border-red-500" : "bg-white dark:bg-slate-700 text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 border-slate-100 dark:border-slate-600"
                            )}
                          >
                            <X size={16} strokeWidth={3} />
                          </button>
                          
                          <div className="text-right min-w-[100px]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Day Total</p>
                            <p className={cn(
                              "text-xl font-black",
                              total > 0 ? "text-primary-600 dark:text-primary-400" : "text-slate-300 dark:text-slate-700"
                            )}>
                              {currentSymbol}{total.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {view === 'year' && (() => {
                  let yearlyTotal = 0;
                  let yearlyActiveDays = 0;
                  const monthsData = eachMonthOfInterval({
                    start: startOfYear(currentDate),
                    end: endOfYear(currentDate)
                  }).map(month => {
                    const mStart = startOfMonth(month);
                    const mEnd = endOfMonth(month);
                    const mDays = eachDayOfInterval({ start: mStart, end: mEnd });
                    
                    let mTotal = 0;
                    let mActive = 0;
                    mDays.forEach(day => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const dayFare = fares[dateKey];
                      if (dayFare && !getIsCrossedOut(day, dayFare)) {
                        const m = (parseFloat(dayFare.morning) || 0) + (parseFloat(dayFare.evening) || 0);
                        if (m > 0) mActive++;
                        mTotal += m * currentRate;
                      }
                    });
                    
                    yearlyTotal += mTotal;
                    yearlyActiveDays += mActive;

                    return { month, mTotal, mActive };
                  });

                  const yearlyAvg = yearlyActiveDays > 0 ? yearlyTotal / yearlyActiveDays : 0;

                  return (
                    <div className="flex flex-col gap-6 w-full">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-primary-900 border border-primary-800 rounded-3xl p-6 relative overflow-hidden text-white shadow-lg flex flex-col justify-center transition-colors">
                          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary-500 rounded-full opacity-30 blur-3xl pointer-events-none"></div>
                          <span className="text-primary-300 text-xs font-semibold uppercase tracking-widest mb-1 z-10">Year Total Expenses</span>
                          <h3 className="text-4xl lg:text-5xl font-black mb-1 z-10">{currentSymbol}{yearlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-sm flex flex-col justify-center transition-colors">
                           <span className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1">Average Daily Spending</span>
                           <h3 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-1">{currentSymbol}{yearlyAvg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">{yearlyActiveDays} Active Days</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                        {monthsData.map(({ month, mTotal, mActive }) => {
                          const isNow = isSameMonth(month, new Date());
                          const isCur = isSameMonth(month, currentDate);
                          return (
                            <button
                              key={month.getTime()}
                              onClick={() => {
                                setCurrentDate(month);
                                setView('month');
                              }}
                              className={cn(
                                "relative group rounded-3xl border-2 p-5 text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
                                isCur ? "border-primary-400 bg-white dark:bg-slate-800 shadow-lg ring-1 ring-primary-50 dark:ring-primary-900/20" : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 shadow-sm",
                                mTotal === 0 && !isNow && "opacity-60"
                              )}
                            >
                              {isNow && (
                                <span className="absolute top-4 right-4 text-[8px] font-black uppercase tracking-[0.2em] bg-primary-600 text-white px-2 py-0.5 rounded-full shadow-sm z-10">Current</span>
                              )}
                              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">{format(month, 'MMM')}</p>
                              <h4 className="text-xl font-black text-slate-900 dark:text-white mb-4">{currentSymbol}{mTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                              
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700/50 pt-3">
                                <span>{mActive} days</span>
                                <span className="group-hover:text-primary-500 transition-colors uppercase tracking-widest">Detail →</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
              })()}
            </div>
          </div>

          {!isCompactMode && (
            <>
              {/* Summary Stat Card (Bento) */}
              <div className="md:col-span-4 md:row-span-3 bg-slate-900 dark:bg-slate-950 rounded-3xl p-6 lg:p-8 flex flex-col justify-center text-white relative overflow-hidden shadow-lg transition-colors">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary-500 rounded-full opacity-30 blur-3xl pointer-events-none"></div>
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-secondary-500 rounded-full opacity-20 blur-3xl pointer-events-none"></div>
                
                <span className="text-primary-300 dark:text-primary-400 text-sm font-semibold uppercase tracking-widest mb-2 z-10">Month Total Spent</span>
                <h3 className="text-5xl lg:text-6xl font-black mb-4 z-10 tracking-tight">
                  {currentSymbol}{totalThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <div className="flex items-center gap-2 z-10">
                  <p className="text-xs text-slate-400">
                    {isSameMonth(currentDate, new Date()) ? 'Forecasted end of month:' : 'Final monthly total:'}{' '}
                    <span className="text-white font-bold">{currentSymbol}{forecast.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                </div>
              </div>

              {/* Average Daily Tracker */}
              <div className="md:col-span-2 md:row-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 lg:p-6 flex flex-col justify-between transition-colors">
                <div>
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4 transition-colors">
                    <TrendingUp size={20} strokeWidth={2.5} />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Daily Avg</p>
                  <p className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {currentSymbol}{avgDaily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/40 px-2 py-1 rounded w-fit uppercase tracking-wide transition-colors">
                    {activeDaysCount} Days Traveled
                  </p>
                </div>
              </div>

              {/* Monthly Trend Chart */}
              <div className="md:col-span-2 md:row-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 lg:p-6 flex flex-col transition-colors">
                <div className="mb-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Daily Spending Trend</p>
                </div>
                <div className="flex-1 w-full min-h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <Tooltip 
                        cursor={{fill: isDarkMode ? '#1e293b' : '#f1f5f9'}}
                        content={<CustomTooltip currentSymbol={currentSymbol} currentDate={currentDate} />}
                      />
                      <Bar 
                        dataKey="total" 
                        fill="var(--theme-500, var(--color-indigo-500))" 
                        radius={[4, 4, 4, 4]} 
                        onClick={(data) => {
                          if (data && data.payload) {
                            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), parseInt(data.payload.date));
                            setCurrentDate(newDate);
                            setView('day');
                          }
                        }}
                        cursor="pointer"
                      />
                      <Line type="stepAfter" dataKey="average" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl max-w-sm w-full border border-primary-200 dark:border-primary-800 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings size={20} className="text-slate-400" />
                Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-1 mb-6 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
              {[
                { id: 'appearance', label: 'Look', icon: Sun },
                { id: 'reminders', label: 'Alerts', icon: Bell },
                { id: 'recurring', label: 'Defaults', icon: Calendar },
                { id: 'account', label: 'Account', icon: User }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSettingsTab(tab.id as any)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                    activeSettingsTab === tab.id 
                      ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-6 overflow-y-auto hide-scrollbar flex-1 min-h-0 px-1 -mx-1 pb-4">
              {activeSettingsTab === 'appearance' && (
                <div className="space-y-6 motion-preset-fade">
                  {/* Appearance & Preferences Section */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preferences</h4>
                    
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-sm font-semibold">Theme</span>
                      <button 
                        onClick={() => setIsDarkMode(prev => !prev)}
                        className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex gap-2 items-center text-xs font-bold"
                      >
                        {isDarkMode ? <><Sun size={14} className="text-primary-400" /> Light</> : <><Moon size={14} className="text-primary-600" /> Dark</>}
                      </button>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-sm font-semibold">Compact Mode</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={isCompactMode} onChange={e => setIsCompactMode(e.target.checked)} />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-primary-500"></div>
                      </label>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-sm font-semibold">Currency</span>
                      <select 
                        value={currency} 
                        onChange={e => setCurrency(e.target.value)}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm font-bold outline-none cursor-pointer shadow-sm"
                      >
                        {Object.keys(CURRENCY_SYMBOLS).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Accent Color</h4>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_COLORS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setAccentColor(c.id)}
                          className={cn(
                            "w-6 h-6 rounded-full transition-transform hover:scale-110 shadow-sm",
                            accentColor === c.id ? "ring-2 ring-offset-2 ring-slate-800 dark:ring-slate-200 dark:ring-offset-slate-900" : ""
                          )}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'recurring' && (
                <div className="space-y-4 motion-preset-fade">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recurring Fares</h4>
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 mb-2">Auto-fill values for work days in current week.</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">Morning</span>
                      <div className="relative w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currentSymbol}</span>
                        <input 
                          type="number"
                          value={recurringMorning}
                          onChange={e => setRecurringMorning(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-sm outline-none focus:border-primary-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">Evening</span>
                      <div className="relative w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currentSymbol}</span>
                        <input 
                          type="number"
                          value={recurringEvening}
                          onChange={e => setRecurringEvening(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-sm outline-none focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'reminders' && (
                <div className="space-y-4 motion-preset-fade">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={18} className={remindersEnabled ? "text-primary-500" : "text-slate-400"} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Daily Reminders</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={remindersEnabled}
                        onChange={(e) => {
                          setRemindersEnabled(e.target.checked);
                          if (e.target.checked && Notification.permission !== 'granted') {
                            Notification.requestPermission();
                          }
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-500"></div>
                    </label>
                  </div>

                  {remindersEnabled && (
                    <div className="pl-6 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Morning Fare</span>
                        <input 
                          type="time" 
                          value={morningReminderTime}
                          onChange={e => setMorningReminderTime(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary-500 text-slate-700 dark:text-slate-300"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Evening Fare</span>
                        <input 
                          type="time" 
                          value={eveningReminderTime}
                          onChange={e => setEveningReminderTime(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary-500 text-slate-700 dark:text-slate-300"
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Notifications require this tab to remain open in the background.
                      </p>
                    </div>
                  )}
                  {!remindersEnabled && (
                    <p className="text-sm text-slate-500 italic text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      Turn on reminders to get notified when it's time to log your fares.
                    </p>
                  )}
                </div>
              )}

              {activeSettingsTab === 'account' && (
                <div className="space-y-6 motion-preset-fade">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account & Data</h4>
                    {user ? (
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-4">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border border-slate-200" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                              {user.displayName?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{user.displayName || 'User'}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{user.email}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">Your data is automatically synced to the cloud.</p>
                      </div>
                    ) : (
                      <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-xl border border-primary-100 dark:border-primary-900/20">
                        <p className="text-sm text-primary-700 dark:text-primary-300 font-medium mb-3">Login to sync your data</p>
                        <p className="text-xs text-primary-600/80 dark:text-primary-400/70 mb-4">Pull your saved commute history and keep it synced across all your devices.</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        onClick={user ? handleLogout : handleLogin}
                        className={cn(
                          "w-full py-3 rounded-xl font-bold shadow-sm flex justify-center items-center gap-2 transition-colors text-sm",
                          user 
                            ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 dark:hover:bg-rose-500/20"
                            : "bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-200 dark:shadow-none"
                        )}
                      >
                        {user ? <LogOut size={16} /> : <LogIn size={16} />}
                        <span>{user ? "Logout" : "Log in with Google"}</span>
                      </button>
                      <button 
                        onClick={exportToExcel}
                        className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-700 flex justify-center items-center gap-2 text-sm"
                      >
                        <Download size={16} />
                        <span>Export CSV / Excel</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button 
                onClick={() => setShowSettings(false)}
                className="w-full py-2.5 bg-slate-900 dark:bg-primary-600 text-white rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-primary-500 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


