import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Download,
  Save,
  Upload,
  FolderKanban,
  Users,
  FileSpreadsheet,
  CheckSquare,
  Calendar,
  X,
  Layers,
  AlertCircle,
  FileCheck2,
  MessageSquare,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  Circle,
  ShieldAlert,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  LayoutGrid,
  UserCheck,
  Clock,
  FolderPlus,
  Tag,
  ArrowUpDown,
  CalendarDays,
  Flag,
  FileText,
  Image as ImageIcon,
  Bell,
  BellRing,
  Search,
  Send,
  Mail,
  CalendarPlus,
  Database,
  Pencil,
  Square,
  Type,
  Undo2,
  Flame,
  Cloud,
  CloudOff,
  Loader2,
  LogOut,
  Star,
  Archive,
  Building2,
  AlertTriangle,
} from 'lucide-react';

// === КОНФИГУРАЦИЯ GOOGLE DRIVE ===
const GOOGLE_CLIENT_ID = '779901409260-rhq1b311eqtaoonell1scqovsfsj4isa.apps.googleusercontent.com';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const CLOUD_DB_FILENAME = 'SUP_Tracker_Cloud_DB.json';

// === 1. INDEXEDDB ХРАНИЛИЩЕ ===

const IDB_NAME = 'SUP_Tracker_DB';
const IDB_STORE = 'kv_store';

function openTrackerDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openTrackerDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

async function idbSet<T>(key: string, val: T): Promise<void> {
  try {
    const db = await openTrackerDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IndexedDB write error:', e);
  }
}

function useIndexedStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const fromIdb = await idbGet<T>(key);
      if (!active) return;
      if (fromIdb !== undefined) {
        setValue(fromIdb);
        setIsLoaded(true);
        return;
      }
      try {
        const legacyRaw = localStorage.getItem(key);
        if (legacyRaw !== null) {
          const parsed = JSON.parse(legacyRaw);
          setValue(parsed);
          await idbSet(key, parsed);
        }
      } catch {
        // ignore parse errors
      }
      if (active) setIsLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [key]);

  useEffect(() => {
    if (!isLoaded) return;
    idbSet(key, value);
  }, [key, value, isLoaded]);

  return [value, setValue, isLoaded];
}

// === 2. УТИЛИТЫ ДАТ, НЕДЕЛЬ, СЖАТИЯ ИЗОБРАЖЕНИЙ И .ICS ===

const normalizeScreenshots = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string' && val.trim()) return [val];
  return [];
};

const getTodayDMY = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const getCurrentISOWeek = () => {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const formatToDMY = (val: string) => {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  }
  return val;
};

const formatToISO = (val: string) => {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const parts = val.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
};

const parseDateObj = (val: string): Date | null => {
  if (!val) return null;
  const iso = formatToISO(val);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const getDaysSinceDate = (dateStr: string): number | null => {
  const target = parseDateObj(dateStr);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
};

const getDeadlineUrgency = (dateStr: string): 'overdue' | 'soon' | 'normal' | null => {
  const target = parseDateObj(dateStr);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 5) return 'soon';
  return 'normal';
};

const getWeekRange = (isoWeek: string): { start: Date; end: Date } | null => {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeek || '');
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  if (dow <= 4) {
    monday.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    monday.setDate(simple.getDate() + 8 - simple.getDay());
  }
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
};

const isDateInWeek = (dateStr: string, isoWeek: string): boolean => {
  const d = parseDateObj(dateStr);
  const range = getWeekRange(isoWeek);
  if (!d || !range) return false;
  return d >= range.start && d <= range.end;
};

const compressImageDataUrl = (dataUrl: string, maxWidth = 1400, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

const copyImageDataUrlToClipboard = async (dataUrl: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard || !(window as any).ClipboardItem) return false;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) return false;
    await navigator.clipboard.write([new (window as any).ClipboardItem({ 'image/png': pngBlob })]);
    return true;
  } catch (e) {
    console.error('Clipboard image copy failed:', e);
    return false;
  }
};

const downloadICSFile = (title: string, dateDMY: string, timeHHMM?: string, description?: string) => {
  const iso = formatToISO(dateDMY);
  if (!iso) return;
  const cleanDate = iso.replace(/-/g, '');
  let dtStart = `DTSTART;VALUE=DATE:${cleanDate}`;
  let dtEnd = `DTEND;VALUE=DATE:${cleanDate}`;

  if (timeHHMM && /^\d{2}:\d{2}$/.test(timeHHMM)) {
    const [hh, mm] = timeHHMM.split(':');
    const endHour = String((Number(hh) + 1) % 24).padStart(2, '0');
    dtStart = `DTSTART:${cleanDate}T${hh}${mm}00`;
    dtEnd = `DTEND:${cleanDate}T${endHour}${mm}00`;
  }

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SUP Engineering//Project Tracker//RU',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@sup-tracker`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    dtStart,
    dtEnd,
    `SUMMARY:${title.replace(/\n/g, ' ')}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Напоминание ProjectStatus',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Event_${cleanDate}.ics`;
  link.click();
};

const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // ignore audio restrictions
  }
};

const buildProjectReportSummary = (project: any, targetWeek: string) => {
  const tasksList = project.tasks || [];
  const blockersList = project.blockers || [];

  const doneThisWeek = tasksList.filter(
    (t: any) => !t.isHeader && t.status === 'выполнено' && isDateInWeek(t.date, targetWeek)
  );
  const doneText =
    doneThisWeek.length > 0
      ? doneThisWeek
          .map((t: any) => `${t.building ? `[${t.building}] ` : ''}${t.name}`)
          .join(', ')
      : 'На этой неделе ничего не выполнено';

  let currentSection = 'Общее';
  const groupedInProgress: Record<string, string[]> = {};

  tasksList.forEach((t: any) => {
    if (t.isHeader) {
      const bldPrefix = t.building ? `[${t.building}] ` : '';
      currentSection = bldPrefix + t.name.replace('📋 ', '').replace(/^\d+\.\s*/, '').trim();
      return;
    }
    if (t.status === 'в работе' || t.status === 'передано другому') {
      if (!groupedInProgress[currentSection]) {
        groupedInProgress[currentSection] = [];
      }
      const bldTag = t.building && !currentSection.includes(`[${t.building}]`) ? `[${t.building}] ` : '';
      const label =
        t.status === 'передано другому' ? `${bldTag}${t.name} (передано)` : `${bldTag}${t.name}`;
      groupedInProgress[currentSection].push(label);
    }
  });

  const inProgressLines = Object.entries(groupedInProgress).map(([section, items]) => {
    if (items.length <= 2) {
      return `${section}: ${items.join(', ')}`;
    }
    return `${section}: ${items.slice(0, 2).join(', ')} (+${items.length - 2})`;
  });

  const inProgressText = inProgressLines.join('; ');

  const activeBlockers = blockersList.filter((b: any) => !b.resolved && (b.text || '').trim());
  const blockersText = activeBlockers.map((b: any) => b.text.trim()).join('; ');

  return {
    stage: project.stage || '',
    deadline: project.deadline || '',
    done: doneText,
    inProgress: inProgressText,
    blockers: blockersText,
  };
};

const matchDateFilter = (itemDate: string, filterVal: string) => {
  if (!filterVal) return true;
  const displayDate = formatToDMY(itemDate);
  const normalizedFilter = filterVal.trim().replace(/\./g, '/');
  return displayDate.includes(normalizedFilter);
};

// === 3. РЕДАКТОР ПОМЕТОК НА СКРИНШОТАХ И КОПИРОВАНИЕ В БУФЕР ===

type DrawShape =
  | { type: 'rect'; color: string; x1: number; y1: number; x2: number; y2: number }
  | { type: 'arrow'; color: string; x1: number; y1: number; x2: number; y2: number }
  | { type: 'pen'; color: string; points: Array<{ x: number; y: number }> }
  | { type: 'text'; color: string; x: number; y: number; text: string };

function ScreenshotLightboxModal({
  images,
  initialIndex,
  onClose,
  onSaveEditedImage,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
  onSaveEditedImage?: (index: number, newDataUrl: string) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [tool, setTool] = useState<'rect' | 'arrow' | 'pen' | 'text'>('rect');
  const [color, setColor] = useState('#ef4444');
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [draftShape, setDraftShape] = useState<DrawShape | null>(null);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [copiedImg, setCopiedImg] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);

  const currentSrc = images[currentIndex];

  useEffect(() => {
    setShapes([]);
    setDraftShape(null);
    setTextDraft(null);
    setIsAnnotating(false);
    setCopiedImg(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!isAnnotating || !currentSrc) return;
    const img = new Image();
    img.onload = () => {
      loadedImgRef.current = img;
      redrawCanvas(img, shapes, draftShape);
    };
    img.src = currentSrc;
  }, [isAnnotating, currentSrc]);

  useEffect(() => {
    if (isAnnotating && loadedImgRef.current) {
      redrawCanvas(loadedImgRef.current, shapes, draftShape);
    }
  }, [shapes, draftShape, isAnnotating]);

  const drawSingleShape = (ctx: CanvasRenderingContext2D, s: DrawShape, scaleFactor: number) => {
    const lw = Math.max(3, Math.round(4 * scaleFactor));
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (s.type === 'rect') {
      ctx.strokeRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1);
    } else if (s.type === 'arrow') {
      const headLen = Math.max(14, 18 * scaleFactor);
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(
        s.x2 - headLen * Math.cos(angle - Math.PI / 6),
        s.y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        s.x2 - headLen * Math.cos(angle + Math.PI / 6),
        s.y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    } else if (s.type === 'pen' && s.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
      ctx.stroke();
    } else if (s.type === 'text' && s.text.trim()) {
      const fontSize = Math.max(18, Math.round(24 * scaleFactor));
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      const metrics = ctx.measureText(s.text);
      const pad = Math.round(6 * scaleFactor);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fillRect(s.x - pad, s.y - fontSize, metrics.width + pad * 2, fontSize + pad * 1.5);
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, s.x, s.y);
    }
  };

  const redrawCanvas = (img: HTMLImageElement, allShapes: DrawShape[], activeDraft: DrawShape | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const scaleFactor = Math.max(1, canvas.width / 900);
    allShapes.forEach((s) => drawSingleShape(ctx, s, scaleFactor));
    if (activeDraft) {
      drawSingleShape(ctx, activeDraft, scaleFactor);
    }
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotating) return;
    const { x, y } = getCanvasCoords(e);

    if (tool === 'text') {
      if (textDraft && textDraft.value.trim()) {
        setShapes((prev) => [...prev, { type: 'text', color, x: textDraft.x, y: textDraft.y, text: textDraft.value.trim() }]);
      }
      setTextDraft({ x, y, value: '' });
      return;
    }

    if (tool === 'rect') {
      setDraftShape({ type: 'rect', color, x1: x, y1: y, x2: x, y2: y });
    } else if (tool === 'arrow') {
      setDraftShape({ type: 'arrow', color, x1: x, y1: y, x2: x, y2: y });
    } else if (tool === 'pen') {
      setDraftShape({ type: 'pen', color, points: [{ x, y }] });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draftShape) return;
    const { x, y } = getCanvasCoords(e);
    if (draftShape.type === 'rect' || draftShape.type === 'arrow') {
      setDraftShape({ ...draftShape, x2: x, y2: y });
    } else if (draftShape.type === 'pen') {
      setDraftShape({ ...draftShape, points: [...draftShape.points, { x, y }] });
    }
  };

  const handleMouseUp = () => {
    if (!draftShape) return;
    setShapes((prev) => [...prev, draftShape]);
    setDraftShape(null);
  };

  const commitTextDraft = () => {
    if (textDraft && textDraft.value.trim()) {
      setShapes((prev) => [...prev, { type: 'text', color, x: textDraft.x, y: textDraft.y, text: textDraft.value.trim() }]);
    }
    setTextDraft(null);
  };

  const handleSaveAnnotated = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onSaveEditedImage) return;
    const updatedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onSaveEditedImage(currentIndex, updatedDataUrl);
    setIsAnnotating(false);
    setShapes([]);
  };

  const handleCopyCurrentImage = async () => {
    const sourceToCopy =
      isAnnotating && canvasRef.current ? canvasRef.current.toDataURL('image/png') : currentSrc;
    if (!sourceToCopy) return;
    const ok = await copyImageDataUrlToClipboard(sourceToCopy);
    if (ok) {
      setCopiedImg(true);
      setTimeout(() => setCopiedImg(false), 2200);
    } else {
      alert('Браузер не разрешил копирование картинки в буфер обмена. Попробуйте правой кнопкой -> Копировать изображение.');
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !textDraft) {
        e.preventDefault();
        handleCopyCurrentImage();
        return;
      }
      if (e.key === 'Escape') {
        if (textDraft) {
          setTextDraft(null);
        } else if (isAnnotating) {
          setIsAnnotating(false);
        } else {
          onClose();
        }
      } else if (!isAnnotating && images.length > 1) {
        if (e.key === 'ArrowRight') {
          setCurrentIndex((prev) => (prev + 1) % images.length);
        } else if (e.key === 'ArrowLeft') {
          setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAnnotating, textDraft, images.length, onClose, currentSrc]);

  return (
    <div
      onClick={() => {
        if (!isAnnotating) onClose();
      }}
      className="fixed inset-0 bg-slate-900/90 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-6xl w-full flex flex-col items-center gap-3"
      >
        <div className="bg-slate-800/95 border border-slate-700 text-white px-3 py-2 rounded-xl flex flex-wrap items-center justify-center gap-2 shadow-xl">
          {!isAnnotating ? (
            <>
              {onSaveEditedImage && (
                <button
                  type="button"
                  onClick={() => setIsAnnotating(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Pencil size={14} /> Пометить на скриншоте
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyCurrentImage}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  copiedImg
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                }`}
                title="Скопировать скриншот в буфер обмена для вставки в Outlook или WhatsApp (Ctrl+C)"
              >
                {copiedImg ? <Check size={14} /> : <Copy size={14} />}
                {copiedImg ? 'Скопировано в буфер!' : 'Копировать в буфер (Ctrl+C)'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
              >
                <X size={14} /> Закрыть (ESC)
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    commitTextDraft();
                    setTool('rect');
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                    tool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Square size={13} /> Рамка
                </button>
                <button
                  type="button"
                  onClick={() => {
                    commitTextDraft();
                    setTool('arrow');
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                    tool === 'arrow' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ArrowUpRight size={14} /> Стрелка
                </button>
                <button
                  type="button"
                  onClick={() => {
                    commitTextDraft();
                    setTool('pen');
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                    tool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Pencil size={13} /> Маркер
                </button>
                <button
                  type="button"
                  onClick={() => setTool('text')}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                    tool === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Type size={13} /> Текст
                </button>
              </div>

              <div className="flex items-center gap-1.5 px-2 border-x border-slate-700">
                {[
                  { hex: '#ef4444', label: 'Красный' },
                  { hex: '#2563eb', label: 'Синий' },
                  { hex: '#eab308', label: 'Желтый' },
                  { hex: '#10b981', label: 'Зеленый' },
                ].map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${
                      color === c.hex ? 'border-white scale-115' : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>

              <button
                type="button"
                disabled={shapes.length === 0}
                onClick={() => setShapes((prev) => prev.slice(0, -1))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-40 flex items-center gap-1"
                title="Отменить последний элемент"
              >
                <Undo2 size={13} /> Назад
              </button>

              <button
                type="button"
                onClick={handleCopyCurrentImage}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                  copiedImg ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title="Скопировать картинку с пометками сразу в буфер обмена"
              >
                {copiedImg ? <Check size={13} /> : <Copy size={13} />}
                {copiedImg ? 'В буфере!' : 'В буфер'}
              </button>

              <button
                type="button"
                onClick={handleSaveAnnotated}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow"
              >
                <Check size={14} /> Сохранить пометки
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAnnotating(false);
                  setShapes([]);
                  setTextDraft(null);
                }}
                className="text-xs text-slate-300 hover:text-white px-2 py-1"
              >
                Отмена
              </button>
            </>
          )}
        </div>

        {isAnnotating && textDraft && (
          <div className="bg-slate-800 border border-indigo-400 px-3 py-2 rounded-xl flex items-center gap-2 shadow-lg">
            <span className="text-xs text-slate-300">Подпись на скриншоте:</span>
            <input
              type="text"
              autoFocus
              value={textDraft.value}
              onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTextDraft();
                }
              }}
              placeholder="Введите текст (RU / עברית)..."
              className="px-2.5 py-1 text-xs bg-white text-slate-900 rounded focus:outline-none min-w-[220px]"
            />
            <button
              type="button"
              onClick={commitTextDraft}
              className="bg-indigo-600 text-white px-2.5 py-1 rounded text-xs font-medium"
            >
              OK
            </button>
          </div>
        )}

        {!isAnnotating ? (
          <img
            src={currentSrc}
            alt={`Скриншот ${currentIndex + 1}`}
            className="max-w-full max-h-[78vh] rounded-xl shadow-2xl border border-white/15 bg-white"
          />
        ) : (
          <div className="relative max-w-full max-h-[78vh] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="max-w-full max-h-[78vh] rounded-xl shadow-2xl border-2 border-indigo-400 bg-white cursor-crosshair"
            />
          </div>
        )}

        {!isAnnotating && images.length > 1 && (
          <div className="flex items-center gap-3 bg-slate-800/90 text-white px-4 py-1.5 rounded-full border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)}
              className="hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <ChevronLeft size={15} /> Предыдущий
            </button>
            <span className="font-mono text-slate-300">
              {currentIndex + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => (prev + 1) % images.length)}
              className="hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              Следующий <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// === 4. БАЗОВЫЕ UI-КОМПОНЕНТЫ ===

function DateInput({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const displayVal = formatToDMY(value);
  const isoVal = formatToISO(displayVal);
  const hiddenPickerRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    onChange(formatted);
  };

  return (
    <div className="relative flex items-center w-full group/date">
      <input
        type="text"
        value={displayVal}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="ДД/ММ/ГГГГ"
        maxLength={10}
        className={`w-full pl-2 pr-6 py-1 text-xs text-slate-600 bg-transparent hover:bg-slate-100/80 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 rounded focus:outline-none font-mono ${className}`}
      />
      <button
        type="button"
        onClick={() => {
          try {
            hiddenPickerRef.current?.showPicker();
          } catch {
            hiddenPickerRef.current?.click();
          }
        }}
        className="absolute right-1.5 text-slate-300 hover:text-indigo-600 opacity-60 group-hover/date:opacity-100 transition-opacity"
        title="Выбрать в календаре"
      >
        <Calendar size={12} />
      </button>
      <input
        ref={hiddenPickerRef}
        type="date"
        value={isoVal}
        onChange={(e) => {
          if (e.target.value) {
            onChange(formatToDMY(e.target.value));
          }
        }}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-transparent resize-none overflow-hidden focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 rounded px-2 py-1 transition-all leading-relaxed ${className}`}
    />
  );
}

function StatusPill({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  const getStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (['выполнено', 'выполнена', 'исправлено', 'одобрен', 'решен', 'есть', 'передана'].includes(s)) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
        dot: 'bg-emerald-500',
      };
    }
    if (['в работе', 'создан', 'отправлен', 'отправили на согласование', 'запросили', 'на проверке'].includes(s)) {
      return {
        bg: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
        dot: 'bg-sky-500',
      };
    }
    if (['требует исправления', 'нет'].includes(s)) {
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
        dot: 'bg-rose-500',
      };
    }
    if (['частичный ответ'].includes(s)) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
        dot: 'bg-amber-500',
      };
    }
    if (['передано другому', 'передано'].includes(s)) {
      return {
        bg: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
        dot: 'bg-purple-500',
      };
    }
    if (['на паузе', 'не требуется', 'не актуальный'].includes(s)) {
      return {
        bg: 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200',
        dot: 'bg-slate-400',
      };
    }
    if (s) {
      return {
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
        dot: 'bg-indigo-500',
      };
    }
    return {
      bg: 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600',
      dot: 'bg-slate-300',
    };
  };

  const style = getStyle(value);
  const mergedOptions = value && !options.includes(value) ? [...options, value] : options;

  return (
    <div className="relative inline-flex items-center w-full">
      <span className={`w-2 h-2 rounded-full absolute left-2.5 pointer-events-none ${style.dot}`} />
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none pl-6 pr-6 py-1 text-xs font-medium rounded-full border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${style.bg}`}
      >
        <option value="" className="bg-white text-slate-500">
          — Выбрать —
        </option>
        {mergedOptions.map((opt) => (
          <option key={opt} value={opt} className="bg-white text-slate-800">
            {opt}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-[10px] opacity-60">▼</span>
    </div>
  );
}

function ColTextFilter({
  value,
  onChange,
  placeholder = 'Фильтр...',
  listId,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  listId?: string;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        list={listId}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2 py-1 text-[11px] font-normal normal-case tracking-normal rounded border transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
          value ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900' : 'bg-white border-slate-200 text-slate-600'
        }`}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-700"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

function ColSelectFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-1.5 py-1 text-[11px] font-normal normal-case tracking-normal rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
        value ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-medium' : 'bg-white border-slate-200 text-slate-600'
      }`}
    >
      <option value="">Все</option>
      <option value="__EMPTY__">(Пусто)</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

const matchStatusFilter = (itemStatus: string, filterVal: string) => {
  if (!filterVal) return true;
  if (filterVal === '__EMPTY__') return !itemStatus;
  return (itemStatus || '').toLowerCase() === filterVal.toLowerCase();
};

const handlePasteImage = (e: any, callback: (img: string) => void) => {
  const clipboardData = e.clipboardData || e.originalEvent?.clipboardData;
  if (!clipboardData) return;

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event: any) => {
      const compressed = await compressImageDataUrl(event.target.result);
      callback(compressed);
    };
    reader.readAsDataURL(file);
  };

  if (clipboardData.items) {
    let foundImage = false;
    for (const item of clipboardData.items) {
      if (item.type && item.type.indexOf('image') === 0) {
        if (!foundImage) {
          e.preventDefault();
          e.stopPropagation();
          foundImage = true;
        }
        const file = item.getAsFile();
        if (file) processFile(file);
      }
    }
    if (foundImage) return;
  }

  if (clipboardData.files && clipboardData.files.length > 0) {
    let foundImage = false;
    for (const file of Array.from(clipboardData.files) as File[]) {
      if (file.type && file.type.indexOf('image') === 0) {
        if (!foundImage) {
          e.preventDefault();
          e.stopPropagation();
          foundImage = true;
        }
        processFile(file);
      }
    }
  }
};

function ImageCell({
  src,
  onChange,
  onPreview,
}: {
  src: string | string[];
  onChange: (val: string[]) => void;
  onPreview: (images: string[], startIndex: number, onSaveEdited: (idx: number, newUrl: string) => void) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const images = normalizeScreenshots(src);

  const handleAddImage = (newImg: string) => {
    onChange([...images, newImg]);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    onChange(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSaveEditedAt = (idx: number, newUrl: string) => {
    const next = [...images];
    next[idx] = newUrl;
    onChange(next);
  };

  const processFileList = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type && f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    const compressedList: string[] = [];
    for (const file of imageFiles) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev: any) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      });
      const compressed = await compressImageDataUrl(dataUrl);
      compressedList.push(compressed);
    }
    onChange([...images, ...compressedList]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFileList(files);
    e.target.value = '';
  };

  const handleDropFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    await processFileList(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingOver) setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
      }}
      onDrop={handleDropFiles}
      className={`flex flex-col items-center gap-1.5 p-1 rounded-lg transition-colors ${
        isDraggingOver ? 'bg-indigo-100/80 ring-2 ring-indigo-500 border-dashed' : ''
      }`}
    >
      {images.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[170px]">
          {images.map((imgSrc, idx) => (
            <div key={idx} className="relative inline-block group/img">
              <img
                src={imgSrc}
                alt={`Скриншот ${idx + 1}`}
                onClick={() => onPreview(images, idx, handleSaveEditedAt)}
                className="h-11 w-14 object-cover rounded border border-slate-200 cursor-zoom-in shadow-xs hover:border-indigo-400 transition-colors"
                title="Нажмите для просмотра, пометок или копирования"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage(idx);
                }}
                className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity shadow"
                title="Удалить скриншот"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-1">
        <div
          ref={boxRef}
          tabIndex={0}
          onClick={() => boxRef.current?.focus()}
          onPaste={(e) => handlePasteImage(e, handleAddImage)}
          className="text-[10px] text-slate-400 py-1 px-2 border border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:text-indigo-600 focus:border-indigo-600 focus:bg-indigo-50/70 focus:text-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer transition-all select-none"
          title="Кликните и нажмите Ctrl+V или перетащите файлы сюда мышкой"
        >
          {isDraggingOver ? 'Отпустите...' : images.length > 0 ? '+ Ctrl+V / Drop' : 'Ctrl+V / Drop'}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-200 transition-colors"
          title="Выбрать файлы с компьютера"
        >
          <ImageIcon size={13} />
        </button>
      </div>
    </div>
  );
}

const exportToCSV = (data: any[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data
    .map((row) =>
      Object.values(row)
        .map((val) => `"${String(val || '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
  const blob = new Blob(['\uFEFF' + headers + '\n' + rows], {
    type: 'text/csv;charset=utf-8;',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

// === 5. СТРУКТУРА РАЗДЕЛОВ, ЗАДАЧ, РАЗРЕШЕНИЙ И ИСХОДНЫХ ФАЙЛОВ ===

const DEFAULT_TASK_STATUSES = [
  'выполнено',
  'в работе',
  'на паузе',
  'передано другому',
  'не требуется',
  'требует исправления',
];

const PERMISSION_STATUS_OPTIONS = [
  'отправили на согласование',
  'одобрен',
  'требует исправления',
  'не требуется',
];

const PROJECT_SECTIONS_TEMPLATE = [
  {
    code: '1',
    title: '1. Данные для проектирования',
    tasks: [
      { code: '1.1', name: 'Проверка уровней: 0.00 здание / благоустройство / инфраструктура / тротуар, дорога / мусорная комната' },
      { code: '1.2', name: 'Нанесение деревьев на сохранение' },
      { code: '1.3', name: 'Маркировка толщины стяжки согласно архитектуре' },
      { code: '1.4', name: 'Первый лист' },
      { code: '1.5', name: 'Подготовка городской инфраструктуры на масштабе 1:250' },
      { code: '1.6', name: 'Подготовка городской инфраструктуры на масштабе 1:100' },
      { code: '1.7', name: 'Маркировка электрического кабеля' },
      { code: '1.8', name: 'Проверка резервуаров воды' },
    ],
  },
  {
    code: '2',
    title: '2. Листы',
    tasks: [
      { code: '2.1', name: 'Лист Meeting' },
      { code: '2.2', name: 'Лист Connections' },
      { code: '2.3', name: 'Лист Hagasha' },
      { code: '2.4', name: 'Листы SDWF' },
      { code: '2.5', name: 'Листы SD' },
      { code: '2.6', name: 'Листы WF' },
      { code: '2.7', name: 'Листы SPR' },
      { code: '2.8', name: 'Лист DTL-WF' },
      { code: '2.9', name: 'Лист DTL-SD' },
      { code: '2.10', name: 'Подготовка Drawing Index' },
    ],
  },
  {
    code: '3',
    title: '3. Revit',
    tasks: [
      { code: '3.1', name: 'Настройка видов в масштабе 1:100' },
      { code: '3.2', name: 'Настройка видов в масштабе 1:50' },
    ],
  },
  {
    code: '4',
    title: '4. Подключение участка к городским сетям',
    tasks: [
      { code: '4.1', name: 'Подключение к городскому водопроводу' },
      { code: '4.2', name: 'Подключение к городской канализации' },
    ],
  },
  {
    code: '5',
    title: '5. Управление поверхностным ливневым стоком',
    tasks: [
      { code: '5.1', name: 'Ознакомление с отчетом гидролога' },
      { code: '5.2', name: 'Подготовка схемы управления поверхностным стоком' },
      { code: '5.3', name: 'Конечное решение по ливневым колодцам на плане' },
    ],
  },
  {
    code: '6',
    title: '6. Вертикали',
    tasks: [
      { code: '6.1', name: 'Расстановка стояков канализации' },
      { code: '6.2', name: 'Расстановка сепарейтов' },
      { code: '6.3', name: 'Подъем фановых стояков до крыши' },
      { code: '6.4', name: 'Расстановка стояков грязной воды' },
      { code: '6.5', name: 'Расстановка стояков ливневой канализации от крыш' },
      { code: '6.6', name: 'Расстановка стояков ливневой канализации от балконов' },
      { code: '6.7', name: 'Дренаж сада' },
      { code: '6.8', name: 'Сантехнический шкаф (расстановка и маркировка труб, проверка места и размеров, расстановка оборудования)' },
      { code: '6.9', name: 'Расстановка пожарного райзера на лестничной клетке + кран' },
      { code: '6.10', name: 'Райзеры воды, пожаротушения, спринклеров и их оборудование вне сантехнического шкафа' },
      { code: '6.11', name: 'Расстановка райзеров горячей воды' },
      { code: '6.12', name: 'Расстановка бойллеров' },
      { code: '6.13', name: 'Расстановка стояков для дренажа газа' },
      { code: '6.14', name: 'Расстановка стояков для промышленной канализации' },
    ],
  },
  {
    code: '7',
    title: '7. Расстановка солнечных панелей',
    tasks: [{ code: '7.1', name: 'Расстановка солнечных панелей' }],
  },
  {
    code: '8',
    title: '8. Сбор и прокладка труб под потолком',
    tasks: [
      { code: '8.1', name: 'Прокладка труб канализации' },
      { code: '8.2', name: 'Прокладка труб грязной воды' },
      { code: '8.3', name: 'Прокладка труб ливневой канализации от крыш и балконов' },
      { code: '8.4', name: 'Прокладка труб ливневой канализации от благоустройства' },
      { code: '8.5', name: 'Прокладка магистральных труб воды, пожаротушения, спринклеров' },
      { code: '8.6', name: 'Прокладка напорных труб от насосных приямков' },
      { code: '8.7', name: 'Прокладка труб промышленной канализации' },
    ],
  },
  {
    code: '9',
    title: '9. Дренаж подвала',
    tasks: [
      { code: '9.1', name: 'Дренажный ливневой лоток на рампе' },
      { code: '9.2', name: 'Дренажные лотки грязной канализации' },
      { code: '9.3', name: 'Трассировка труб под полом подвала' },
      { code: '9.4', name: 'Дренажные колодцы' },
    ],
  },
  {
    code: '10',
    title: '10. Насосные приямки и оборудование для них',
    tasks: [
      { code: '10.1', name: 'Определение местоположения канализационных насосных приямков и их оборудования' },
      { code: '10.2', name: 'Определение параметров для канализационных насосов (производительность, давление, электрическая нагрузка)' },
      { code: '10.3', name: 'Определение местоположения ливневых насосных приямков и их оборудования' },
      { code: '10.4', name: 'Определение параметров для ливневых насосов (производительность, давление, электрическая нагрузка)' },
      { code: '10.5', name: 'Определение местоположения насосных приямков грязной воды и их оборудования' },
      { code: '10.6', name: 'Определение параметров для насосов грязной воды (производительность, давление, электрическая нагрузка)' },
      { code: '10.7', name: 'Сбор электрических нагрузок для электрика' },
    ],
  },
  {
    code: '11',
    title: '11. Узлы',
    tasks: [
      { code: '11.1', name: 'Узел ММ-01' },
      { code: '11.2', name: 'Узел ММ-02' },
      { code: '11.3', name: 'Узел WFP' },
      { code: '11.4', name: 'Узел SG' },
      { code: '11.5', name: 'Узел SDP' },
      { code: '11.6', name: 'Узел WI' },
      { code: '11.7', name: 'Профиль канализации' },
      { code: '11.8', name: 'Профиль ливневой канализации' },
      { code: '11.9', name: 'Узел жироуловителя' },
    ],
  },
  {
    code: '12',
    title: '12. Схемы',
    tasks: [
      { code: '12.1', name: 'Схема воды' },
      { code: '12.2', name: 'Схема канализации' },
      { code: '12.3', name: 'Схема дождевой канализации' },
    ],
  },
  {
    code: '13',
    title: '13. Проектирование воды в квартирах',
    tasks: [
      { code: '13.1', name: 'Выбор материала труб в квартирах' },
      { code: '13.2', name: 'Расстановка точек воды в квартирах' },
      { code: '13.3', name: 'Трассировка труб воды к точкам' },
    ],
  },
  {
    code: '14',
    title: '14. Подключение сан-тех приборов к канализации',
    tasks: [
      { code: '14.1', name: 'Материал труб для канализации' },
      { code: '14.2', name: 'Подключение приборов к стоякам канализации' },
      { code: '14.3', name: 'Подключение дренажа бойллеров' },
      { code: '14.4', name: 'Расстановка трапов в сантехнических шкафах и на мистор квиса' },
      { code: '14.5', name: 'Дренаж кондиционеров' },
    ],
  },
  {
    code: '15',
    title: '15. Подключение ливневых трапов',
    tasks: [
      { code: '15.1', name: 'Выбор материала труб для ливневой канализации' },
      { code: '15.2', name: 'Подключение ливневых трапов к стоякам ливневой канализации' },
    ],
  },
  {
    code: '16',
    title: '16. Спринклеры',
    tasks: [
      { code: '16.1', name: 'Расстановка спринклеров' },
      { code: '16.2', name: 'Трассировка труб' },
      { code: '16.3', name: 'Определение местоположения спринклерных станций' },
      { code: '16.4', name: 'Грубый гидравлический расчёт' },
      { code: '16.5', name: 'Подробный гидравлический расчёт' },
    ],
  },
  {
    code: '17',
    title: '17. Гильзы и отверстия',
    tasks: [
      { code: '17.1', name: 'Гильзы и отверстия для канализационных труб' },
      { code: '17.2', name: 'Гильзы и отверстия для грязных труб' },
      { code: '17.3', name: 'Гильзы и отверстия для ливневых труб' },
      { code: '17.4', name: 'Гильзы и отверстия для труб воды и пожарки' },
      { code: '17.5', name: 'Гильзы и отверстия для спринклерных труб' },
      { code: '17.6', name: 'Гильзы и отверстия для напорных систем' },
    ],
  },
];

const createTasksFromTemplate = (existingTasks: any[] = []) => {
  const result: any[] = [];
  PROJECT_SECTIONS_TEMPLATE.forEach((sec) => {
    result.push({
      code: sec.code,
      name: `📋 ${sec.title}`,
      isHeader: true,
      building: '',
      status: '',
      priority: '',
      estHours: '',
      date: '',
      comment: '',
      todayPlan: false,
    });
    sec.tasks.forEach((t) => {
      const matched = existingTasks.find(
        (old) =>
          !old.isHeader &&
          !old.building &&
          (old.code === t.code ||
            (old.name || '').trim().toLowerCase() === t.name.trim().toLowerCase())
      );
      result.push({
        code: t.code,
        name: t.name,
        isHeader: false,
        building: '',
        status: matched ? matched.status : '',
        priority: matched ? matched.priority || '' : '',
        estHours: matched ? matched.estHours || '' : '',
        date: matched ? matched.date : '',
        comment: matched ? matched.comment : '',
        todayPlan: Boolean(matched?.todayPlan),
      });
    });
  });

  let inCustomOrBuildingSection = false;
  existingTasks.forEach((old) => {
    if (old.isHeader) {
      inCustomOrBuildingSection = Boolean(old.isCustomSection || old.building);
      if (inCustomOrBuildingSection) {
        result.push(old);
      }
    } else if (inCustomOrBuildingSection || old.isCustom || old.building) {
      result.push(old);
    }
  });

  return result;
};

const DEFAULT_FILES = [
  'MSM',
  'Архитектура',
  '1-ый лист',
  'Проект safety',
  'Конструкция',
  'Проект HVAC',
].map((f) => ({ name: f, status: '', date: '', comment: '' }));

const PERMISSIONS_TEMPLATE = [
  { name: '1) Разрешение от городского комитета на строительство', isGroup: false },
  { name: '2) Разрешение на вертикали:', isGroup: true },
  { name: '2.1) От архитектора', isGroup: false, indent: true },
  { name: '2.2) От конструктора', isGroup: false, indent: true },
  { name: '2.3) От акустика', isGroup: false, indent: true },
  { name: '3) Разрешение на насосные приямки от конструктора', isGroup: false },
  { name: '4) Разрешение на напорные краны:', isGroup: true },
  { name: '4.1) От архитектора', isGroup: false, indent: true },
  { name: '4.2) От парковщика', isGroup: false, indent: true },
  { name: '5) Разрешение подключения от корпорации', isGroup: false },
  { name: '6) Разрешение ниспах:', isGroup: true },
  { name: '6.1) От корпорации', isGroup: false, indent: true },
  { name: '6.2) От контрольного института', isGroup: false, indent: true },
  { name: '6.3) От министерства здравоохранения', isGroup: false, indent: true },
  { name: '6.4) Разрешение ниспах никуз', isGroup: false, indent: true },
  { name: '7) Одобрение схемы от гидролога', isGroup: false },
];

const createPermissionsFromTemplate = (existingPerms: any[] = []) => {
  return PERMISSIONS_TEMPLATE.map((tpl) => {
    const matched = existingPerms.find(
      (old) =>
        !old.isGroup &&
        (old.name || '').trim().toLowerCase() === tpl.name.trim().toLowerCase()
    );
    return {
      name: tpl.name,
      isGroup: Boolean(tpl.isGroup),
      indent: Boolean(tpl.indent),
      status: matched ? matched.status || '' : '',
      date: matched ? matched.date || '' : '',
      comment: matched ? matched.comment || '' : '',
    };
  });
};

const DEFAULT_PERMISSIONS = createPermissionsFromTemplate();

const createSystemProject0000 = () => ({
  id: 'system_0000',
  num: '0000',
  name: 'Внутренние задачи / Методички / Разработка программ',
  stage: 'Внутренняя работа',
  deadline: '',
  team: '',
  comment: '',
  noChecklist: true,
  archived: false,
  buildings: [],
  blockers: [],
  customStatuses: [],
  tasks: [],
  files: [],
  permissions: [],
  remarks: [],
  revisions: [],
});

const isProjectWithoutChecklist = (proj: any) =>
  Boolean(proj?.noChecklist) || (proj?.num || '').trim() === '0000';

const calcProjectProgress = (proj: any) => {
  if (isProjectWithoutChecklist(proj)) return 0;
  const tasks = proj.tasks || [];
  const actionable = tasks.filter((t: any) => !t.isHeader && t.status !== 'не требуется');
  const completed = actionable.filter((t: any) => t.status === 'выполнено');
  return actionable.length > 0 ? Math.round((completed.length / actionable.length) * 100) : 0;
};

const calcProjectRemainingHours = (proj: any) => {
  if (isProjectWithoutChecklist(proj)) return 0;
  const tasks = proj.tasks || [];
  let sum = 0;
  tasks.forEach((t: any) => {
    if (!t.isHeader && t.status !== 'не требуется' && t.status !== 'выполнено') {
      sum += parseFloat(String(t.estHours || '').replace(',', '.')) || 0;
    }
  });
  return Number(sum.toFixed(1));
};

// === 6. ГЛОБАЛЬНЫЙ ПОИСК (CTRL + K) ===

function GlobalSearchModal({
  projects,
  meetings,
  tasks,
  onClose,
  onSelectProject,
  onNavigateTab,
}: {
  projects: any[];
  meetings: any[];
  tasks: any[];
  onClose: () => void;
  onSelectProject: (projectId: string, subTab?: 'tasks' | 'remarks' | 'docs' | 'related' | 'revisions') => void;
  onNavigateTab: (tabId: number, filterNum?: string) => void;
}) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const list: Array<{
      id: string;
      category: string;
      badgeColor: string;
      title: string;
      subtitle: string;
      onClick: () => void;
    }> = [];

    projects.forEach((p) => {
      const archTag = p.archived ? ' [АРХИВ]' : '';
      if (
        (p.num || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.stage || '').toLowerCase().includes(q) ||
        (p.team || '').toLowerCase().includes(q)
      ) {
        list.push({
          id: `proj-${p.id}`,
          category: `Проект${archTag}`,
          badgeColor: p.archived ? 'bg-slate-200 text-slate-700' : 'bg-indigo-100 text-indigo-800',
          title: `Проект #${p.num}${p.name ? ` — ${p.name}` : ''}`,
          subtitle: [p.stage, p.team].filter(Boolean).join(' • ') || 'Открыть карточку проекта',
          onClick: () => {
            onSelectProject(p.id, isProjectWithoutChecklist(p) ? 'related' : 'tasks');
            onClose();
          },
        });
      }

      if (!isProjectWithoutChecklist(p)) {
        (p.tasks || []).forEach((t: any, idx: number) => {
          if (t.isHeader) return;
          if (
            (t.name || '').toLowerCase().includes(q) ||
            (t.code || '').toLowerCase().includes(q) ||
            (t.comment || '').toLowerCase().includes(q) ||
            (t.building || '').toLowerCase().includes(q)
          ) {
            list.push({
              id: `ptask-${p.id}-${idx}`,
              category: `Чек-лист #${p.num}${archTag}`,
              badgeColor: 'bg-emerald-100 text-emerald-800',
              title: `${t.building ? `[${t.building}] ` : ''}${t.code ? `${t.code} ` : ''}${t.name}`,
              subtitle: `Статус: ${t.status || 'не задан'}${t.comment ? ` • ${t.comment}` : ''}`,
              onClick: () => {
                onSelectProject(p.id, 'tasks');
                onClose();
              },
            });
          }
        });
      }

      (p.remarks || []).forEach((r: any) => {
        if (
          (r.desc || '').toLowerCase().includes(q) ||
          (r.to || '').toLowerCase().includes(q) ||
          (r.resolution || '').toLowerCase().includes(q)
        ) {
          list.push({
            id: `rem-${p.id}-${r.id}`,
            category: `Замечание #${p.num}${archTag}`,
            badgeColor: 'bg-amber-100 text-amber-800',
            title: r.desc || '(без описания)',
            subtitle: [r.to ? `Кому/От: ${r.to}` : '', r.status ? `Статус: ${r.status}` : '']
              .filter(Boolean)
              .join(' • '),
            onClick: () => {
              onSelectProject(p.id, 'remarks');
              onClose();
            },
          });
        }
      });

      (p.revisions || []).forEach((rev: any) => {
        if (
          (rev.version || '').toLowerCase().includes(q) ||
          (rev.recipient || '').toLowerCase().includes(q) ||
          (rev.comment || '').toLowerCase().includes(q) ||
          (rev.stage || '').toLowerCase().includes(q)
        ) {
          list.push({
            id: `rev-${p.id}-${rev.id}`,
            category: `Выдача модели #${p.num}${archTag}`,
            badgeColor: 'bg-purple-100 text-purple-800',
            title: `${rev.stage || 'Передача'} — ${rev.version || rev.format || 'Файл'}`,
            subtitle: [rev.recipient ? `Кому: ${rev.recipient}` : '', rev.date].filter(Boolean).join(' • '),
            onClick: () => {
              onSelectProject(p.id, 'revisions');
              onClose();
            },
          });
        }
      });
    });

    meetings.forEach((m) => {
      if (
        (m.desc || '').toLowerCase().includes(q) ||
        (m.fix || '').toLowerCase().includes(q) ||
        (m.comment || '').toLowerCase().includes(q) ||
        (m.projectNum || '').toLowerCase().includes(q)
      ) {
        list.push({
          id: `mtg-${m.id}`,
          category: `Встреча ${m.projectNum ? `#${m.projectNum}` : ''}`,
          badgeColor: 'bg-sky-100 text-sky-800',
          title: m.desc || m.fix || '(запись встречи)',
          subtitle: [
            m.date ? `Встреча: ${m.date}` : '',
            m.dueDate ? `Срок: ${m.dueDate}` : '',
            m.status,
          ]
            .filter(Boolean)
            .join(' • '),
          onClick: () => {
            onNavigateTab(1, m.projectNum || '');
            onClose();
          },
        });
      }
    });

    tasks.forEach((t) => {
      if (
        (t.desc || '').toLowerCase().includes(q) ||
        (t.comment || '').toLowerCase().includes(q) ||
        (t.project || '').toLowerCase().includes(q)
      ) {
        list.push({
          id: `qtask-${t.id}`,
          category: `Задача ${t.project ? `#${t.project}` : ''}`,
          badgeColor: 'bg-slate-200 text-slate-800',
          title: t.desc || '(без описания)',
          subtitle: [t.estDate ? `Дедлайн: ${t.estDate}` : '', t.status].filter(Boolean).join(' • '),
          onClick: () => {
            onNavigateTab(4, t.project || '');
            onClose();
          },
        });
      }
    });

    return list.slice(0, 40);
  }, [query, projects, meetings, tasks, onClose, onSelectProject, onNavigateTab]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-16 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden"
      >
        <div className="p-3.5 border-b border-slate-200 flex items-center gap-3">
          <Search size={18} className="text-indigo-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по активным и архивным проектам, корпусам, чек-листам, встречам..."
            className="w-full text-sm text-slate-800 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded bg-slate-100"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {!query.trim() ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Введите номер проекта, корпус (Здание A), название узла, смежника или текст замечания...
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              По запросу «{query}» ничего не найдено.
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="w-full text-left px-4 py-3 hover:bg-indigo-50/60 transition-colors flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.badgeColor}`}>
                      {item.category}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate">{item.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                </div>
                <ArrowUpRight size={15} className="text-slate-300 shrink-0 mt-1" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// === 7. ВКЛАДКА 0: СВОДКА, ПЛАН НА СЕГОДНЯ И КАЛЕНДАРЬ ПЛАНИРОВАНИЯ ===

function TabOverviewCalendar({
  projects,
  setProjects,
  meetings,
  setMeetings,
  tasks,
  calendarEvents,
  setCalendarEvents,
  onOpenProject,
  onNavigateWithFilter,
}: any) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayDMY, setSelectedDayDMY] = useState<string>(getTodayDMY());
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventProject, setNewEventProject] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [focusProjectFilter, setFocusProjectFilter] = useState('');
  const [onlyTodayPlan, setOnlyTodayPlan] = useState(false);

  const [showSources, setShowSources] = useState({
    deadlines: true,
    tasks: true,
    meetings: true,
    custom: true,
  });

  const activeProjects = useMemo(
    () => projects.filter((p: any) => !p.archived),
    [projects]
  );

  const focusItems = useMemo(() => {
    const list: Array<{
      kind: 'checklist' | 'meeting';
      uid: string;
      projectId?: string;
      meetingId?: any;
      projectNum: string;
      projectName: string;
      building?: string;
      taskIndex?: number;
      code: string;
      name: string;
      dueDate: string;
      status: string;
      priority: string;
      estHours: number;
      comment: string;
      todayPlan: boolean;
    }> = [];

    const selectedProjObj = focusProjectFilter
      ? activeProjects.find((p: any) => p.id === focusProjectFilter)
      : null;

    activeProjects.forEach((p: any) => {
      if (isProjectWithoutChecklist(p)) return;
      if (focusProjectFilter && p.id !== focusProjectFilter) return;
      (p.tasks || []).forEach((t: any, idx: number) => {
        if (t.isHeader) return;
        const st = (t.status || '').toLowerCase();
        const isTodayFlagged = Boolean(t.todayPlan);
        if (st === 'в работе' || st === 'требует исправления' || (isTodayFlagged && st !== 'выполнено' && st !== 'не требуется')) {
          list.push({
            kind: 'checklist',
            uid: `chk-${p.id}-${idx}`,
            projectId: p.id,
            projectNum: p.num,
            projectName: p.name || '',
            building: t.building || '',
            taskIndex: idx,
            code: t.code || '',
            name: t.name,
            dueDate: '',
            status: t.status || 'в работе',
            priority: String(t.priority || '').trim(),
            estHours: parseFloat(String(t.estHours || '').replace(',', '.')) || 0,
            comment: t.comment || '',
            todayPlan: isTodayFlagged,
          });
        }
      });
    });

    (meetings || []).forEach((m: any) => {
      const st = (m.status || '').toLowerCase();
      if (['исправлено', 'не требуется', 'на паузе'].includes(st)) return;
      const isTodayFlagged = Boolean(m.todayPlan);
      if (!m.dueDate && st !== 'в работе' && !isTodayFlagged) return;
      if (selectedProjObj && (m.projectNum || '').trim() !== (selectedProjObj.num || '').trim()) {
        return;
      }

      const matchedProj = activeProjects.find(
        (p: any) => (p.num || '').trim() === (m.projectNum || '').trim()
      );
      const titleText =
        m.fix && m.desc
          ? `${m.fix} (${m.desc})`
          : m.fix || m.desc || '(Пункт встречи без описания)';

      list.push({
        kind: 'meeting',
        uid: `mtg-${m.id}`,
        meetingId: m.id,
        projectId: matchedProj?.id,
        projectNum: m.projectNum || '—',
        projectName: matchedProj?.name || '',
        code: 'Встреча',
        name: titleText,
        dueDate: m.dueDate || '',
        status: m.status || 'в работе',
        priority: '',
        estHours: 0,
        comment: m.comment || (m.date ? `Встреча от ${formatToDMY(m.date)}` : ''),
        todayPlan: isTodayFlagged,
      });
    });

    const filteredByToday = onlyTodayPlan ? list.filter((item) => item.todayPlan) : list;

    return filteredByToday.sort((a, b) => {
      if (a.todayPlan !== b.todayPlan) return a.todayPlan ? -1 : 1;
      const dA = parseDateObj(a.dueDate);
      const dB = parseDateObj(b.dueDate);
      if (dA && dB) return dA.getTime() - dB.getTime();
      if (dA && !dB) return -1;
      if (!dA && dB) return 1;

      if (!a.priority && !b.priority) return 0;
      if (!a.priority) return 1;
      if (!b.priority) return -1;
      return a.priority.localeCompare(b.priority, 'ru', { numeric: true });
    });
  }, [activeProjects, meetings, focusProjectFilter, onlyTodayPlan]);

  const totalFocusHours = useMemo(
    () => Number(focusItems.reduce((acc, item) => acc + item.estHours, 0).toFixed(1)),
    [focusItems]
  );

  const handleToggleTodayPlanOnFocus = (item: any) => {
    if (item.kind === 'meeting') {
      setMeetings(
        meetings.map((m: any) =>
          m.id === item.meetingId ? { ...m, todayPlan: !m.todayPlan } : m
        )
      );
      return;
    }

    setProjects(
      projects.map((p: any) => {
        if (p.id !== item.projectId) return p;
        const updatedTasks = [...(p.tasks || [])];
        if (updatedTasks[item.taskIndex]) {
          updatedTasks[item.taskIndex] = {
            ...updatedTasks[item.taskIndex],
            todayPlan: !updatedTasks[item.taskIndex].todayPlan,
          };
        }
        return { ...p, tasks: updatedTasks };
      })
    );
  };

  const handleQuickUpdateFocusStatus = (item: any, newStatus: string) => {
    if (item.kind === 'meeting') {
      setMeetings(
        meetings.map((m: any) => (m.id === item.meetingId ? { ...m, status: newStatus } : m))
      );
      return;
    }

    setProjects(
      projects.map((p: any) => {
        if (p.id !== item.projectId) return p;
        const updatedTasks = [...(p.tasks || [])];
        if (updatedTasks[item.taskIndex]) {
          updatedTasks[item.taskIndex] = {
            ...updatedTasks[item.taskIndex],
            status: newStatus,
            date:
              newStatus && !updatedTasks[item.taskIndex].date
                ? getTodayDMY()
                : updatedTasks[item.taskIndex].date,
          };
        }
        return { ...p, tasks: updatedTasks };
      })
    );
  };

  const eventsByDate: Record<
    string,
    Array<{
      id: string;
      type: 'deadline' | 'task' | 'meeting' | 'custom';
      title: string;
      time?: string;
      projectNum: string;
      status?: string;
      rawId?: any;
      projectId?: string;
    }>
  > = {};

  const pushEvent = (dateStr: string, item: any) => {
    const dmy = formatToDMY(dateStr);
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) return;
    if (!eventsByDate[dmy]) eventsByDate[dmy] = [];
    eventsByDate[dmy].push(item);
  };

  if (showSources.deadlines) {
    activeProjects.forEach((p: any) => {
      if (p.deadline) {
        pushEvent(p.deadline, {
          id: `proj-${p.id}`,
          type: 'deadline',
          title: `Дедлайн этапа${p.stage ? ` (${p.stage})` : ''}${p.name ? `: ${p.name}` : ''}`,
          projectNum: p.num,
          projectId: p.id,
        });
      }
    });
  }

  if (showSources.tasks) {
    tasks.forEach((t: any) => {
      if (t.estDate) {
        pushEvent(t.estDate, {
          id: `task-${t.id}`,
          type: 'task',
          title: t.desc || '(Задача без описания)',
          projectNum: t.project || '',
          status: t.status,
        });
      }
    });
  }

  if (showSources.meetings) {
    meetings.forEach((m: any) => {
      const targetCalendarDate = m.dueDate || m.date;
      if (targetCalendarDate) {
        const labelPrefix = m.dueDate ? 'Сделать по встрече: ' : 'Встреча: ';
        pushEvent(targetCalendarDate, {
          id: `mtg-${m.id}`,
          type: 'meeting',
          title: `${labelPrefix}${m.fix || m.desc || '(без описания)'}`,
          projectNum: m.projectNum || '',
          status: m.status,
        });
      }
    });
  }

  if (showSources.custom) {
    calendarEvents.forEach((ev: any) => {
      if (ev.date) {
        pushEvent(ev.date, {
          id: `custom-${ev.id}`,
          type: 'custom',
          title: ev.title,
          time: ev.time || '',
          projectNum: ev.projectNum || '',
          rawId: ev.id,
        });
      }
    });
  }

  const handleAddCalendarEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !selectedDayDMY) return;
    setCalendarEvents([
      ...calendarEvents,
      {
        id: Date.now(),
        date: selectedDayDMY,
        time: newEventTime.trim(),
        projectNum: newEventProject.trim(),
        title: newEventTitle.trim(),
        notified: false,
      },
    ]);
    setNewEventTitle('');
    setNewEventTime('');
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const calendarCells: Array<{ dayNum: number | null; dmy: string }> = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      calendarCells.push({ dayNum: null, dmy: '' });
    } else {
      const dmy = `${String(dayNum).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
      calendarCells.push({ dayNum, dmy });
    }
  }

  const monthNames = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];

  const todayDMY = getTodayDMY();
  const todayEvents = eventsByDate[todayDMY] || [];
  const selectedDayEvents = eventsByDate[selectedDayDMY] || [];

  const urgentProjects = activeProjects.filter((p: any) => {
    const u = getDeadlineUrgency(p.deadline);
    return u === 'overdue' || u === 'soon';
  });

  const urgentMeetingsCount = meetings.filter((m: any) => {
    if ((m.status || '').toLowerCase() === 'исправлено') return false;
    const u = getDeadlineUrgency(m.dueDate);
    return u === 'overdue' || u === 'soon';
  }).length;

  const staleRemarksCount = activeProjects.reduce((acc: number, p: any) => {
    const stale = (p.remarks || []).filter((r: any) => {
      const st = (r.status || '').toLowerCase();
      if (!['отправлен', 'частичный ответ'].includes(st)) return false;
      const days = getDaysSinceDate(r.dateSent || r.date);
      return days !== null && days >= 5;
    });
    return acc + stale.length;
  }, 0);

  const totalActiveBlockers = activeProjects.reduce(
    (acc: number, p: any) => acc + (p.blockers || []).filter((b: any) => !b.resolved).length,
    0
  );
  const totalOpenRemarks = activeProjects.reduce(
    (acc: number, p: any) =>
      acc +
      (p.remarks || []).filter(
        (r: any) => !['решен', 'не актуальный'].includes((r.status || '').toLowerCase())
      ).length,
    0
  );
  const totalOpenQuickTasks = tasks.filter(
    (t: any) => !['выполнена', 'выполнено'].includes((t.status || '').toLowerCase())
  ).length;

  const getBadgeStyle = (type: string) => {
    if (type === 'deadline') return 'bg-rose-100 text-rose-800 border-rose-200';
    if (type === 'task') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (type === 'meeting') return 'bg-sky-100 text-sky-800 border-sky-200';
    return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  };

  const getTypeLabel = (type: string) => {
    if (type === 'deadline') return 'Дедлайн';
    if (type === 'task') return 'Задача';
    if (type === 'meeting') return 'Встреча';
    return 'План';
  };

  return (
    <div className="space-y-6">
      {(todayEvents.length > 0 || urgentProjects.length > 0 || urgentMeetingsCount > 0 || staleRemarksCount > 0) && (
        <div className="bg-gradient-to-r from-indigo-50 via-white to-amber-50/70 rounded-xl border border-indigo-200/80 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
              <BellRing size={15} /> Сводка на сегодня ({todayDMY})
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-700">
              <span>
                Запланировано на сегодня: <b>{todayEvents.length}</b>
              </span>
              {urgentProjects.length > 0 && (
                <span className="text-rose-700 font-medium">
                  Горят / просрочены дедлайны этапов: <b>{urgentProjects.map((p: any) => `#${p.num}`).join(', ')}</b>
                </span>
              )}
              {urgentMeetingsCount > 0 && (
                <span className="text-sky-800 font-medium">
                  Срочные пункты со встреч: <b>{urgentMeetingsCount}</b>
                </span>
              )}
              {staleRemarksCount > 0 && (
                <span className="text-amber-800 font-medium">
                  Замечаний без ответа &gt; 5 дней: <b>{staleRemarksCount}</b>
                </span>
              )}
            </div>
          </div>

          {todayEvents.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {todayEvents.slice(0, 3).map((ev) => (
                <span
                  key={ev.id}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${getBadgeStyle(ev.type)}`}
                >
                  {ev.time ? `${ev.time} ` : ''}
                  {ev.projectNum ? `#${ev.projectNum}: ` : ''}
                  {ev.title}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Карточки KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Активных проектов</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{activeProjects.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Активных блокеров</div>
          <div className={`text-2xl font-bold mt-1 ${totalActiveBlockers > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {totalActiveBlockers}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Открытых замечаний / вопросов</div>
          <div className={`text-2xl font-bold mt-1 ${totalOpenRemarks > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
            {totalOpenRemarks}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Быстрых задач в работе</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{totalOpenQuickTasks}</div>
        </div>
      </div>

      {/* В ФОКУСЕ / ПЛАН НА СЕГОДНЯ */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Flame size={17} className="text-amber-500" />
            <h2 className="font-semibold text-sm text-slate-800">
              {onlyTodayPlan ? '★ План на сегодня' : 'В фокусе / Необходимо выполнить'} ({focusItems.length})
            </h2>
            {totalFocusHours > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-1">
                <Clock size={12} /> Суммарно: {totalFocusHours} ч
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyTodayPlan(!onlyTodayPlan)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                onlyTodayPlan
                  ? 'bg-amber-400 text-slate-900 border-amber-500 shadow-xs'
                  : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-200'
              }`}
              title="Показать только задачи, отмеченные звёздочкой на сегодня"
            >
              <Star size={13} className={onlyTodayPlan ? 'fill-slate-900' : 'text-amber-500'} />
              План на сегодня
            </button>

            <select
              value={focusProjectFilter}
              onChange={(e) => setFocusProjectFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none"
            >
              <option value="">Все активные проекты</option>
              {activeProjects.map((p: any) => (
                <option key={p.id} value={p.id}>
                  Проект #{p.num} {p.name ? `— ${p.name}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {focusItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            {onlyTodayPlan
              ? 'На сегодня пока не отмечено ни одной задачи. Нажмите ★ рядом с нужными задачами в чек-листе или встречах.'
              : 'Нет активных пунктов чек-листа или задач со встреч в работе.'}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase z-10">
                <tr>
                  <th className="py-2 px-2 w-8 text-center" title="План на сегодня">★</th>
                  <th className="py-2 px-3 w-28">Проект</th>
                  <th className="py-2 px-2 w-28">Срок / Приоритет</th>
                  <th className="py-2 px-3 min-w-[260px]">Что необходимо выполнить</th>
                  <th className="py-2 px-2 w-20 text-center">Время</th>
                  <th className="py-2 px-3 w-48">Статус (изменить)</th>
                  <th className="py-2 px-3 min-w-[160px]">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {focusItems.map((item) => {
                  const urgency = item.dueDate ? getDeadlineUrgency(item.dueDate) : null;

                  return (
                    <tr
                      key={item.uid}
                      className={
                        item.todayPlan
                          ? 'bg-amber-50/50 hover:bg-amber-100/50'
                          : urgency === 'overdue'
                          ? 'bg-rose-50/60 hover:bg-rose-100/50'
                          : urgency === 'soon'
                          ? 'bg-amber-50/30 hover:bg-amber-100/40'
                          : 'hover:bg-slate-50/80'
                      }
                    >
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleTodayPlanOnFocus(item)}
                          className="p-0.5 rounded hover:bg-amber-100 transition-colors"
                          title={item.todayPlan ? 'Убрать из плана на сегодня' : 'Добавить в план на сегодня'}
                        >
                          <Star
                            size={15}
                            className={
                              item.todayPlan
                                ? 'text-amber-500 fill-amber-400'
                                : 'text-slate-300 hover:text-amber-400'
                            }
                          />
                        </button>
                      </td>
                      <td className="p-2.5">
                        {item.projectId ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenProject(
                                item.projectId,
                                item.kind === 'meeting' ? 'related' : 'tasks'
                              )
                            }
                            className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                            title={`Открыть проект #${item.projectNum}`}
                          >
                            #{item.projectNum}
                            <ArrowUpRight size={12} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateWithFilter(
                                1,
                                item.projectNum !== '—' ? item.projectNum : ''
                              )
                            }
                            className="font-bold text-sky-700 hover:underline"
                          >
                            {item.projectNum !== '—' ? `#${item.projectNum}` : 'Общее'}
                          </button>
                        )}
                      </td>
                      <td className="p-2.5">
                        {item.dueDate ? (
                          <span
                            className={`font-mono px-2 py-0.5 rounded font-semibold ${
                              urgency === 'overdue'
                                ? 'bg-rose-100 text-rose-700'
                                : urgency === 'soon'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-50 text-sky-700 border border-sky-200/70'
                            }`}
                          >
                            {formatToDMY(item.dueDate)}
                          </span>
                        ) : item.priority ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                            {item.priority}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-2.5 font-medium text-slate-700">
                        {item.building && (
                          <span className="inline-block px-1.5 py-0.5 mr-1.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-800">
                            {item.building}
                          </span>
                        )}
                        {item.kind === 'meeting' ? (
                          <span className="inline-block px-1.5 py-0.5 mr-1.5 text-[10px] font-bold rounded bg-sky-100 text-sky-800">
                            Встреча
                          </span>
                        ) : (
                          item.code && (
                            <span className="font-mono text-slate-400 mr-1.5">{item.code}</span>
                          )
                        )}
                        {item.name}
                      </td>
                      <td className="p-2.5 text-center font-mono font-semibold text-slate-700">
                        {item.estHours > 0 ? `${item.estHours} ч` : '—'}
                      </td>
                      <td className="p-2">
                        <StatusPill
                          value={item.status}
                          options={
                            item.kind === 'meeting'
                              ? ['в работе', 'исправлено', 'на паузе', 'передано другому']
                              : DEFAULT_TASK_STATUSES
                          }
                          onChange={(val) => handleQuickUpdateFocusStatus(item, val)}
                        />
                      </td>
                      <td className="p-2.5 text-slate-500 truncate max-w-[220px]" title={item.comment}>
                        {item.comment || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Краткая сводка по активным проектам */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <LayoutGrid size={17} className="text-indigo-600" />
            <h2 className="font-semibold text-sm text-slate-800">Краткая сводка по активным проектам</h2>
          </div>
          <span className="text-xs text-slate-400">Нажмите на карточку проекта, чтобы перейти в него</span>
        </div>

        {activeProjects.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Активных проектов пока нет. Создайте первый проект во вкладке «Статус проекта».
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeProjects.map((p: any) => {
              const noChecklist = isProjectWithoutChecklist(p);
              const pct = calcProjectProgress(p);
              const remHours = calcProjectRemainingHours(p);
              const activeBlockers = (p.blockers || []).filter((b: any) => !b.resolved);
              const openRemarks = (p.remarks || []).filter(
                (r: any) => !['решен', 'не актуальный'].includes((r.status || '').toLowerCase())
              );
              const openTasks = tasks.filter(
                (t: any) =>
                  (t.project || '').trim() === (p.num || '').trim() &&
                  !['выполнена', 'выполнено'].includes((t.status || '').toLowerCase())
              );
              const openMeetings = meetings.filter(
                (m: any) =>
                  (m.projectNum || '').trim() === (p.num || '').trim() &&
                  (m.status || '').toLowerCase() !== 'исправлено'
              );
              const urgency = getDeadlineUrgency(p.deadline);

              return (
                <div
                  key={p.id}
                  onClick={() => onOpenProject(p.id, noChecklist ? 'related' : 'tasks')}
                  className={`p-4 rounded-xl border hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    noChecklist ? 'bg-slate-50/70 border-slate-300/90' : 'bg-white border-slate-200/90'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-indigo-700">Проект #{p.num}</span>
                          {p.stage && (
                            <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 rounded-md">
                              {p.stage}
                            </span>
                          )}
                          {(p.buildings || []).length > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                              Корпусов: {p.buildings.length}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-0.5 line-clamp-1">
                          {p.name || 'Без названия'}
                        </p>
                      </div>

                      {p.deadline && (
                        <span
                          className={`font-mono text-[11px] px-2 py-0.5 rounded shrink-0 ${
                            urgency === 'overdue'
                              ? 'bg-rose-100 text-rose-700 font-bold'
                              : urgency === 'soon'
                              ? 'bg-amber-100 text-amber-800 font-semibold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          title="Дедлайн этапа"
                        >
                          {formatToDMY(p.deadline)}
                        </span>
                      )}
                    </div>

                    {!noChecklist ? (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Готовность чек-листа</span>
                          <span className="font-bold text-slate-800">
                            {pct}% {remHours > 0 && <span className="text-slate-400 font-normal">(осталось {remHours} ч)</span>}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-[11px] text-slate-500 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                        Служебный проект для задач, встреч, методичек и разработки ПО (без чек-листа)
                      </div>
                    )}

                    {activeBlockers.length > 0 && (
                      <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-rose-50/80 border border-rose-200/80 text-[11px] text-rose-800 line-clamp-1">
                        <span className="font-semibold">Блокер:</span> {activeBlockers[0].text}
                        {activeBlockers.length > 1 && ` (+${activeBlockers.length - 1})`}
                      </div>
                    )}
                  </div>

                  <div
                    className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.id, 'remarks')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        openRemarks.length > 0
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {noChecklist ? 'Вопросы' : 'Замечания'}: {openRemarks.length}
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateWithFilter(1, p.num)}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        openMeetings.length > 0
                          ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      Встречи: {openMeetings.length}
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateWithFilter(4, p.num)}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        openTasks.length > 0
                          ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      Задачи: {openTasks.length}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Календарь планирования */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-indigo-600" />
              <h2 className="font-semibold text-base text-slate-800">
                Календарь планирования — {monthNames[month]} {year}
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                title="Предыдущий месяц"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDayDMY(getTodayDMY());
                }}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
              >
                Сегодня
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                title="Следующий месяц"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-200/70 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-400 font-medium">Показывать:</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSources.deadlines}
                onChange={(e) => setShowSources({ ...showSources, deadlines: e.target.checked })}
                className="rounded text-rose-600"
              />
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">Дедлайны этапов</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSources.tasks}
                onChange={(e) => setShowSources({ ...showSources, tasks: e.target.checked })}
                className="rounded text-amber-600"
              />
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Дедлайны задач</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSources.meetings}
                onChange={(e) => setShowSources({ ...showSources, meetings: e.target.checked })}
                className="rounded text-sky-600"
              />
              <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-medium">Встречи и сроки</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSources.custom}
                onChange={(e) => setShowSources({ ...showSources, custom: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-medium">Напоминания</span>
            </label>
          </div>

          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-[11px] font-semibold text-slate-500 py-2">
            <div>Пн</div>
            <div>Вт</div>
            <div>Ср</div>
            <div>Чт</div>
            <div>Пт</div>
            <div className="text-rose-500">Сб</div>
            <div className="text-rose-500">Вс</div>
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {calendarCells.map((cell, idx) => {
              if (!cell.dayNum) {
                return <div key={idx} className="min-h-[92px] bg-slate-50/40" />;
              }
              const dayEvents = eventsByDate[cell.dmy] || [];
              const isToday = cell.dmy === todayDMY;
              const isSelected = cell.dmy === selectedDayDMY;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayDMY(cell.dmy)}
                  className={`min-h-[96px] p-1.5 cursor-pointer transition-colors flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-indigo-50/60 ring-2 ring-inset ring-indigo-500'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-indigo-600 text-white'
                          : isSelected
                          ? 'text-indigo-700 font-bold'
                          : 'text-slate-700'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-400">{dayEvents.length}</span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate font-medium ${getBadgeStyle(
                          ev.type
                        )}`}
                        title={`${ev.time ? `[${ev.time}] ` : ''}${ev.projectNum ? `[#${ev.projectNum}] ` : ''}${ev.title}`}
                      >
                        {ev.time ? `${ev.time} ` : ''}
                        {ev.projectNum ? `#${ev.projectNum} ` : ''}
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-slate-400 font-medium pl-1">
                        + еще {dayEvents.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Выбранная дата
                </span>
                <h3 className="text-base font-bold text-slate-800 font-mono">{selectedDayDMY}</h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                Событий: {selectedDayEvents.length}
              </span>
            </div>

            <form onSubmit={handleAddCalendarEvent} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Flag size={13} className="text-indigo-600" /> Запланировать / Напомнить на {selectedDayDMY}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="time"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className="w-24 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                  title="Время напоминания (необязательно)"
                />
                <input
                  type="text"
                  list="projects-num-list"
                  value={newEventProject}
                  onChange={(e) => setNewEventProject(e.target.value)}
                  placeholder="Проект №"
                  className="w-20 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <datalist id="projects-num-list">
                  {activeProjects.map((p: any) => (
                    <option key={p.id} value={p.num}>
                      {p.name}
                    </option>
                  ))}
                </datalist>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Созвон, подача, проверка..."
                  className="flex-grow min-w-0 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <Plus size={14} /> Добавить напоминание
              </button>
            </form>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {selectedDayEvents.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  На эту дату ничего не запланировано.
                </div>
              ) : (
                selectedDayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/40 flex items-start justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getBadgeStyle(
                            ev.type
                          )}`}
                        >
                          {getTypeLabel(ev.type)}
                        </span>
                        {ev.time && (
                          <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {ev.time}
                          </span>
                        )}
                        {ev.projectNum && (
                          <span className="text-xs font-bold text-indigo-700">#{ev.projectNum}</span>
                        )}
                        {ev.status && (
                          <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {ev.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">{ev.title}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          downloadICSFile(
                            `${ev.projectNum ? `#${ev.projectNum} — ` : ''}${ev.title}`,
                            selectedDayDMY,
                            ev.time
                          )
                        }
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded"
                        title="Скачать .ics для Outlook / Google Calendar"
                      >
                        <CalendarPlus size={14} />
                      </button>

                      {ev.type === 'custom' && (
                        <button
                          type="button"
                          onClick={() =>
                            setCalendarEvents(calendarEvents.filter((item: any) => item.id !== ev.rawId))
                          }
                          className="text-slate-300 hover:text-rose-500 p-1"
                          title="Удалить событие"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === 8. МОДАЛЬНОЕ ОКНО ОТЧЁТА ПО ВСТРЕЧАМ (WORD / OUTLOOK) ===

function MeetingsReportModal({
  filteredMeetings,
  filters,
  projects,
  onClose,
}: {
  filteredMeetings: any[];
  filters: {
    projectNum: string;
    date: string;
    dueDate: string;
    desc: string;
    fix: string;
    screenshot: string;
    status: string;
    comment: string;
  };
  projects: any[];
  onClose: () => void;
}) {
  const matchedProject = filters.projectNum
    ? projects.find((p: any) => (p.num || '').trim() === filters.projectNum.trim())
    : null;

  const defaultTitle = [
    'Протокол / Итоги встречи',
    filters.projectNum ? `по проекту #${filters.projectNum}` : '',
    matchedProject?.name ? `(${matchedProject.name})` : '',
    filters.date ? `от ${filters.date}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const [reportTitle, setReportTitle] = useState(defaultTitle);
  const [introNote, setIntroNote] = useState('');
  const [copied, setCopied] = useState(false);

  const plainTextReport = useMemo(() => {
    const lines: string[] = [];
    lines.push(reportTitle.toUpperCase());
    lines.push(`Дата формирования: ${getTodayDMY()} | Пунктов в протоколе: ${filteredMeetings.length}`);
    if (introNote.trim()) {
      lines.push('');
      lines.push(`Резюме: ${introNote.trim()}`);
    }
    lines.push('');

    filteredMeetings.forEach((m: any, idx: number) => {
      const headerParts = [
        `${idx + 1}.`,
        m.projectNum ? `[Проект #${m.projectNum}]` : '',
        m.date ? `(Встреча: ${formatToDMY(m.date)})` : '',
        m.dueDate ? `[Срок: ${formatToDMY(m.dueDate)}]` : '',
        m.status ? `— Статус: ${m.status}` : '',
      ].filter(Boolean);
      lines.push(headerParts.join(' '));
      if (m.desc) lines.push(`   Вопрос: ${m.desc}`);
      if (m.fix) lines.push(`   Решение / Что исправить: ${m.fix}`);
      if (m.comment) lines.push(`   Комментарий: ${m.comment}`);
      lines.push('');
    });

    return lines.join('\n');
  }, [reportTitle, introNote, filteredMeetings]);

  const handleCopyForOutlook = () => {
    navigator.clipboard.writeText(plainTextReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenOutlookMailto = () => {
    const subject = encodeURIComponent(reportTitle);
    const body = encodeURIComponent(plainTextReport);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleDownloadWord = () => {
    const escapeHtml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');

    const rowsHtml = filteredMeetings
      .map((m: any, idx: number) => {
        const imgs = normalizeScreenshots(m.screenshot);
        const imgsHtml =
          imgs.length > 0
            ? imgs
                .map(
                  (src) =>
                    `<div style="margin-bottom:4px;"><img src="${src}" width="150" style="max-width:150px;height:auto;" /></div>`
                )
                .join('')
            : '—';

        return `
          <tr>
            <td align="center">${idx + 1}</td>
            <td align="center"><b>${escapeHtml(m.projectNum || '—')}</b></td>
            <td align="center">${escapeHtml(formatToDMY(m.date))}</td>
            <td align="center"><b>${escapeHtml(formatToDMY(m.dueDate) || '—')}</b></td>
            <td>${escapeHtml(m.desc)}</td>
            <td>${escapeHtml(m.fix)}</td>
            <td align="center">${imgsHtml}</td>
            <td><b>${escapeHtml(m.status)}</b></td>
            <td>${escapeHtml(m.comment)}</td>
          </tr>
        `;
      })
      .join('');

    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${escapeHtml(reportTitle)}</title></head>
      <body style="font-family: Arial, sans-serif; font-size: 10.5pt; color: #1e293b;">
        <h1 style="color:#1e3a8a;margin-bottom:4px;">${escapeHtml(reportTitle)}</h1>
        <p style="color:#475569;margin-top:0;">
          <b>Дата выгрузки:</b> ${getTodayDMY()} &nbsp;|&nbsp;
          <b>Количество пунктов:</b> ${filteredMeetings.length}
        </p>
        ${
          introNote.trim()
            ? `<p style="background:#f8fafc;padding:8px 12px;border-left:3px solid #4f46e5;"><b>Краткое резюме:</b> ${escapeHtml(
                introNote.trim()
              )}</p>`
            : ''
        }
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:9.5pt;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="width:30px;">№</th>
              <th style="width:65px;">Проект</th>
              <th style="width:80px;">Дата встречи</th>
              <th style="width:80px;">На когда</th>
              <th>Описание вопроса</th>
              <th>Что исправить / Решение</th>
              <th style="width:160px;">Скриншоты</th>
              <th style="width:95px;">Статус</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF', fullHtml], { type: 'application/msword;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileProj = filters.projectNum ? `_${filters.projectNum}` : '';
    const fileDate = filters.date ? `_${filters.date.replace(/\//g, '-')}` : '';
    link.download = `Meeting_Report${fileProj}${fileDate}.doc`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <FileText size={20} className="text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                Отчёт по результатам встреч ({filteredMeetings.length} зап.)
              </h3>
              <p className="text-xs text-slate-500">
                Сформировано по текущим фильтрам таблицы «Встречи» — можно выгрузить в Word или отправить через Outlook
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 bg-slate-50/50 border-b border-slate-200 space-y-2.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Заголовок протокола / Тема письма:</label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Краткое резюме / Выводы по встрече (необязательно):
            </label>
            <textarea
              rows={2}
              value={introNote}
              onChange={(e) => setIntroNote(e.target.value)}
              placeholder="Например: Провели суперпозицию с архитектором и конструктором. Основные правки по стоякам канализации и приямкам..."
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        <div className="p-4 flex-grow overflow-y-auto bg-white">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Предпросмотр текста для Outlook (при экспорте в Word также добавятся все скриншоты):
          </div>
          <textarea
            readOnly
            value={plainTextReport}
            className="w-full h-64 p-3 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none leading-relaxed"
          />
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/80 flex flex-wrap justify-between items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg"
          >
            Закрыть
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyForOutlook}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Скопировано!' : 'Копировать текст'}
            </button>

            <button
              type="button"
              onClick={handleOpenOutlookMailto}
              className="bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              title="Открыть новое письмо в почтовом клиенте Outlook с заполненной темой и текстом"
            >
              <Mail size={14} /> Открыть в Outlook
            </button>

            <button
              type="button"
              onClick={handleDownloadWord}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download size={14} /> Скачать в Word (.doc)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === 9. ВКЛАДКА 1: ВСТРЕЧИ ===

function TabMeetings({
  meetings,
  setMeetings,
  projects,
  onPreviewImages,
  externalProjectFilter,
  onClearExternalFilter,
}: any) {
  const [filters, setFilters] = useState({
    projectNum: '',
    date: '',
    dueDate: '',
    desc: '',
    fix: '',
    screenshot: '',
    status: '',
    comment: '',
  });
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    if (externalProjectFilter) {
      setFilters((prev) => ({ ...prev, projectNum: externalProjectFilter }));
      if (onClearExternalFilter) onClearExternalFilter();
    }
  }, [externalProjectFilter, onClearExternalFilter]);

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const resetFilters = () =>
    setFilters({
      projectNum: '',
      date: '',
      dueDate: '',
      desc: '',
      fix: '',
      screenshot: '',
      status: '',
      comment: '',
    });

  const filtered = meetings.filter((m: any) => {
    const imgs = normalizeScreenshots(m.screenshot);
    return (
      (!filters.projectNum || (m.projectNum || '').toLowerCase().includes(filters.projectNum.toLowerCase())) &&
      matchDateFilter(m.date, filters.date) &&
      matchDateFilter(m.dueDate, filters.dueDate) &&
      (!filters.desc || (m.desc || '').toLowerCase().includes(filters.desc.toLowerCase())) &&
      (!filters.fix || (m.fix || '').toLowerCase().includes(filters.fix.toLowerCase())) &&
      (!filters.screenshot ||
        (filters.screenshot === 'yes' && imgs.length > 0) ||
        (filters.screenshot === 'no' && imgs.length === 0)) &&
      matchStatusFilter(m.status, filters.status) &&
      (!filters.comment || (m.comment || '').toLowerCase().includes(filters.comment.toLowerCase()))
    );
  });

  const updateItem = (id: any, field: string, value: any) => {
    setMeetings(meetings.map((m: any) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const appendScreenshotToItem = (id: any, newImg: string) => {
    setMeetings((prev: any[]) =>
      prev.map((m: any) => {
        if (m.id !== id) return m;
        const current = normalizeScreenshots(m.screenshot);
        return { ...m, screenshot: [...current, newImg] };
      })
    );
  };

  return (
    <div className="space-y-4">
      {isReportModalOpen && (
        <MeetingsReportModal
          filteredMeetings={filtered}
          filters={filters}
          projects={projects}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Протоколы и результаты встреч</h2>
          <p className="text-xs text-slate-500">
            Отметьте звёздочкой ★ пункты в план на сегодня или укажите срок в колонке «На когда»
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={13} /> Сбросить фильтры
            </button>
          )}
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => setIsReportModalOpen(true)}
            className="bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 border border-amber-200 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            title="Сформировать протокол по отфильтрованным строкам для Word или Outlook"
          >
            <FileText size={15} /> Отчёт / Outlook ({filtered.length})
          </button>
          <button
            onClick={() =>
              setMeetings([
                {
                  id: Date.now(),
                  projectNum: filters.projectNum || '',
                  date: filters.date || getTodayDMY(),
                  dueDate: filters.dueDate || '',
                  desc: '',
                  fix: '',
                  screenshot: [],
                  status: 'в работе',
                  comment: '',
                  todayPlan: false,
                },
                ...meetings,
              ])
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus size={16} /> Новая запись
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="pt-3 pb-1.5 px-2 w-8 text-center" title="В план на сегодня">★</th>
                <th className="pt-3 pb-1.5 px-3 w-28">Проект</th>
                <th className="pt-3 pb-1.5 px-3 w-36">Дата встречи</th>
                <th className="pt-3 pb-1.5 px-3 w-36">На когда</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[200px]">Описание вопроса</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[200px]">Что исправить</th>
                <th className="pt-3 pb-1.5 px-3 w-44 text-center">Скриншоты</th>
                <th className="pt-3 pb-1.5 px-3 w-44">Статус</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[160px]">Комментарий</th>
                <th className="pt-3 pb-1.5 px-2 w-10"></th>
              </tr>
              <tr className="bg-slate-50/40 border-b border-slate-200">
                <th className="pb-2.5 px-1"></th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.projectNum}
                    onChange={(v) => setFilters({ ...filters, projectNum: v })}
                    placeholder="№..."
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.date}
                    onChange={(v) => setFilters({ ...filters, date: v })}
                    placeholder="ДД/ММ/ГГГГ"
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.dueDate}
                    onChange={(v) => setFilters({ ...filters, dueDate: v })}
                    placeholder="ДД/ММ/ГГГГ"
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.desc}
                    onChange={(v) => setFilters({ ...filters, desc: v })}
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.fix}
                    onChange={(v) => setFilters({ ...filters, fix: v })}
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <select
                    value={filters.screenshot}
                    onChange={(e) => setFilters({ ...filters, screenshot: e.target.value })}
                    className={`w-full px-1.5 py-1 text-[11px] font-normal rounded border ${
                      filters.screenshot ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <option value="">Все</option>
                    <option value="yes">Есть</option>
                    <option value="no">Нет</option>
                  </select>
                </th>
                <th className="pb-2.5 px-2">
                  <ColSelectFilter
                    value={filters.status}
                    options={['в работе', 'исправлено', 'на паузе', 'передано другому']}
                    onChange={(v) => setFilters({ ...filters, status: v })}
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.comment}
                    onChange={(v) => setFilters({ ...filters, comment: v })}
                  />
                </th>
                <th className="pb-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Записей по заданным фильтрам не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map((m: any) => {
                  const isDone = (m.status || '').toLowerCase() === 'исправлено';
                  const urgency = !isDone ? getDeadlineUrgency(m.dueDate) : null;

                  return (
                    <tr
                      key={m.id}
                      onPaste={(e) => handlePasteImage(e, (img) => appendScreenshotToItem(m.id, img))}
                      className={`group transition-colors align-top ${
                        urgency === 'overdue'
                          ? 'bg-rose-50/60 hover:bg-rose-100/50'
                          : urgency === 'soon'
                          ? 'bg-amber-50/40 hover:bg-amber-100/40'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => updateItem(m.id, 'todayPlan', !m.todayPlan)}
                          className="p-0.5 rounded hover:bg-amber-100 transition-colors"
                          title={m.todayPlan ? 'Убрать из плана на сегодня' : 'В план на сегодня'}
                        >
                          <Star
                            size={15}
                            className={
                              m.todayPlan
                                ? 'text-amber-500 fill-amber-400'
                                : 'text-slate-200 group-hover:text-slate-400'
                            }
                          />
                        </button>
                      </td>
                      <td className="p-2">
                        <input
                          placeholder="№..."
                          className="w-full px-2 py-1 font-semibold text-indigo-600 bg-transparent hover:bg-slate-100/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 rounded focus:outline-none"
                          value={m.projectNum}
                          onChange={(e) => updateItem(m.id, 'projectNum', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <DateInput
                          value={m.date}
                          onChange={(val) => updateItem(m.id, 'date', val)}
                        />
                      </td>
                      <td className="p-2">
                        <DateInput
                          value={m.dueDate || ''}
                          onChange={(val) => updateItem(m.id, 'dueDate', val)}
                          className={
                            urgency === 'overdue'
                              ? 'text-rose-700 font-bold'
                              : urgency === 'soon'
                              ? 'text-amber-800 font-semibold'
                              : 'text-sky-700 font-medium'
                          }
                        />
                      </td>
                      <td className="p-2">
                        <AutoTextarea
                          value={m.desc}
                          onChange={(val) => updateItem(m.id, 'desc', val)}
                          placeholder="Суть вопроса..."
                        />
                      </td>
                      <td className="p-2">
                        <AutoTextarea
                          value={m.fix}
                          onChange={(val) => updateItem(m.id, 'fix', val)}
                          placeholder="Требуемые правки..."
                        />
                      </td>
                      <td className="p-2 text-center">
                        <ImageCell
                          src={m.screenshot}
                          onChange={(imgs) => updateItem(m.id, 'screenshot', imgs)}
                          onPreview={onPreviewImages}
                        />
                      </td>
                      <td className="p-2">
                        <StatusPill
                          value={m.status}
                          options={['в работе', 'исправлено', 'на паузе', 'передано другому']}
                          onChange={(val) => updateItem(m.id, 'status', val)}
                        />
                      </td>
                      <td className="p-2">
                        <AutoTextarea
                          value={m.comment}
                          onChange={(val) => updateItem(m.id, 'comment', val)}
                          placeholder="Заметка..."
                          className="text-slate-600 text-xs"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => setMeetings(meetings.filter((mtg: any) => mtg.id !== m.id))}
                          className="text-slate-300 hover:text-rose-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                          title="Удалить строку"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// === 10. МОДАЛЬНОЕ ОКНО ФОРМИРОВАНИЯ СТАТУСА ПРОЕКТА (WORD / ШАБЛОНЫ ИВРИТ) ===

function ProjectStatusExportModal({
  projectData,
  availableStatuses,
  progressPercent,
  totalRemainingHours,
  onClose,
}: {
  projectData: any;
  availableStatuses: string[];
  progressPercent: number;
  totalRemainingHours: number;
  onClose: () => void;
}) {
  const noChecklist = isProjectWithoutChecklist(projectData);
  const [mode, setMode] = useState<'status' | 'hebrew_templates'>('status');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    'в работе',
    'передано другому',
    'требует исправления',
  ]);
  const [includeResolvedBlockers, setIncludeResolvedBlockers] = useState(false);
  const [remarksMode, setRemarksMode] = useState<'open' | 'all' | 'none'>('open');
  const [copiedText, setCopiedText] = useState(false);
  const [hebrewTemplateType, setHebrewTemplateType] = useState<'superposition' | 'verticals' | 'remarks'>('superposition');

  const toggleStatus = (st: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(st) ? prev.filter((item) => item !== st) : [...prev, st]
    );
  };

  const filteredBlockers = (projectData.blockers || []).filter((b: any) =>
    includeResolvedBlockers ? true : !b.resolved
  );

  const filteredRemarks = (projectData.remarks || []).filter((r: any) => {
    if (remarksMode === 'none') return false;
    if (remarksMode === 'all') return true;
    return !['решен', 'не актуальный'].includes((r.status || '').toLowerCase());
  });

  const filteredSections: Array<{
    sectionTitle: string;
    tasks: any[];
  }> = [];

  if (!noChecklist) {
    let currentSection = 'Общее';
    let currentBucket: any[] = [];

    (projectData.tasks || []).forEach((t: any) => {
      if (t.isHeader) {
        if (currentBucket.length > 0) {
          filteredSections.push({ sectionTitle: currentSection, tasks: currentBucket });
        }
        const bldPrefix = t.building ? `[${t.building}] ` : '';
        currentSection = bldPrefix + t.name.replace('📋 ', '').trim();
        currentBucket = [];
      } else {
        const st = (t.status || '').trim();
        const isMatch =
          selectedStatuses.includes(st) ||
          (selectedStatuses.includes('__EMPTY__') && !st);
        if (isMatch) {
          currentBucket.push(t);
        }
      }
    });
    if (currentBucket.length > 0) {
      filteredSections.push({ sectionTitle: currentSection, tasks: currentBucket });
    }
  }

  const generatePlainText = () => {
    const lines: string[] = [];
    lines.push(
      `СТАТУС ПРОЕКТА #${projectData.num}${projectData.name ? ` — ${projectData.name}` : ''}`
    );
    lines.push(`Дата формирования: ${getTodayDMY()}`);
    if (projectData.stage) lines.push(`Стадия: ${projectData.stage}`);
    if (projectData.deadline) lines.push(`Дедлайн этапа: ${formatToDMY(projectData.deadline)}`);
    if (projectData.team) lines.push(`Смежники: ${projectData.team}`);
    if (!noChecklist) {
      lines.push(
        `Общая готовность чек-листа: ${progressPercent}%${
          totalRemainingHours > 0 ? ` (осталось ~${Number(totalRemainingHours.toFixed(1))} ч)` : ''
        }`
      );
    }
    lines.push('');

    lines.push(`=== 1. ЧТО БЛОКИРУЕТ ПРОЕКТ (${filteredBlockers.length}) ===`);
    if (filteredBlockers.length === 0) {
      lines.push('Активных блокеров нет.');
    } else {
      filteredBlockers.forEach((b: any, i: number) => {
        const statusMark = b.resolved ? '[РЕШЕНО] ' : '';
        const dateStr = b.date ? ` (от ${formatToDMY(b.date)})` : '';
        lines.push(`${i + 1}. ${statusMark}${b.text}${dateStr}`);
      });
    }
    lines.push('');

    if (remarksMode !== 'none') {
      lines.push(
        `=== 2. ЗАМЕЧАНИЯ И ВОПРОСЫ ПО КООРДИНАЦИИ (${filteredRemarks.length}) ===`
      );
      if (filteredRemarks.length === 0) {
        lines.push('Замечаний по выбранному фильтру нет.');
      } else {
        filteredRemarks.forEach((r: any, i: number) => {
          const metaParts = [
            r.to ? `Кому/От: ${r.to}` : '',
            r.date ? `Дата: ${formatToDMY(r.date)}` : '',
            r.status ? `Статус: ${r.status}` : '',
          ].filter(Boolean);
          lines.push(`${i + 1}. ${r.desc || '(без описания)'}`);
          if (metaParts.length > 0) lines.push(`   [${metaParts.join(' | ')}]`);
          if (r.resolution) lines.push(`   Решение: ${r.resolution}`);
        });
      }
      lines.push('');
    }

    if (!noChecklist) {
      const totalFilteredTasks = filteredSections.reduce((acc, s) => acc + s.tasks.length, 0);
      lines.push(`=== 3. ПУНКТЫ ПРОЕКТИРОВАНИЯ ПО ВЫБРАННЫМ СТАТУСАМ (${totalFilteredTasks}) ===`);
      if (filteredSections.length === 0) {
        lines.push('Задач с выбранными статусами не найдено.');
      } else {
        filteredSections.forEach((sec) => {
          lines.push(`\n${sec.sectionTitle}:`);
          sec.tasks.forEach((t: any) => {
            const bldPart = t.building && !sec.sectionTitle.includes(`[${t.building}]`) ? `[${t.building}] ` : '';
            const codePart = t.code ? `${t.code} ` : '- ';
            const statusLabel = t.status || 'не задан';
            const extra = [
              t.priority ? `Приоритет: ${t.priority}` : '',
              t.date ? `Дата: ${formatToDMY(t.date)}` : '',
              t.comment ? `Комментарий: ${t.comment}` : '',
            ]
              .filter(Boolean)
              .join(' | ');
            lines.push(`  • ${bldPart}${codePart}${t.name} — [${statusLabel}]${extra ? ` (${extra})` : ''}`);
          });
        });
      }
    }

    return lines.join('\n');
  };

  const generateHebrewEmail = () => {
    const projTitle = `פרויקט ${projectData.num}${projectData.name ? ` - ${projectData.name}` : ''}`;
    const openRemarksList = (projectData.remarks || []).filter(
      (r: any) => !['решен', 'не актуальный'].includes((r.status || '').toLowerCase())
    );
    const remarksLines = openRemarksList.length
      ? openRemarksList.map((r: any, i: number) => `${i + 1}. ${r.desc}${r.to ? ` (${r.to})` : ''}`).join('\n')
      : '1. [יש להשלים פרטים]';

    if (hebrewTemplateType === 'superposition') {
      return `נושא: ${projTitle} | העברת תוכניות ומודל אינסטלציה לסופרפוזיציה (${projectData.stage || 'ביצוע'})\n\nשלום רב,\n\nמצורפות תוכניות ומודל אינסטלציה מעודכנים עבור ${projTitle}.\nנא לבדוק התאמה מול מערכות נוספות (אדריכלות, קונסטרוקציה, מיזוג אוויר וחשמל) ולהעביר הערות במידה וקיימות.\n\nדגשים לבדיקה:\n${remarksLines}\n\nבברכה,\nמיכאל\nמחלקת אינסטלציה וסניטריה — SUP`;
    }

    if (hebrewTemplateType === 'verticals') {
      return `נושא: ${projTitle} | בקשה לאישור מיקום קולטנים, צנרת אנכית ובורות שאיבה\n\nשלום רב,\n\nבהמשך לתכנון מערכות האינסטלציה ב${projTitle}, מצורפת פריסת קולטנים, פתחים ובורות שאיבה במרתף לאישורכם.\nנשמח לקבל התייחסות ואישור עקרוני על מנת להתקדם להוצאת תוכניות עבודה ופתחים.\n\nהערות פתוחות לתיאום:\n${remarksLines}\n\nתודה מראש,\nמיכאל\nמחלקת אינסטלציה וסניטריה — SUP`;
    }

    return `נושא: ${projTitle} | ריכוז הערות ושאלות לתיאום תכנון אינסטלציה\n\nשלום רב,\n\nלהלן ריכוז שאלות והערות פתוחות הדורשות התייחסותכם לצורך המשך תכנון ב${projTitle}:\n\n${remarksLines}\n\nנודה להתייחסותכם בהקדם.\n\nבברכה,\nמיכאל\nמחלקת אינסטלציה וסניטריה — SUP`;
  };

  const activeTextOutput = mode === 'status' ? generatePlainText() : generateHebrewEmail();

  const handleCopyText = () => {
    navigator.clipboard.writeText(activeTextOutput);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleDownloadWord = () => {
    const escapeHtml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');

    const blockersHtml =
      filteredBlockers.length === 0
        ? '<p style="color:#64748b;">Активных блокеров нет.</p>'
        : `<ul>${filteredBlockers
            .map(
              (b: any) =>
                `<li style="margin-bottom:4px;">${
                  b.resolved ? '<b style="color:#059669;">[РЕШЕНО]</b> ' : ''
                }${escapeHtml(b.text)} ${
                  b.date ? `<span style="color:#64748b;">(от ${formatToDMY(b.date)})</span>` : ''
                }</li>`
            )
            .join('')}</ul>`;

    const remarksHtml =
      remarksMode === 'none'
        ? ''
        : `<h2>2. Замечания и координация (${filteredRemarks.length})</h2>` +
          (filteredRemarks.length === 0
            ? '<p style="color:#64748b;">Замечаний нет.</p>'
            : `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:10pt;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="width:35px;">№</th>
                    <th style="width:85px;">Дата</th>
                    <th style="width:110px;">Кому / От</th>
                    <th>Описание</th>
                    <th style="width:140px;">Скриншоты</th>
                    <th>Решение</th>
                    <th style="width:100px;">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredRemarks
                    .map((r: any, idx: number) => {
                      const imgs = normalizeScreenshots(r.screenshot);
                      const imgsHtml =
                        imgs.length > 0
                          ? imgs
                              .map(
                                (imgSrc) =>
                                  `<div style="margin-bottom:4px;"><img src="${imgSrc}" width="130" style="max-width:130px;height:auto;" /></div>`
                              )
                              .join('')
                          : '—';
                      return `
                    <tr>
                      <td align="center">${idx + 1}</td>
                      <td>${escapeHtml(formatToDMY(r.date))}</td>
                      <td>${escapeHtml(r.to)}</td>
                      <td>${escapeHtml(r.desc)}</td>
                      <td align="center">${imgsHtml}</td>
                      <td>${escapeHtml(r.resolution)}</td>
                      <td><b>${escapeHtml(r.status)}</b></td>
                    </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>`);

    const tasksHtml = noChecklist
      ? ''
      : `<h2>${remarksMode === 'none' ? '2' : '3'}. Состояние разделов проектирования</h2>` +
        (filteredSections.length === 0
          ? '<p style="color:#64748b;">Задач с выбранными статусами не найдено.</p>'
          : `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:10pt;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="width:60px;">Пункт</th>
                  <th>Наименование работы</th>
                  <th style="width:130px;">Статус</th>
                  <th style="width:90px;">Дата</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                ${filteredSections
                  .map(
                    (sec) => `
                  <tr style="background:#e2e8f0;">
                    <td colspan="5"><b>${escapeHtml(sec.sectionTitle)}</b></td>
                  </tr>
                  ${sec.tasks
                    .map(
                      (t: any) => `
                    <tr>
                      <td align="center">${escapeHtml(t.code)}</td>
                      <td>${t.building ? `<b>[${escapeHtml(t.building)}]</b> ` : ''}${escapeHtml(t.name)}</td>
                      <td><b>${escapeHtml(t.status || 'не задан')}</b></td>
                      <td>${escapeHtml(formatToDMY(t.date))}</td>
                      <td>${escapeHtml(t.comment)}</td>
                    </tr>`
                    )
                    .join('')}
                `
                  )
                  .join('')}
              </tbody>
            </table>`);

    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Статус проекта ${escapeHtml(projectData.num)}</title></head>
      <body style="font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b;">
        <h1 style="color:#1e3a8a;margin-bottom:4px;">Статус проекта #${escapeHtml(projectData.num)}${
      projectData.name ? ` — ${escapeHtml(projectData.name)}` : ''
    }</h1>
        <p style="color:#475569;margin-top:0;">
          <b>Дата отчета:</b> ${getTodayDMY()} &nbsp;|&nbsp;
          ${projectData.stage ? `<b>Стадия:</b> ${escapeHtml(projectData.stage)} &nbsp;|&nbsp;` : ''}
          ${projectData.deadline ? `<b>Дедлайн этапа:</b> ${formatToDMY(projectData.deadline)} &nbsp;|&nbsp;` : ''}
          ${!noChecklist ? `<b>Готовность:</b> ${progressPercent}%` : ''}
        </p>
        ${projectData.team ? `<p><b>Смежники:</b> ${escapeHtml(projectData.team)}</p>` : ''}
        <hr/>
        <h2 style="color:#b91c1c;">1. Что блокирует проект (${filteredBlockers.length})</h2>
        ${blockersHtml}
        ${remarksHtml}
        ${tasksHtml}
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF', fullHtml], { type: 'application/msword;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Status_Project_${projectData.num}_${getTodayDMY().replace(/\//g, '-')}.doc`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <FileText size={20} className="text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                Отчеты и письма по проекту #{projectData.num}
              </h3>
              <p className="text-xs text-slate-500">
                Сформируйте статус в Word или готовое сопроводительное письмо смежникам на иврите
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-3 bg-slate-50/50 border-b border-slate-200 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('status')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-t border-x transition-colors ${
              mode === 'status'
                ? 'bg-white text-indigo-700 border-slate-200 -mb-px'
                : 'bg-slate-100/70 text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            Статус проекта (Word / Текст)
          </button>
          <button
            type="button"
            onClick={() => setMode('hebrew_templates')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-t border-x flex items-center gap-1.5 transition-colors ${
              mode === 'hebrew_templates'
                ? 'bg-white text-indigo-700 border-slate-200 -mb-px'
                : 'bg-slate-100/70 text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Mail size={14} /> Сопроводительное письмо (עברית)
          </button>
        </div>

        {mode === 'status' ? (
          <div className="p-4 bg-slate-50/50 border-b border-slate-200 space-y-3 text-xs">
            {!noChecklist && (
              <div>
                <div className="font-semibold text-slate-700 mb-1.5">
                  Какие статусы задач включить из чек-листа:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...availableStatuses, '__EMPTY__'].map((st) => {
                    const label = st === '__EMPTY__' ? 'Без статуса (пусто)' : st;
                    const active = selectedStatuses.includes(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => toggleStatus(st)}
                        className={`px-2.5 py-1 rounded-full border font-medium transition-all ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {active ? '✓ ' : ''}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Замечания / Вопросы:</span>
                <select
                  value={remarksMode}
                  onChange={(e) => setRemarksMode(e.target.value as any)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none"
                >
                  <option value="open">Только открытые</option>
                  <option value="all">Все записи ({(projectData.remarks || []).length})</option>
                  <option value="none">Не включать</option>
                </select>
              </div>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={includeResolvedBlockers}
                  onChange={(e) => setIncludeResolvedBlockers(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                Включать уже решенные блокеры
              </label>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700 mr-1">Тема письма:</span>
            <button
              type="button"
              onClick={() => setHebrewTemplateType('superposition')}
              className={`px-3 py-1.5 rounded-lg border font-medium ${
                hebrewTemplateType === 'superposition'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              Передача на суперпозицию
            </button>
            <button
              type="button"
              onClick={() => setHebrewTemplateType('verticals')}
              className={`px-3 py-1.5 rounded-lg border font-medium ${
                hebrewTemplateType === 'verticals'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              Согласование вертикалей / приямков
            </button>
            <button
              type="button"
              onClick={() => setHebrewTemplateType('remarks')}
              className={`px-3 py-1.5 rounded-lg border font-medium ${
                hebrewTemplateType === 'remarks'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              Список открытых замечаний
            </button>
          </div>
        )}

        <div className="p-4 flex-grow overflow-y-auto bg-white">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Предпросмотр текста (можно отредактировать перед копированием):
          </div>
          <textarea
            dir={mode === 'hebrew_templates' ? 'rtl' : 'ltr'}
            defaultValue={activeTextOutput}
            key={`${mode}-${hebrewTemplateType}-${selectedStatuses.join(',')}-${remarksMode}-${includeResolvedBlockers}`}
            className="w-full h-72 p-3 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none leading-relaxed"
          />
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/80 flex flex-wrap justify-between items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg"
          >
            Закрыть
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyText}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                copiedText
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              {copiedText ? <Check size={15} /> : <Copy size={15} />}
              {copiedText ? 'Текст скопирован!' : 'Копировать текст'}
            </button>

            {mode === 'status' && (
              <button
                type="button"
                onClick={handleDownloadWord}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download size={15} /> Скачать в Word (.doc)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// === 11. ВКЛАДКА 2: СТАТУС ПРОЕКТА ===

function TabProjectStatus({
  projects,
  setProjects,
  activeProjectId,
  setActiveProjectId,
  meetings,
  setMeetings,
  tasks,
  setTasks,
  onNavigateWithFilter,
  onPreviewImages,
  onSyncSingleProjectToReport,
  externalSubTab,
  onClearExternalSubTab,
}: any) {
  const [subTab, setSubTab] = useState<'tasks' | 'remarks' | 'revisions' | 'docs' | 'related'>('tasks');
  const [isCreating, setIsCreating] = useState(false);
  const [newNum, setNewNum] = useState('');
  const [newName, setNewName] = useState('');
  const [newStage, setNewStage] = useState('');
  const [newNoChecklist, setNewNoChecklist] = useState(false);
  const [newBlockerText, setNewBlockerText] = useState('');
  const [showResolvedBlockers, setShowResolvedBlockers] = useState(false);
  const [showOverviewGrid, setShowOverviewGrid] = useState(false);
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [addingToSection, setAddingToSection] = useState<string | null>(null);
  const [customTaskName, setCustomTaskName] = useState('');
  const [copiedRemarks, setCopiedRemarks] = useState(false);

  // Корпуса / Зоны (Multi-Building)
  const [newBuildingName, setNewBuildingName] = useState('');
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState('');
  const [cloningSectionKey, setCloningSectionKey] = useState<string | null>(null);
  const [cloneTargetBuilding, setCloneTargetBuilding] = useState('');

  const [selectedTaskIndices, setSelectedTaskIndices] = useState<number[]>([]);
  const [bulkStatusValue, setBulkStatusValue] = useState('выполнено');

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionBuilding, setNewSectionBuilding] = useState('');
  const [isManagingStatuses, setIsManagingStatuses] = useState(false);
  const [newCustomStatus, setNewCustomStatus] = useState('');
  const [sortByPriority, setSortByPriority] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const activeProject = projects.find((p: any) => p.id === activeProjectId) || null;
  const noChecklist = isProjectWithoutChecklist(activeProject);

  const selectableProjects = useMemo(() => {
    return projects.filter(
      (p: any) => showArchivedProjects || !p.archived || p.id === activeProjectId
    );
  }, [projects, showArchivedProjects, activeProjectId]);

  const archivedCount = useMemo(
    () => projects.filter((p: any) => p.archived).length,
    [projects]
  );

  useEffect(() => {
    setSelectedTaskIndices([]);
    setSelectedBuildingFilter('');
    setCloningSectionKey(null);
    if (activeProject && isProjectWithoutChecklist(activeProject) && subTab === 'tasks') {
      setSubTab('related');
    }
  }, [activeProjectId, activeProject]);

  useEffect(() => {
    if (externalSubTab) {
      if (noChecklist && externalSubTab === 'tasks') {
        setSubTab('related');
      } else {
        setSubTab(externalSubTab);
      }
      if (onClearExternalSubTab) onClearExternalSubTab();
    }
  }, [externalSubTab, onClearExternalSubTab, noChecklist]);

  const [taskFilters, setTaskFilters] = useState({
    name: '',
    status: '',
    priority: '',
    estHours: '',
    date: '',
    comment: '',
  });
  const [remarkFilters, setRemarkFilters] = useState({
    date: '',
    to: '',
    desc: '',
    dateSent: '',
    dateAnswer: '',
    resolution: '',
    status: '',
  });
  const [permFilters, setPermFilters] = useState({ name: '', status: '', date: '', comment: '' });
  const [fileFilters, setFileFilters] = useState({ name: '', status: '', date: '', comment: '' });
  const [relMeetingFilters, setRelMeetingFilters] = useState({
    date: '',
    dueDate: '',
    desc: '',
    fix: '',
    status: '',
    comment: '',
  });
  const [relTaskFilters, setRelTaskFilters] = useState({
    date: '',
    desc: '',
    estDate: '',
    status: '',
    comment: '',
  });

  const projectData = activeProject
    ? {
        ...activeProject,
        stage: activeProject.stage || '',
        deadline: activeProject.deadline || '',
        team: activeProject.team || '',
        archived: Boolean(activeProject.archived),
        buildings: activeProject.buildings || [],
        blockers: activeProject.blockers || [],
        customStatuses: activeProject.customStatuses || [],
        tasks: noChecklist ? [] : activeProject.tasks || createTasksFromTemplate(),
        files: noChecklist
          ? activeProject.files || []
          : (activeProject.files || [...DEFAULT_FILES]).map((f: any) => ({
              comment: '',
              ...f,
            })),
        permissions: noChecklist
          ? activeProject.permissions || []
          : (activeProject.permissions || [...DEFAULT_PERMISSIONS]).map((p: any) => ({
              comment: '',
              ...p,
            })),
        remarks: activeProject.remarks || [],
        revisions: activeProject.revisions || [],
      }
    : null;

  const availableTaskStatuses = projectData
    ? [...DEFAULT_TASK_STATUSES, ...projectData.customStatuses]
    : DEFAULT_TASK_STATUSES;

  const usedPriorities: string[] =
    projectData && !noChecklist
      ? Array.from(
          new Set(
            projectData.tasks
              .filter((t: any) => !t.isHeader && (t.priority || '').trim())
              .map((t: any) => String(t.priority).trim())
          )
        )
      : [];

  const updateField = (field: string, value: any) => {
    setProjects(projects.map((p: any) => (p.id === activeProjectId ? { ...p, [field]: value } : p)));
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNum.trim()) return;
    const skipChecklist = newNoChecklist || newNum.trim() === '0000';
    const newProj = {
      id: Date.now().toString(),
      num: newNum.trim(),
      name: newName.trim(),
      stage: newStage.trim(),
      deadline: '',
      team: '',
      comment: '',
      noChecklist: skipChecklist,
      archived: false,
      buildings: [],
      blockers: [],
      customStatuses: [],
      tasks: skipChecklist ? [] : createTasksFromTemplate(),
      files: skipChecklist ? [] : [...DEFAULT_FILES],
      permissions: skipChecklist ? [] : [...DEFAULT_PERMISSIONS],
      remarks: [],
      revisions: [],
    };
    setProjects([...projects, newProj]);
    setActiveProjectId(newProj.id);
    if (skipChecklist) setSubTab('related');
    setNewNum('');
    setNewName('');
    setNewStage('');
    setNewNoChecklist(false);
    setIsCreating(false);
  };

  // Управление корпусами (Multi-Building)
  const handleAddBuilding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuildingName.trim() || !projectData) return;
    const trimmed = newBuildingName.trim();
    if (!projectData.buildings.includes(trimmed)) {
      updateField('buildings', [...projectData.buildings, trimmed]);
    }
    setNewBuildingName('');
  };

  const handleRemoveBuilding = (bld: string) => {
    if (!projectData) return;
    updateField(
      'buildings',
      projectData.buildings.filter((item: string) => item !== bld)
    );
    if (selectedBuildingFilter === bld) {
      setSelectedBuildingFilter('');
    }
  };

  const handleCloneSectionForBuilding = (sectionHeaderIndex: number, targetBld: string) => {
    if (!projectData || !targetBld.trim()) return;
    const bld = targetBld.trim();
    const tasksArr = [...projectData.tasks];
    const headerItem = tasksArr[sectionHeaderIndex];
    if (!headerItem || !headerItem.isHeader) return;

    // Автоматически добавим корпус в список проекта, если его там еще нет
    const updatedBuildings = projectData.buildings.includes(bld)
      ? projectData.buildings
      : [...projectData.buildings, bld];

    const clonedItems: any[] = [
      {
        ...headerItem,
        building: bld,
        isCustomSection: true,
      },
    ];

    let cursor = sectionHeaderIndex + 1;
    while (cursor < tasksArr.length && !tasksArr[cursor].isHeader) {
      clonedItems.push({
        ...tasksArr[cursor],
        building: bld,
        status: '',
        date: '',
        comment: '',
        todayPlan: false,
      });
      cursor++;
    }

    tasksArr.splice(cursor, 0, ...clonedItems);
    setProjects(
      projects.map((p: any) =>
        p.id === activeProjectId
          ? { ...p, buildings: updatedBuildings, tasks: tasksArr }
          : p
      )
    );
    setCloningSectionKey(null);
    setCloneTargetBuilding('');
  };

  const handleMigrateToNewTemplate = () => {
    if (!projectData) return;
    const upgradedTasks = createTasksFromTemplate(projectData.tasks);
    updateField('tasks', upgradedTasks);
  };

  const handleUpgradePermissionsToNewTemplate = () => {
    if (!projectData) return;
    const upgradedPerms = createPermissionsFromTemplate(projectData.permissions);
    updateField('permissions', upgradedPerms);
  };

  const isLegacyPermissions =
    projectData &&
    !noChecklist &&
    projectData.permissions.length < PERMISSIONS_TEMPLATE.length;

  const toggleTaskSelection = (idx: number) => {
    setSelectedTaskIndices((prev) =>
      prev.includes(idx) ? prev.filter((item) => item !== idx) : [...prev, idx]
    );
  };

  const applyBulkStatusChange = () => {
    if (!projectData || selectedTaskIndices.length === 0) return;
    const arr = [...projectData.tasks];
    selectedTaskIndices.forEach((idx) => {
      if (arr[idx] && !arr[idx].isHeader) {
        arr[idx].status = bulkStatusValue;
        if (bulkStatusValue && !arr[idx].date && bulkStatusValue !== 'не требуется') {
          arr[idx].date = getTodayDMY();
        }
      }
    });
    updateField('tasks', arr);
    setSelectedTaskIndices([]);
  };

  const handleAddCustomSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim() || !projectData) return;
    const headersCount = projectData.tasks.filter((t: any) => t.isHeader).length;
    const nextNum = headersCount + 1;
    const rawTitle = newSectionTitle.trim();
    const formattedTitle = /^\d+\./.test(rawTitle) ? rawTitle : `${nextNum}. ${rawTitle}`;

    const newHeader = {
      code: String(nextNum),
      name: `📋 ${formattedTitle}`,
      isHeader: true,
      isCustomSection: true,
      building: newSectionBuilding.trim(),
      status: '',
      priority: '',
      estHours: '',
      date: '',
      comment: '',
      todayPlan: false,
    };

    updateField('tasks', [...projectData.tasks, newHeader]);
    setNewSectionTitle('');
    setNewSectionBuilding('');
    setIsAddingSection(false);
  };

  const handleDeleteSectionByHeaderIndex = (headerIndex: number) => {
    if (!projectData) return;
    const tasksArr = [...projectData.tasks];
    if (!tasksArr[headerIndex]?.isHeader) return;

    let endIdx = headerIndex + 1;
    while (endIdx < tasksArr.length && !tasksArr[endIdx].isHeader) {
      endIdx++;
    }
    tasksArr.splice(headerIndex, endIdx - headerIndex);
    updateField('tasks', tasksArr);
  };

  const handleAddCustomStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomStatus.trim() || !projectData) return;
    const cleaned = newCustomStatus.trim();
    if (!availableTaskStatuses.some((s) => s.toLowerCase() === cleaned.toLowerCase())) {
      updateField('customStatuses', [...projectData.customStatuses, cleaned]);
    }
    setNewCustomStatus('');
  };

  const handleRemoveCustomStatus = (statusToRemove: string) => {
    if (!projectData) return;
    updateField(
      'customStatuses',
      projectData.customStatuses.filter((s: string) => s !== statusToRemove)
    );
  };

  const handleAddBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockerText.trim() || !projectData) return;
    const updated = [
      {
        id: Date.now(),
        text: newBlockerText.trim(),
        date: getTodayDMY(),
        resolved: false,
      },
      ...projectData.blockers,
    ];
    updateField('blockers', updated);
    setNewBlockerText('');
  };

  const toggleBlockerResolved = (blockerId: number) => {
    if (!projectData) return;
    const updated = projectData.blockers.map((b: any) =>
      b.id === blockerId ? { ...b, resolved: !b.resolved } : b
    );
    updateField('blockers', updated);
  };

  const updateBlockerText = (blockerId: number, text: string) => {
    if (!projectData) return;
    const updated = projectData.blockers.map((b: any) =>
      b.id === blockerId ? { ...b, text } : b
    );
    updateField('blockers', updated);
  };

  const deleteBlocker = (blockerId: number) => {
    if (!projectData) return;
    updateField(
      'blockers',
      projectData.blockers.filter((b: any) => b.id !== blockerId)
    );
  };

  const handleAddCustomTaskToSection = (headerIdx: number) => {
    if (!customTaskName.trim() || !projectData) return;
    const tasksArr = [...projectData.tasks];
    const headerItem = tasksArr[headerIdx];
    if (!headerItem || !headerItem.isHeader) return;

    const sectionCode = headerItem.code || '';
    const sectionBuilding = headerItem.building || '';
    let childCount = 0;
    let insertIdx = headerIdx + 1;
    while (insertIdx < tasksArr.length && !tasksArr[insertIdx].isHeader) {
      childCount++;
      insertIdx++;
    }

    const generatedCode = sectionCode ? `${sectionCode}.${childCount + 1}` : '';

    tasksArr.splice(insertIdx, 0, {
      code: generatedCode,
      name: customTaskName.trim(),
      isHeader: false,
      isCustom: true,
      building: sectionBuilding,
      status: '',
      priority: '',
      estHours: '',
      date: '',
      comment: '',
      todayPlan: false,
    });

    updateField('tasks', tasksArr);
    setCustomTaskName('');
    setAddingToSection(null);
  };

  const handleCopyOpenRemarks = () => {
    if (!projectData) return;
    const openRemarks = projectData.remarks.filter(
      (r: any) => !['решен', 'не актуальный'].includes((r.status || '').toLowerCase())
    );
    if (!openRemarks.length) {
      alert('Открытых замечаний по этому проекту нет.');
      return;
    }
    const header = `Проект ${projectData.num}${projectData.name ? ` (${projectData.name})` : ''} — открытые замечания (${openRemarks.length}):\n\n`;
    const body = openRemarks
      .map((r: any, idx: number) => {
        const meta = [r.to ? `Кому: ${r.to}` : '', r.date ? `Дата: ${formatToDMY(r.date)}` : '', r.status ? `Статус: ${r.status}` : '']
          .filter(Boolean)
          .join(' | ');
        return `${idx + 1}. ${r.desc || '(без описания)'}${meta ? `\n   [${meta}]` : ''}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(header + body);
    setCopiedRemarks(true);
    setTimeout(() => setCopiedRemarks(false), 2500);
  };

  const buildGroupedSections = () => {
    if (!projectData || noChecklist) return [];
    const sections: Array<{
      sectionKey: string;
      headerIndex: number;
      headerName: string;
      displayTitle: string;
      building: string;
      isCustomSection: boolean;
      items: Array<{ task: any; originalIndex: number }>;
      completedCount: number;
      totalActionable: number;
      remainingHours: number;
    }> = [];

    let currentSection: any = null;

    projectData.tasks.forEach((t: any, idx: number) => {
      if (t.isHeader) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          sectionKey: `sec-${idx}`,
          headerIndex: idx,
          headerName: t.name,
          displayTitle: t.name.replace('📋 ', '').trim(),
          building: t.building || '',
          isCustomSection: Boolean(t.isCustomSection),
          items: [],
          completedCount: 0,
          totalActionable: 0,
          remainingHours: 0,
        };
      } else {
        if (!currentSection) {
          currentSection = {
            sectionKey: 'sec-default',
            headerIndex: -1,
            headerName: '📋 Общее',
            displayTitle: 'Общее',
            building: '',
            isCustomSection: false,
            items: [],
            completedCount: 0,
            totalActionable: 0,
            remainingHours: 0,
          };
        }
        currentSection.items.push({ task: t, originalIndex: idx });
        if (t.status !== 'не требуется') {
          currentSection.totalActionable++;
          const hrs = parseFloat(String(t.estHours || '').replace(',', '.')) || 0;
          if (t.status === 'выполнено') {
            currentSection.completedCount++;
          } else {
            currentSection.remainingHours += hrs;
          }
        }
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }
    return sections;
  };

  const progressPercent = projectData ? calcProjectProgress(projectData) : 0;
  const activeBlockersCount = projectData ? projectData.blockers.filter((b: any) => !b.resolved).length : 0;
  const displayedBlockers = projectData
    ? showResolvedBlockers
      ? projectData.blockers
      : projectData.blockers.filter((b: any) => !b.resolved)
    : [];

  const projectMeetings = projectData
    ? meetings.filter((m: any) => (m.projectNum || '').trim() === (projectData.num || '').trim())
    : [];
  const projectQuickTasks = projectData
    ? tasks.filter((t: any) => (t.project || '').trim() === (projectData.num || '').trim())
    : [];
  const sectionsList = buildGroupedSections();
  const totalRemainingHours = sectionsList.reduce((acc, s) => acc + s.remainingHours, 0);

  const isLegacyTemplate =
    projectData &&
    !noChecklist &&
    projectData.tasks.filter((t: any) => t.isHeader && !t.building && !t.isCustomSection).length <
      PROJECT_SECTIONS_TEMPLATE.length;

  const toggleAllSections = (collapse: boolean) => {
    const next: Record<string, boolean> = {};
    sectionsList.forEach((sec) => {
      next[sec.sectionKey] = collapse;
    });
    setCollapsedSections(next);
  };

  const updateMeetingRow = (id: any, field: string, value: any) => {
    setMeetings(meetings.map((m: any) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const appendScreenshotToMeetingRow = (id: any, newImg: string) => {
    setMeetings((prev: any[]) =>
      prev.map((m: any) => {
        if (m.id !== id) return m;
        const current = normalizeScreenshots(m.screenshot);
        return { ...m, screenshot: [...current, newImg] };
      })
    );
  };

  const updateQuickTaskRow = (id: any, field: string, value: any) => {
    setTasks(tasks.map((t: any) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  let fallbackCounter = 1;

  const availableProjectSubTabs = noChecklist
    ? [
        { id: 'related', label: 'Встречи и Задачи', icon: MessageSquare, count: projectMeetings.length + projectQuickTasks.length },
        { id: 'remarks', label: 'Вопросы и Заметки', icon: AlertCircle, count: projectData?.remarks.length || 0 },
      ]
    : [
        { id: 'tasks', label: 'Инженерия (Чек-лист)', icon: Layers, count: projectData?.tasks.filter((t: any) => !t.isHeader).length || 0 },
        { id: 'remarks', label: 'Замечания', icon: AlertCircle, count: projectData?.remarks.length || 0 },
        { id: 'revisions', label: 'Выдача моделей / Ревизии', icon: Send, count: projectData?.revisions.length || 0 },
        { id: 'docs', label: 'Разрешения и Файлы', icon: FileCheck2, count: (projectData?.permissions.filter((p: any) => !p.isGroup).length || 0) + (projectData?.files.length || 0) },
        { id: 'related', label: 'Встречи и Задачи', icon: MessageSquare, count: projectMeetings.length + projectQuickTasks.length },
      ];

  return (
    <div className="space-y-5">
      {projects.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setShowOverviewGrid(!showOverviewGrid)}
              className="flex items-center gap-2 hover:text-indigo-700 transition-colors"
            >
              <LayoutGrid size={15} className="text-indigo-600" />
              Быстрый переход между объектами ({selectableProjects.length})
              {showOverviewGrid ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {archivedCount > 0 && (
              <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchivedProjects}
                  onChange={(e) => setShowArchivedProjects(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                Показывать архивные ({archivedCount})
              </label>
            )}
          </div>

          {showOverviewGrid && (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {selectableProjects.map((p: any) => {
                const isSelected = p.id === activeProjectId;
                const skipChk = isProjectWithoutChecklist(p);
                const pct = calcProjectProgress(p);
                const blockersCnt = (p.blockers || []).filter((b: any) => !b.resolved).length;
                const openRemarksCnt = (p.remarks || []).filter(
                  (r: any) => !['решен', 'не актуальный'].includes((r.status || '').toLowerCase())
                ).length;
                const urgency = getDeadlineUrgency(p.deadline);

                return (
                  <div
                    key={p.id}
                    onClick={() => setActiveProjectId(p.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      p.archived
                        ? 'bg-slate-100/80 border-slate-300 opacity-75'
                        : isSelected
                        ? 'bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-500/15'
                        : 'bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-indigo-700">#{p.num}</span>
                          {p.archived && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 rounded">
                              АРХИВ
                            </span>
                          )}
                          {p.stage && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded truncate max-w-[110px]">
                              {p.stage}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 truncate mt-0.5">
                          {p.name || 'Без названия'}
                        </p>
                      </div>
                      {!skipChk && <span className="text-xs font-bold text-slate-700 shrink-0">{pct}%</span>}
                    </div>

                    {!skipChk && (
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2.5">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] gap-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium ${
                            blockersCnt > 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          Блокеры: {blockersCnt}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium ${
                            openRemarksCnt > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {skipChk ? 'Вопросы' : 'Зам'}: {openRemarksCnt}
                        </span>
                      </div>

                      {p.deadline && (
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                            urgency === 'overdue'
                              ? 'bg-rose-100 text-rose-700 font-bold'
                              : urgency === 'soon'
                              ? 'bg-amber-100 text-amber-800 font-semibold'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatToDMY(p.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-3">
        {projectData?.archived && (
          <div className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 text-xs text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <Archive size={15} className="text-slate-600" />
              Этот проект находится в архиве и скрыт из сводки на главной странице.
            </span>
            <button
              type="button"
              onClick={() => updateField('archived', false)}
              className="text-indigo-700 font-semibold hover:underline"
            >
              Вернуть в активные
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-grow">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-grow md:flex-grow-0 md:min-w-[340px]">
              <FolderKanban size={18} className="text-indigo-600 shrink-0" />
              <select
                className="w-full bg-transparent font-semibold text-slate-800 text-sm focus:outline-none cursor-pointer"
                value={activeProjectId || ''}
                onChange={(e) => setActiveProjectId(e.target.value)}
              >
                <option value="" disabled>
                  Выберите проект из списка...
                </option>
                {selectableProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.archived ? '[АРХИВ] ' : ''}Проект {p.num} {p.name ? `— ${p.name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {projectData && !noChecklist && (
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70">
                <div className="text-xs text-slate-500">
                  Готовность: <span className="font-bold text-slate-800">{progressPercent}%</span>
                </div>
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {projectData && (
              <>
                <button
                  type="button"
                  onClick={() => updateField('archived', !projectData.archived)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                    projectData.archived
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                  title={projectData.archived ? 'Восстановить проект из архива' : 'Перенести завершённый проект в архив'}
                >
                  <Archive size={14} /> {projectData.archived ? 'Из архива' : 'В архив'}
                </button>
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Сформировать отчет по статусу в Word или шаблон письма на иврите"
                >
                  <FileText size={15} /> Статус / Письмо (Word / עברית)
                </button>
                <button
                  onClick={() => onSyncSingleProjectToReport(projectData)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Сформировать или обновить строку этого проекта в еженедельном отчете"
                >
                  <ArrowUpRight size={15} /> В отчет ({getCurrentISOWeek()})
                </button>
              </>
            )}
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus size={16} /> Новый проект
            </button>
          </div>
        </div>

        {projectData && (
          <>
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 bg-slate-50/70 px-3 py-1.5 rounded-lg border border-slate-200/70">
                <span className="text-xs font-semibold text-slate-500 shrink-0">Стадия / Тип:</span>
                <input
                  type="text"
                  list="stage-suggestions"
                  value={projectData.stage}
                  onChange={(e) => updateField('stage', e.target.value)}
                  placeholder="היתר / ביצוע / מכרז..."
                  className="w-full text-xs font-medium text-slate-800 bg-transparent focus:bg-white px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <datalist id="stage-suggestions">
                  <option value="היתר (Подача)" />
                  <option value="מכרז (Тендер)" />
                  <option value="ביצוע (Рабочка)" />
                  <option value="סופרפוזיציה (Суперпозиция)" />
                  <option value="Внутренняя работа" />
                </datalist>
              </div>

              <div className="flex items-center gap-2 bg-slate-50/70 px-3 py-1.5 rounded-lg border border-slate-200/70">
                <Clock size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-500 shrink-0">Дедлайн этапа:</span>
                <div className="w-36">
                  <DateInput
                    value={projectData.deadline}
                    onChange={(val) => updateField('deadline', val)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50/70 px-3 py-1.5 rounded-lg border border-slate-200/70">
                <UserCheck size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-500 shrink-0">Смежники / Участники:</span>
                <input
                  type="text"
                  value={projectData.team}
                  onChange={(e) => updateField('team', e.target.value)}
                  placeholder="Архитектор, конструктор, BIM..."
                  className="w-full text-xs text-slate-700 bg-transparent focus:bg-white px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>

            {/* ПАНЕЛЬ КОРПУСОВ / ЗОН (MULTI-BUILDING) */}
            {!noChecklist && (
              <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-500 font-semibold flex items-center gap-1 mr-1">
                    <Building2 size={14} className="text-indigo-600" /> Корпуса / Зоны:
                  </span>
                  {projectData.buildings.length === 0 ? (
                    <span className="text-slate-400 text-[11px]">
                      Не заданы (можно добавить Здание A, Здание B, Паркинг и дублировать под них разделы)
                    </span>
                  ) : (
                    projectData.buildings.map((bld: string) => (
                      <span
                        key={bld}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200/80 font-semibold text-[11px]"
                      >
                        {bld}
                        <button
                          type="button"
                          onClick={() => handleRemoveBuilding(bld)}
                          className="text-indigo-400 hover:text-rose-600"
                          title="Убрать корпус из списка"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddBuilding} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    placeholder="Здание A / Паркинг..."
                    className="w-36 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 font-medium text-xs transition-colors"
                  >
                    + Корпус
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreateProject}
          className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-xl space-y-3"
        >
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="w-full sm:w-36">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Номер проекта *</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Напр. 1621"
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newNum}
                onChange={(e) => setNewNum(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-44">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Стадия</label>
              <input
                type="text"
                list="stage-suggestions"
                placeholder="היתר / ביצוע..."
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
              />
            </div>
            <div className="w-full sm:flex-grow">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Наименование (необязательно)
              </label>
              <input
                type="text"
                placeholder="Жилой комплекс / Адрес..."
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="submit"
                className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
              >
                Создать
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200/70 rounded-lg"
              >
                Отмена
              </button>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={newNoChecklist}
              onChange={(e) => setNewNoChecklist(e.target.checked)}
              className="rounded text-indigo-600"
            />
            Служебный проект без стандартного инженерного чек-листа (только задачи, встречи и вопросы)
          </label>
        </form>
      )}

      {!projectData ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-sm">
          <FolderKanban size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-700">Проект не выбран</h3>
          <p className="text-sm text-slate-400 mt-1">
            Выберите существующий объект из списка выше или создайте новый.
          </p>
        </div>
      ) : (
        <>
          {isExportModalOpen && (
            <ProjectStatusExportModal
              projectData={projectData}
              availableStatuses={availableTaskStatuses}
              progressPercent={progressPercent}
              totalRemainingHours={totalRemainingHours}
              onClose={() => setIsExportModalOpen(false)}
            />
          )}

          <div className="bg-white rounded-xl border border-rose-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-rose-50/60 border-b border-rose-100 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert size={17} className="text-rose-600" />
                <h3 className="font-semibold text-sm text-slate-800">Что блокирует проект</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                  Активных: {activeBlockersCount}
                </span>
              </div>
              {projectData.blockers.some((b: any) => b.resolved) && (
                <button
                  onClick={() => setShowResolvedBlockers(!showResolvedBlockers)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  {showResolvedBlockers ? 'Скрыть решенные' : 'Показать решенные'}
                </button>
              )}
            </div>

            <div className="p-3 space-y-2">
              <form onSubmit={handleAddBlocker} className="flex gap-2">
                <input
                  type="text"
                  value={newBlockerText}
                  onChange={(e) => setNewBlockerText(e.target.value)}
                  placeholder="Опишите блокер или важный вопрос (например: Нет архитектуры подвала, Ждем ответ...)"
                  className="flex-grow px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
                />
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus size={14} /> Добавить блокер
                </button>
              </form>

              {displayedBlockers.length > 0 && (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                  {displayedBlockers.map((b: any) => (
                    <div
                      key={b.id}
                      className={`flex items-center gap-2.5 px-3 py-1.5 text-xs group ${
                        b.resolved ? 'bg-slate-50/70 opacity-60' : 'bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleBlockerResolved(b.id)}
                        className={`shrink-0 transition-colors ${
                          b.resolved ? 'text-emerald-600' : 'text-slate-300 hover:text-emerald-600'
                        }`}
                        title={b.resolved ? 'Вернуть в активные' : 'Отметить как решенное'}
                      >
                        {b.resolved ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                      </button>
                      <input
                        type="text"
                        value={b.text}
                        onChange={(e) => updateBlockerText(b.id, e.target.value)}
                        className={`flex-grow bg-transparent focus:bg-slate-50 px-1.5 py-0.5 rounded focus:outline-none ${
                          b.resolved ? 'line-through text-slate-400' : 'text-slate-700 font-medium'
                        }`}
                      />
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">{formatToDMY(b.date)}</span>
                      <button
                        type="button"
                        onClick={() => deleteBlocker(b.id)}
                        className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Удалить"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-200/60 p-1 rounded-xl w-fit">
            {availableProjectSubTabs.map((item) => {
              const Icon = item.icon;
              const isActive = subTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSubTab(item.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-300/70 text-slate-600'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* РАЗДЕЛ 1: ИНЖЕНЕРНЫЕ ЗАДАЧИ (СКРЫТ ДЛЯ ПРОЕКТА 0000) */}
          {!noChecklist && subTab === 'tasks' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <datalist id="project-priorities-list">
                {usedPriorities.map((pr) => (
                  <option key={pr} value={pr} />
                ))}
              </datalist>

              {selectedTaskIndices.length > 0 && (
                <div className="px-4 py-2.5 bg-indigo-600 text-white flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-semibold">
                    Выбрано пунктов: {selectedTaskIndices.length}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={bulkStatusValue}
                      onChange={(e) => setBulkStatusValue(e.target.value)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-white rounded-lg focus:outline-none"
                    >
                      {availableTaskStatuses.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={applyBulkStatusChange}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                    >
                      Применить ко всем выбранным
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskIndices([])}
                      className="text-xs text-indigo-100 hover:text-white px-2 py-1"
                    >
                      Снять выделение
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-semibold text-slate-800">Чек-лист проектирования</h3>
                  {totalRemainingHours > 0 && (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1"
                      title="Сумма часов по всем незавершенным и актуальным задачам"
                    >
                      <Clock size={12} /> Осталось: {Number(totalRemainingHours.toFixed(1))} ч
                    </span>
                  )}

                  {projectData.buildings.length > 0 && (
                    <select
                      value={selectedBuildingFilter}
                      onChange={(e) => setSelectedBuildingFilter(e.target.value)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border focus:outline-none ${
                        selectedBuildingFilter
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <option value="">Все корпуса / общие разделы</option>
                      <option value="__GENERAL__">Только общие (без корпуса)</option>
                      {projectData.buildings.map((b: string) => (
                        <option key={b} value={b}>
                          Корпус: {b}
                        </option>
                      ))}
                    </select>
                  )}

                  {isLegacyTemplate && (
                    <button
                      type="button"
                      onClick={handleMigrateToNewTemplate}
                      className="text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors"
                      title="Добавить 17-й раздел «Гильзы и отверстия» с сохранением текущих статусов"
                    >
                      <RefreshCw size={12} /> Обновить шаблон (17 разделов)
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSection(!isAddingSection);
                      setIsManagingStatuses(false);
                    }}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                      isAddingSection
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    <FolderPlus size={13} /> + Новый раздел
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingStatuses(!isManagingStatuses);
                      setIsAddingSection(false);
                    }}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                      isManagingStatuses
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                    }`}
                  >
                    <Tag size={13} /> + Статус
                    {projectData.customStatuses.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 bg-white/80 text-purple-800 rounded-full text-[10px]">
                        {projectData.customStatuses.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSortByPriority(!sortByPriority)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                      sortByPriority
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                    title="Сортировать задачи внутри разделов по введенному приоритету"
                  >
                    <ArrowUpDown size={12} /> {sortByPriority ? 'По приоритету ✓' : 'По приоритету'}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleAllSections(true)}
                    className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Свернуть все
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllSections(false)}
                    className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Развернуть все
                  </button>
                  {Object.values(taskFilters).some(Boolean) && (
                    <button
                      onClick={() =>
                        setTaskFilters({ name: '', status: '', priority: '', estHours: '', date: '', comment: '' })
                      }
                      className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-lg flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Сбросить
                    </button>
                  )}
                </div>
              </div>

              {isAddingSection && (
                <form
                  onSubmit={handleAddCustomSection}
                  className="px-4 py-3 bg-indigo-50/70 border-b border-indigo-200/80 flex flex-wrap items-center gap-2"
                >
                  <span className="text-xs font-semibold text-indigo-900">Новый раздел:</span>
                  <input
                    type="text"
                    autoFocus
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="Например: 18. Насосная станция или Бассейн..."
                    className="flex-grow min-w-[220px] px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  {projectData.buildings.length > 0 && (
                    <select
                      value={newSectionBuilding}
                      onChange={(e) => setNewSectionBuilding(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg text-slate-700"
                    >
                      <option value="">Без привязки к корпусу</option>
                      {projectData.buildings.map((b: string) => (
                        <option key={b} value={b}>
                          Корпус: {b}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium"
                  >
                    Создать раздел
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingSection(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                  >
                    Отмена
                  </button>
                </form>
              )}

              {isManagingStatuses && (
                <div className="px-4 py-3 bg-purple-50/70 border-b border-purple-200/80 space-y-2.5">
                  <form onSubmit={handleAddCustomStatus} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-purple-900">Добавить уникальный статус:</span>
                    <input
                      type="text"
                      autoFocus
                      value={newCustomStatus}
                      onChange={(e) => setNewCustomStatus(e.target.value)}
                      placeholder="Например: ждет согласования / на проверке / уточнить..."
                      className="flex-grow min-w-[240px] px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium"
                    >
                      Добавить статус
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsManagingStatuses(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                    >
                      Закрыть
                    </button>
                  </form>

                  {projectData.customStatuses.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-slate-500 mr-1">Добавленные для этого проекта:</span>
                      {projectData.customStatuses.map((st: string) => (
                        <span
                          key={st}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-purple-200 text-purple-800 font-medium"
                        >
                          {st}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomStatus(st)}
                            className="text-purple-400 hover:text-rose-600"
                            title="Удалить статус из списка"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="pt-2.5 pb-1.5 px-2 w-14 text-center">✓ / ★</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-14 text-center">Пункт</th>
                      <th className="pt-2.5 pb-1.5 px-3 min-w-[250px]">Раздел / Задача</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-48">Статус</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-32">Приоритет</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-24 text-center">Время (ч)</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-36">Дата</th>
                      <th className="pt-2.5 pb-1.5 px-3 min-w-[200px]">Комментарий</th>
                    </tr>
                    <tr className="bg-slate-50/40 border-b border-slate-200">
                      <th className="pb-2 px-1"></th>
                      <th className="pb-2 px-2"></th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.name}
                          onChange={(v) => setTaskFilters({ ...taskFilters, name: v })}
                          placeholder="Название или код..."
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColSelectFilter
                          value={taskFilters.status}
                          options={availableTaskStatuses}
                          onChange={(v) => setTaskFilters({ ...taskFilters, status: v })}
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.priority}
                          onChange={(v) => setTaskFilters({ ...taskFilters, priority: v })}
                          placeholder="Фильтр..."
                          listId="project-priorities-list"
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.estHours}
                          onChange={(v) => setTaskFilters({ ...taskFilters, estHours: v })}
                          placeholder="ч..."
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.date}
                          onChange={(v) => setTaskFilters({ ...taskFilters, date: v })}
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.comment}
                          onChange={(v) => setTaskFilters({ ...taskFilters, comment: v })}
                          placeholder="Комментарий..."
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sectionsList.map((sec) => {
                      if (selectedBuildingFilter) {
                        if (selectedBuildingFilter === '__GENERAL__' && sec.building) return null;
                        if (selectedBuildingFilter !== '__GENERAL__' && sec.building !== selectedBuildingFilter) {
                          return null;
                        }
                      }

                      const hasFilter = Object.values(taskFilters).some(Boolean);
                      let visibleItems = sec.items.filter(({ task: t }) => {
                        const searchStr = `${t.building || ''} ${t.code || ''} ${t.name || ''}`.toLowerCase();
                        return (
                          (!taskFilters.name || searchStr.includes(taskFilters.name.toLowerCase())) &&
                          matchStatusFilter(t.status, taskFilters.status) &&
                          (!taskFilters.priority ||
                            String(t.priority || '')
                              .toLowerCase()
                              .includes(taskFilters.priority.toLowerCase())) &&
                          (!taskFilters.estHours ||
                            String(t.estHours || '')
                              .toLowerCase()
                              .includes(taskFilters.estHours.toLowerCase())) &&
                          matchDateFilter(t.date, taskFilters.date) &&
                          (!taskFilters.comment || (t.comment || '').toLowerCase().includes(taskFilters.comment.toLowerCase()))
                        );
                      });

                      if (sortByPriority) {
                        visibleItems = [...visibleItems].sort((a, b) => {
                          const pA = String(a.task.priority || '').trim();
                          const pB = String(b.task.priority || '').trim();
                          if (!pA && !pB) return 0;
                          if (!pA) return 1;
                          if (!pB) return -1;
                          return pA.localeCompare(pB, 'ru', { numeric: true });
                        });
                      }

                      if (hasFilter && visibleItems.length === 0) return null;

                      const isCollapsed = !hasFilter && Boolean(collapsedSections[sec.sectionKey]);
                      const isSectionComplete =
                        sec.totalActionable > 0 && sec.completedCount === sec.totalActionable;

                      return (
                        <React.Fragment key={sec.sectionKey}>
                          <tr className="bg-slate-100/90 hover:bg-slate-200/60 transition-colors">
                            <td colSpan={8} className="py-2 px-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCollapsedSections({
                                      ...collapsedSections,
                                      [sec.sectionKey]: !isCollapsed,
                                    })
                                  }
                                  className="flex flex-wrap items-center gap-2 font-bold text-xs text-slate-700 uppercase tracking-wider text-left"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight size={15} className="text-slate-500" />
                                  ) : (
                                    <ChevronDown size={15} className="text-slate-500" />
                                  )}
                                  {sec.building && (
                                    <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold normal-case">
                                      {sec.building}
                                    </span>
                                  )}
                                  <span>{sec.displayTitle}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold normal-case ${
                                      isSectionComplete
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-white text-slate-600 border border-slate-200/80'
                                    }`}
                                  >
                                    {sec.completedCount}/{sec.totalActionable}
                                    {isSectionComplete ? ' ✓' : ''}
                                  </span>
                                  {sec.remainingHours > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold normal-case bg-amber-50 text-amber-800 border border-amber-200/70">
                                      {Number(sec.remainingHours.toFixed(1))} ч
                                    </span>
                                  )}
                                </button>

                                <div className="flex items-center gap-1.5">
                                  {sec.headerIndex !== -1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCloningSectionKey(
                                          cloningSectionKey === sec.sectionKey ? null : sec.sectionKey
                                        );
                                        setCloneTargetBuilding(projectData.buildings[0] || '');
                                      }}
                                      className="text-[11px] font-medium text-slate-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-slate-200/80 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                      title="Скопировать этот раздел для отдельного корпуса / здания"
                                    >
                                      <Building2 size={11} /> Для корпуса
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCollapsedSections({ ...collapsedSections, [sec.sectionKey]: false });
                                      setAddingToSection(
                                        addingToSection === sec.sectionKey ? null : sec.sectionKey
                                      );
                                      setCustomTaskName('');
                                    }}
                                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-white/80 hover:bg-white border border-indigo-200/70 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                  >
                                    <Plus size={12} /> Подпункт
                                  </button>
                                  {sec.isCustomSection && sec.headerIndex !== -1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSectionByHeaderIndex(sec.headerIndex)}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-white/70 transition-colors"
                                      title="Удалить этот раздел"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {cloningSectionKey === sec.sectionKey && (
                                <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs normal-case font-normal">
                                  <span className="font-semibold text-slate-700">
                                    Дублировать раздел для корпуса:
                                  </span>
                                  <input
                                    type="text"
                                    list="project-buildings-datalist"
                                    value={cloneTargetBuilding}
                                    onChange={(e) => setCloneTargetBuilding(e.target.value)}
                                    placeholder="Здание B / Паркинг..."
                                    className="px-2.5 py-1 bg-white border border-indigo-300 rounded text-xs focus:outline-none"
                                  />
                                  <datalist id="project-buildings-datalist">
                                    {projectData.buildings.map((b: string) => (
                                      <option key={b} value={b} />
                                    ))}
                                  </datalist>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCloneSectionForBuilding(sec.headerIndex, cloneTargetBuilding)
                                    }
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded font-medium"
                                  >
                                    Создать копию
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCloningSectionKey(null)}
                                    className="text-slate-500 hover:text-slate-800 px-2 py-1"
                                  >
                                    Отмена
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>

                          {addingToSection === sec.sectionKey && sec.headerIndex !== -1 && (
                            <tr className="bg-indigo-50/50">
                              <td colSpan={8} className="p-2.5 px-4">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={customTaskName}
                                    onChange={(e) => setCustomTaskName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCustomTaskToSection(sec.headerIndex);
                                      }
                                    }}
                                    placeholder="Название дополнительного пункта..."
                                    className="flex-grow px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddCustomTaskToSection(sec.headerIndex)}
                                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                                  >
                                    Добавить
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAddingToSection(null)}
                                    className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                                  >
                                    Отмена
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}

                          {!isCollapsed &&
                            visibleItems.map(({ task: t, originalIndex }) => {
                              const isNotRequired = t.status === 'не требуется';
                              const isChecked = selectedTaskIndices.includes(originalIndex);
                              return (
                                <tr
                                  key={originalIndex}
                                  className={`group transition-colors ${
                                    t.todayPlan
                                      ? 'bg-amber-50/40 hover:bg-amber-100/40'
                                      : isChecked
                                      ? 'bg-indigo-50/70'
                                      : isNotRequired
                                      ? 'bg-slate-50/40 opacity-60'
                                      : 'hover:bg-slate-50/70'
                                  }`}
                                >
                                  <td className="p-2 text-center">
                                    <div className="inline-flex items-center gap-1">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleTaskSelection(originalIndex)}
                                        className="rounded text-indigo-600 cursor-pointer"
                                        title="Выбрать для массового изменения статуса"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const arr = [...projectData.tasks];
                                          arr[originalIndex].todayPlan = !arr[originalIndex].todayPlan;
                                          updateField('tasks', arr);
                                        }}
                                        className="p-0.5 rounded hover:bg-amber-100 transition-colors"
                                        title={t.todayPlan ? 'Убрать из плана на сегодня' : 'В план на сегодня'}
                                      >
                                        <Star
                                          size={14}
                                          className={
                                            t.todayPlan
                                              ? 'text-amber-500 fill-amber-400'
                                              : 'text-slate-200 group-hover:text-slate-400'
                                          }
                                        />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-2 text-center font-mono text-xs font-semibold text-slate-400">
                                    {t.code || ''}
                                  </td>
                                  <td
                                    className={`p-2 font-medium ${
                                      isNotRequired ? 'line-through text-slate-400' : 'text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span>
                                        {t.building && (
                                          <span className="inline-block px-1.5 py-0.2 mr-1.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                                            {t.building}
                                          </span>
                                        )}
                                        {t.name}
                                      </span>
                                      {t.isCustom && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const arr = projectData.tasks.filter(
                                              (_: any, idx: number) => idx !== originalIndex
                                            );
                                            updateField('tasks', arr);
                                          }}
                                          className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 shrink-0"
                                          title="Удалить добавленный пункт"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2">
                                    <StatusPill
                                      value={t.status}
                                      options={availableTaskStatuses}
                                      onChange={(val) => {
                                        const arr = [...projectData.tasks];
                                        arr[originalIndex].status = val;
                                        if (val && !arr[originalIndex].date && val !== 'не требуется') {
                                          arr[originalIndex].date = getTodayDMY();
                                        }
                                        updateField('tasks', arr);
                                      }}
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      list="project-priorities-list"
                                      value={t.priority || ''}
                                      onChange={(e) => {
                                        const arr = [...projectData.tasks];
                                        arr[originalIndex].priority = e.target.value;
                                        updateField('tasks', arr);
                                      }}
                                      placeholder="1 / Срочно..."
                                      className="w-full px-2 py-1 text-xs font-medium text-amber-900 bg-transparent hover:bg-amber-50/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 rounded focus:outline-none"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={t.estHours || ''}
                                      onChange={(e) => {
                                        const arr = [...projectData.tasks];
                                        arr[originalIndex].estHours = e.target.value;
                                        updateField('tasks', arr);
                                      }}
                                      placeholder="0"
                                      className="w-full px-2 py-1 text-xs text-center font-mono text-slate-700 bg-transparent hover:bg-slate-100/80 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 rounded focus:outline-none"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <DateInput
                                      value={t.date}
                                      onChange={(val) => {
                                        const arr = [...projectData.tasks];
                                        arr[originalIndex].date = val;
                                        updateField('tasks', arr);
                                      }}
                                    />
                                  </td>
                                  <td className="p-2">
                                    <AutoTextarea
                                      value={t.comment}
                                      onChange={(val) => {
                                        const arr = [...projectData.tasks];
                                        arr[originalIndex].comment = val;
                                        updateField('tasks', arr);
                                      }}
                                      placeholder="Примечание..."
                                      className="text-slate-600 text-xs"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* РАЗДЕЛ 2: ЗАМЕЧАНИЯ И ВОПРОСЫ */}
          {subTab === 'remarks' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800">
                    {noChecklist ? 'Вопросы, идеи и заметки' : 'Реестр замечаний и координации'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Можно вставлять скриншоты через Ctrl+V или перетаскивать мышкой в ячейку
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {Object.values(remarkFilters).some(Boolean) && (
                    <button
                      onClick={() =>
                        setRemarkFilters({
                          date: '',
                          to: '',
                          desc: '',
                          dateSent: '',
                          dateAnswer: '',
                          resolution: '',
                          status: '',
                        })
                      }
                      className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      <RotateCcw size={13} /> Сбросить
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyOpenRemarks}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                      copiedRemarks
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {copiedRemarks ? <Check size={14} /> : <Copy size={14} />}
                    {copiedRemarks ? 'Список скопирован!' : 'Копировать открытые'}
                  </button>
                  <button
                    onClick={() =>
                      updateField('remarks', [
                        {
                          id: Date.now(),
                          date: getTodayDMY(),
                          to: '',
                          desc: '',
                          screenshot: [],
                          dateSent: '',
                          dateAnswer: '',
                          resolution: '',
                          status: 'создан',
                        },
                        ...projectData.remarks,
                      ])
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus size={15} /> {noChecklist ? 'Добавить вопрос' : 'Добавить замечание'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="pt-2.5 pb-1.5 px-3 w-36">Дата</th>
                      <th className="pt-2.5 pb-1.5 px-3 w-36">{noChecklist ? 'Тема / Раздел' : 'Кому / От кого'}</th>
                      <th className="pt-2.5 pb-1.5 px-3 min-w-[200px]">Описание</th>
                      <th className="pt-2.5 pb-1.5 px-3 w-44 text-center">Скриншоты</th>
                      <th className="pt-2.5 pb-1.5 px-3 w-36">Отправлено</th>
                      <th className="pt-2.5 pb-1.5 px-3 w-36">Ответ получен</th>
                      <th className="pt-2.5 pb-1.5 px-3 min-w-[160px]">Решение</th>
                      <th className="pt-2.5 pb-1.5 px-3 w-44">Статус</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-10"></th>
                    </tr>
                    <tr className="bg-slate-50/40 border-b border-slate-200">
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={remarkFilters.date}
                          onChange={(v) => setRemarkFilters({ ...remarkFilters, date: v })}
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={remarkFilters.to}
                          onChange={(v) => setRemarkFilters({ ...remarkFilters, to: v })}
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={remarkFilters.desc}
                          onChange={(v) => setRemarkFilters({ ...remarkFilters, desc: v })}
                        />
                      </th>
                      <th className="pb-2 px-2"></th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={remarkFilters.dateSent}
                          onChange={(v) => setRemarkFilters({ ...remarkFilters, dateSent: v })}
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={remarkFilters.dateAnswer}
                          onChange={(v) => setRemarkFilters({ ...remarkFilters, dateAnswer: v })}
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={remarkFilters.resolution}
                          onChange={(v) => setRemarkFilters({ ...remarkFilters, resolution: v })}
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColSelectFilter
                          value={remarkFilters.status}
                          options={['создан', 'отправлен', 'частичный ответ', 'решен', 'не актуальный']}
                          onChange={(v) => setRemarkFilters({ ...remarkFilters, status: v })}
                        />
                      </th>
                      <th className="pb-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectData.remarks.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-400">
                          Записей пока нет.
                        </td>
                      </tr>
                    ) : (
                      projectData.remarks
                        .filter(
                          (r: any) =>
                            matchDateFilter(r.date, remarkFilters.date) &&
                            (!remarkFilters.to || (r.to || '').toLowerCase().includes(remarkFilters.to.toLowerCase())) &&
                            (!remarkFilters.desc || (r.desc || '').toLowerCase().includes(remarkFilters.desc.toLowerCase())) &&
                            matchDateFilter(r.dateSent, remarkFilters.dateSent) &&
                            matchDateFilter(r.dateAnswer, remarkFilters.dateAnswer) &&
                            (!remarkFilters.resolution ||
                              (r.resolution || '').toLowerCase().includes(remarkFilters.resolution.toLowerCase())) &&
                            matchStatusFilter(r.status, remarkFilters.status)
                        )
                        .map((r: any) => {
                          const st = (r.status || '').toLowerCase();
                          const daysWaiting = ['отправлен', 'частичный ответ'].includes(st)
                            ? getDaysSinceDate(r.dateSent || r.date)
                            : null;
                          const isStale = daysWaiting !== null && daysWaiting >= 5;

                          return (
                            <tr
                              key={r.id}
                              onPaste={(e) =>
                                handlePasteImage(e, (img) => {
                                  const next = projectData.remarks.map((item: any) =>
                                    item.id === r.id
                                      ? { ...item, screenshot: [...normalizeScreenshots(item.screenshot), img] }
                                      : item
                                  );
                                  updateField('remarks', next);
                                })
                              }
                              className={`group align-top ${
                                isStale ? 'bg-amber-50/50 hover:bg-amber-100/40' : 'hover:bg-slate-50/70'
                              }`}
                            >
                              <td className="p-2">
                                <DateInput
                                  value={r.date}
                                  onChange={(val) =>
                                    updateField(
                                      'remarks',
                                      projectData.remarks.map((item: any) =>
                                        item.id === r.id ? { ...item, date: val } : item
                                      )
                                    )
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  className="w-full px-2 py-1 text-xs font-medium bg-transparent hover:bg-slate-100/70 focus:bg-white rounded focus:outline-none"
                                  placeholder={noChecklist ? 'Тема...' : 'Архитектор...'}
                                  value={r.to}
                                  onChange={(e) =>
                                    updateField(
                                      'remarks',
                                      projectData.remarks.map((item: any) =>
                                        item.id === r.id ? { ...item, to: e.target.value } : item
                                      )
                                    )
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={r.desc}
                                  onChange={(val) =>
                                    updateField(
                                      'remarks',
                                      projectData.remarks.map((item: any) =>
                                        item.id === r.id ? { ...item, desc: val } : item
                                      )
                                    )
                                  }
                                  placeholder="Текст..."
                                />
                              </td>
                              <td className="p-2 text-center">
                                <ImageCell
                                  src={r.screenshot}
                                  onChange={(imgs) =>
                                    updateField(
                                      'remarks',
                                      projectData.remarks.map((item: any) =>
                                        item.id === r.id ? { ...item, screenshot: imgs } : item
                                      )
                                    )
                                  }
                                  onPreview={onPreviewImages}
                                />
                              </td>
                              <td className="p-2">
                                <DateInput
                                  value={r.dateSent}
                                  onChange={(val) =>
                                    updateField(
                                      'remarks',
                                      projectData.remarks.map((item: any) =>
                                        item.id === r.id ? { ...item, dateSent: val } : item
                                      )
                                    )
                                  }
                                />
                                {isStale && (
                                  <div className="mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold text-center">
                                    Ждём {daysWaiting} дн.
                                  </div>
                                )}
                              </td>
                              <td className="p-2">
                                <DateInput
                                  value={r.dateAnswer}
                                  onChange={(val) =>
                                    updateField(
                                      'remarks',
                                      projectData.remarks.map((item: any) =>
                                        item.id === r.id ? { ...item, dateAnswer: val } : item
                                      )
                                    )
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={r.resolution}
                                  onChange={(val) =>
                                    updateField(
                                      'remarks',
                                      projectData.remarks.map((item: any) =>
                                        item.id === r.id ? { ...item, resolution: val } : item
                                      )
                                    )
                                  }
                                  placeholder="Решение..."
                                  className="text-xs text-slate-600"
                                />
                              </td>
                              <td className="p-2">
                                <StatusPill
                                  value={r.status}
                                  options={['создан', 'отправлен', 'частичный ответ', 'решен', 'не актуальный']}
                                  onChange={(val) =>
                                    updateField(
                                      'remarks',
                                      projectData.remarks.map((item: any) =>
                                        item.id === r.id ? { ...item, status: val } : item
                                      )
                                    )
                                  }
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={() =>
                                    updateField(
                                      'remarks',
                                      projectData.remarks.filter((item: any) => item.id !== r.id)
                                    )
                                  }
                                  className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* РАЗДЕЛ 3: ЖУРНАЛ ВЫДАЧИ МОДЕЛЕЙ И ЧЕРТЕЖЕЙ (РЕВИЗИИ) */}
          {!noChecklist && subTab === 'revisions' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800">Журнал передачи моделей и чертежей (Ревизии)</h3>
                  <p className="text-xs text-slate-500">
                    Фиксируйте каждую отправку RVT, IFC, DWG, PDF для суперпозиции, экспертизы или подрядчика
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateField('revisions', [
                      {
                        id: Date.now(),
                        date: getTodayDMY(),
                        stage: projectData.stage || 'Суперпозиция',
                        format: 'RVT + DWG + PDF',
                        version: `Rev.${projectData.revisions.length + 1}`,
                        recipient: '',
                        comment: '',
                      },
                      ...projectData.revisions,
                    ])
                  }
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={15} /> Зафиксировать выдачу
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-2.5 px-3 w-36">Дата выдачи</th>
                      <th className="py-2.5 px-3 w-44">Цель / Стадия</th>
                      <th className="py-2.5 px-3 w-40">Формат файлов</th>
                      <th className="py-2.5 px-3 w-32">Версия / Ревизия</th>
                      <th className="py-2.5 px-3 w-48">Кому передано</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Что изменено / Примечание</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectData.revisions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          Записей о передаче моделей пока нет.
                        </td>
                      </tr>
                    ) : (
                      projectData.revisions.map((rev: any) => (
                        <tr key={rev.id} className="group hover:bg-slate-50/70 align-top">
                          <td className="p-2">
                            <DateInput
                              value={rev.date}
                              onChange={(val) =>
                                updateField(
                                  'revisions',
                                  projectData.revisions.map((item: any) =>
                                    item.id === rev.id ? { ...item, date: val } : item
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={rev.stage || ''}
                              onChange={(e) =>
                                updateField(
                                  'revisions',
                                  projectData.revisions.map((item: any) =>
                                    item.id === rev.id ? { ...item, stage: e.target.value } : item
                                  )
                                )
                              }
                              placeholder="Суперпозиция / היתר..."
                              className="w-full px-2 py-1 text-xs font-medium bg-transparent hover:bg-slate-100/70 focus:bg-white rounded focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={rev.format || ''}
                              onChange={(e) =>
                                updateField(
                                  'revisions',
                                  projectData.revisions.map((item: any) =>
                                    item.id === rev.id ? { ...item, format: e.target.value } : item
                                  )
                                )
                              }
                              placeholder="RVT / IFC / DWG / PDF"
                              className="w-full px-2 py-1 text-xs font-mono text-indigo-700 bg-transparent hover:bg-slate-100/70 focus:bg-white rounded focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={rev.version || ''}
                              onChange={(e) =>
                                updateField(
                                  'revisions',
                                  projectData.revisions.map((item: any) =>
                                    item.id === rev.id ? { ...item, version: e.target.value } : item
                                  )
                                )
                              }
                              placeholder="Rev.01"
                              className="w-full px-2 py-1 text-xs font-bold text-slate-700 bg-transparent hover:bg-slate-100/70 focus:bg-white rounded focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={rev.recipient || ''}
                              onChange={(e) =>
                                updateField(
                                  'revisions',
                                  projectData.revisions.map((item: any) =>
                                    item.id === rev.id ? { ...item, recipient: e.target.value } : item
                                  )
                                )
                              }
                              placeholder="BIM / Архитектор / Заказчик"
                              className="w-full px-2 py-1 text-xs bg-transparent hover:bg-slate-100/70 focus:bg-white rounded focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <AutoTextarea
                              value={rev.comment}
                              onChange={(val) =>
                                updateField(
                                  'revisions',
                                  projectData.revisions.map((item: any) =>
                                    item.id === rev.id ? { ...item, comment: val } : item
                                  )
                                )
                              }
                              placeholder="Описание ревизии..."
                              className="text-xs text-slate-600"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                updateField(
                                  'revisions',
                                  projectData.revisions.filter((item: any) => item.id !== rev.id)
                                )
                              }
                              className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* РАЗДЕЛ 4: РАЗРЕШЕНИЯ И ФАЙЛЫ */}
          {!noChecklist && subTab === 'docs' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">Разрешения и согласования</h3>
                    {isLegacyPermissions && (
                      <button
                        type="button"
                        onClick={handleUpgradePermissionsToNewTemplate}
                        className="text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1"
                        title="Обновить список разрешений по актуальному шаблону (1–7)"
                      >
                        <RefreshCw size={11} /> Обновить список
                      </button>
                    )}
                  </div>
                  {Object.values(permFilters).some(Boolean) && (
                    <button
                      onClick={() => setPermFilters({ name: '', status: '', date: '', comment: '' })}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="pt-2.5 pb-1.5 px-3">Наименование</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-48">Статус</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-32">Дата</th>
                      <th className="pt-2.5 pb-1.5 px-2 min-w-[140px]">Комментарий</th>
                    </tr>
                    <tr className="bg-slate-50/40 border-b border-slate-200">
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={permFilters.name}
                          onChange={(v) => setPermFilters({ ...permFilters, name: v })}
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColSelectFilter
                          value={permFilters.status}
                          options={PERMISSION_STATUS_OPTIONS}
                          onChange={(v) => setPermFilters({ ...permFilters, status: v })}
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={permFilters.date}
                          onChange={(v) => setPermFilters({ ...permFilters, date: v })}
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={permFilters.comment}
                          onChange={(v) => setPermFilters({ ...permFilters, comment: v })}
                          placeholder="Заметка..."
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectData.permissions.map((p: any, idx: number) => {
                      const hasPermFilter = Object.values(permFilters).some(Boolean);
                      if (p.isGroup) {
                        if (hasPermFilter) return null;
                        return (
                          <tr key={idx} className="bg-slate-100/80">
                            <td colSpan={4} className="py-2 px-3 font-bold text-xs text-slate-700">
                              {p.name}
                            </td>
                          </tr>
                        );
                      }

                      const matches =
                        (!permFilters.name || p.name.toLowerCase().includes(permFilters.name.toLowerCase())) &&
                        matchStatusFilter(p.status, permFilters.status) &&
                        matchDateFilter(p.date, permFilters.date) &&
                        (!permFilters.comment || (p.comment || '').toLowerCase().includes(permFilters.comment.toLowerCase()));

                      if (!matches) return null;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 align-top">
                          <td
                            className={`p-2 font-medium text-slate-700 text-xs ${
                              p.indent ? 'pl-6 text-slate-600' : ''
                            }`}
                          >
                            {p.name}
                          </td>
                          <td className="p-2">
                            <StatusPill
                              value={p.status}
                              options={PERMISSION_STATUS_OPTIONS}
                              onChange={(val) => {
                                const arr = [...projectData.permissions];
                                arr[idx].status = val;
                                if (val && !arr[idx].date && val !== 'не требуется') {
                                  arr[idx].date = getTodayDMY();
                                }
                                updateField('permissions', arr);
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <DateInput
                              value={p.date}
                              onChange={(val) => {
                                const arr = [...projectData.permissions];
                                arr[idx].date = val;
                                updateField('permissions', arr);
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <AutoTextarea
                              value={p.comment || ''}
                              onChange={(val) => {
                                const arr = [...projectData.permissions];
                                arr[idx].comment = val;
                                updateField('permissions', arr);
                              }}
                              placeholder="Комментарий..."
                              className="text-xs text-slate-600"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800">Исходные файлы и смежники</h3>
                  {Object.values(fileFilters).some(Boolean) && (
                    <button
                      onClick={() => setFileFilters({ name: '', status: '', date: '', comment: '' })}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="pt-2.5 pb-1.5 px-3">Раздел / Файл</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-40">Статус</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-32">Дата</th>
                      <th className="pt-2.5 pb-1.5 px-2 min-w-[140px]">Комментарий</th>
                    </tr>
                    <tr className="bg-slate-50/40 border-b border-slate-200">
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={fileFilters.name}
                          onChange={(v) => setFileFilters({ ...fileFilters, name: v })}
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColSelectFilter
                          value={fileFilters.status}
                          options={['есть', 'запросили', 'нет', 'не требуется']}
                          onChange={(v) => setFileFilters({ ...fileFilters, status: v })}
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={fileFilters.date}
                          onChange={(v) => setFileFilters({ ...fileFilters, date: v })}
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={fileFilters.comment}
                          onChange={(v) => setFileFilters({ ...fileFilters, comment: v })}
                          placeholder="Заметка..."
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectData.files.map((f: any, idx: number) => {
                      const matches =
                        (!fileFilters.name || f.name.toLowerCase().includes(fileFilters.name.toLowerCase())) &&
                        matchStatusFilter(f.status, fileFilters.status) &&
                        matchDateFilter(f.date, fileFilters.date) &&
                        (!fileFilters.comment || (f.comment || '').toLowerCase().includes(fileFilters.comment.toLowerCase()));
                      if (!matches) return null;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 align-top">
                          <td className="p-2.5 font-medium text-slate-700 text-xs">{f.name}</td>
                          <td className="p-2">
                            <StatusPill
                              value={f.status}
                              options={['есть', 'запросили', 'нет', 'не требуется']}
                              onChange={(val) => {
                                const arr = [...projectData.files];
                                arr[idx].status = val;
                                if (val && !arr[idx].date && val !== 'не требуется') {
                                  arr[idx].date = getTodayDMY();
                                }
                                updateField('files', arr);
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <DateInput
                              value={f.date}
                              onChange={(val) => {
                                const arr = [...projectData.files];
                                arr[idx].date = val;
                                updateField('files', arr);
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <AutoTextarea
                              value={f.comment || ''}
                              onChange={(val) => {
                                const arr = [...projectData.files];
                                arr[idx].comment = val;
                                updateField('files', arr);
                              }}
                              placeholder="Комментарий..."
                              className="text-xs text-slate-600"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* РАЗДЕЛ 5: ВСТРЕЧИ И БЫСТРЫЕ ЗАДАЧИ ПО ПРОЕКТУ */}
          {subTab === 'related' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      Протоколы встреч по проекту {projectData.num} ({projectMeetings.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Все изменения синхронизируются с общей вкладкой «Встречи»
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {Object.values(relMeetingFilters).some(Boolean) && (
                      <button
                        onClick={() =>
                          setRelMeetingFilters({
                            date: '',
                            dueDate: '',
                            desc: '',
                            fix: '',
                            status: '',
                            comment: '',
                          })
                        }
                        className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1"
                      >
                        <RotateCcw size={13} /> Сбросить
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setMeetings([
                          {
                            id: Date.now(),
                            projectNum: projectData.num,
                            date: getTodayDMY(),
                            dueDate: '',
                            desc: '',
                            fix: '',
                            screenshot: [],
                            status: 'в работе',
                            comment: '',
                            todayPlan: false,
                          },
                          ...meetings,
                        ])
                      }
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 shadow-xs"
                    >
                      <Plus size={14} /> Добавить встречу
                    </button>
                    <button
                      onClick={() => onNavigateWithFilter(1, projectData.num)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      В общий список <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                        <th className="pt-2.5 pb-1.5 px-3 w-36">Дата встречи</th>
                        <th className="pt-2.5 pb-1.5 px-3 w-36">На когда</th>
                        <th className="pt-2.5 pb-1.5 px-3 min-w-[200px]">Описание вопроса</th>
                        <th className="pt-2.5 pb-1.5 px-3 min-w-[200px]">Что исправить</th>
                        <th className="pt-2.5 pb-1.5 px-3 w-44 text-center">Скриншоты</th>
                        <th className="pt-2.5 pb-1.5 px-3 w-44">Статус</th>
                        <th className="pt-2.5 pb-1.5 px-3 min-w-[160px]">Комментарий</th>
                        <th className="pt-2.5 pb-1.5 px-2 w-10"></th>
                      </tr>
                      <tr className="bg-slate-50/40 border-b border-slate-200">
                        <th className="pb-2 px-2">
                          <ColTextFilter
                            value={relMeetingFilters.date}
                            onChange={(v) => setRelMeetingFilters({ ...relMeetingFilters, date: v })}
                            placeholder="ДД/ММ/ГГГГ"
                          />
                        </th>
                        <th className="pb-2 px-2">
                          <ColTextFilter
                            value={relMeetingFilters.dueDate}
                            onChange={(v) => setRelMeetingFilters({ ...relMeetingFilters, dueDate: v })}
                            placeholder="ДД/ММ/ГГГГ"
                          />
                        </th>
                        <th className="pb-2 px-2">
                          <ColTextFilter
                            value={relMeetingFilters.desc}
                            onChange={(v) => setRelMeetingFilters({ ...relMeetingFilters, desc: v })}
                          />
                        </th>
                        <th className="pb-2 px-2">
                          <ColTextFilter
                            value={relMeetingFilters.fix}
                            onChange={(v) => setRelMeetingFilters({ ...relMeetingFilters, fix: v })}
                          />
                        </th>
                        <th className="pb-2 px-2"></th>
                        <th className="pb-2 px-2">
                          <ColSelectFilter
                            value={relMeetingFilters.status}
                            options={['в работе', 'исправлено', 'на паузе', 'передано другому']}
                            onChange={(v) => setRelMeetingFilters({ ...relMeetingFilters, status: v })}
                          />
                        </th>
                        <th className="pb-2 px-2">
                          <ColTextFilter
                            value={relMeetingFilters.comment}
                            onChange={(v) => setRelMeetingFilters({ ...relMeetingFilters, comment: v })}
                          />
                        </th>
                        <th className="pb-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectMeetings.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            По этому проекту пока нет записей встреч.
                          </td>
                        </tr>
                      ) : (
                        projectMeetings
                          .filter(
                            (m: any) =>
                              matchDateFilter(m.date, relMeetingFilters.date) &&
                              matchDateFilter(m.dueDate, relMeetingFilters.dueDate) &&
                              (!relMeetingFilters.desc ||
                                (m.desc || '').toLowerCase().includes(relMeetingFilters.desc.toLowerCase())) &&
                              (!relMeetingFilters.fix ||
                                (m.fix || '').toLowerCase().includes(relMeetingFilters.fix.toLowerCase())) &&
                              matchStatusFilter(m.status, relMeetingFilters.status) &&
                              (!relMeetingFilters.comment ||
                                (m.comment || '').toLowerCase().includes(relMeetingFilters.comment.toLowerCase()))
                          )
                          .map((m: any) => (
                            <tr
                              key={m.id}
                              onPaste={(e) => handlePasteImage(e, (img) => appendScreenshotToMeetingRow(m.id, img))}
                              className="group hover:bg-slate-50/70 align-top"
                            >
                              <td className="p-2">
                                <DateInput
                                  value={m.date}
                                  onChange={(val) => updateMeetingRow(m.id, 'date', val)}
                                />
                              </td>
                              <td className="p-2">
                                <DateInput
                                  value={m.dueDate || ''}
                                  onChange={(val) => updateMeetingRow(m.id, 'dueDate', val)}
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={m.desc}
                                  onChange={(val) => updateMeetingRow(m.id, 'desc', val)}
                                  placeholder="Суть вопроса..."
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={m.fix}
                                  onChange={(val) => updateMeetingRow(m.id, 'fix', val)}
                                  placeholder="Что исправить..."
                                />
                              </td>
                              <td className="p-2 text-center">
                                <ImageCell
                                  src={m.screenshot}
                                  onChange={(imgs) => updateMeetingRow(m.id, 'screenshot', imgs)}
                                  onPreview={onPreviewImages}
                                />
                              </td>
                              <td className="p-2">
                                <StatusPill
                                  value={m.status}
                                  options={['в работе', 'исправлено', 'на паузе', 'передано другому']}
                                  onChange={(val) => updateMeetingRow(m.id, 'status', val)}
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={m.comment}
                                  onChange={(val) => updateMeetingRow(m.id, 'comment', val)}
                                  placeholder="Заметка..."
                                  className="text-xs text-slate-600"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setMeetings(meetings.filter((mtg: any) => mtg.id !== m.id))}
                                  className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      Быстрые задачи по проекту {projectData.num} ({projectQuickTasks.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Все изменения синхронизируются со вкладкой «Задачи»
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {Object.values(relTaskFilters).some(Boolean) && (
                      <button
                        onClick={() =>
                          setRelTaskFilters({ date: '', desc: '', estDate: '', status: '', comment: '' })
                        }
                        className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1"
                      >
                        <RotateCcw size={13} /> Сбросить
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setTasks([
                          {
                            id: Date.now(),
                            num: tasks.length + 1,
                            date: getTodayDMY(),
                            project: projectData.num,
                            desc: '',
                            estDate: '',
                            status: 'не выполнена',
                            comment: '',
                          },
                          ...tasks,
                        ])
                      }
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 shadow-xs"
                    >
                      <Plus size={14} /> Добавить задачу
                    </button>
                    <button
                      onClick={() => onNavigateWithFilter(4, projectData.num)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      В общий список <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                        <th className="pt-2.5 pb-1.5 px-3 w-36">Дата создания</th>
                        <th className="pt-2.5 pb-1.5 px-3 min-w-[260px]">Описание задачи</th>
                        <th className="pt-2.5 pb-1.5 px-3 w-36">Дедлайн</th>
                        <th className="pt-2.5 pb-1.5 px-3 w-44">Статус</th>
                        <th className="pt-2.5 pb-1.5 px-3 min-w-[180px]">Комментарий</th>
                        <th className="pt-2.5 pb-1.5 px-2 w-10"></th>
                      </tr>
                      <tr className="bg-slate-50/40 border-b border-slate-200">
                        <th className="pb-2 px-2">
                          <ColTextFilter
                            value={relTaskFilters.date}
                            onChange={(v) => setRelTaskFilters({ ...relTaskFilters, date: v })}
                            placeholder="ДД/ММ/ГГГГ"
                          />
                        </th>
                        <th className="pb-2 px-2">
                          <ColTextFilter
                            value={relTaskFilters.desc}
                            onChange={(v) => setRelTaskFilters({ ...relTaskFilters, desc: v })}
                          />
                        </th>
                        <th className="pb-2 px-2">
                          <ColTextFilter
                            value={relTaskFilters.estDate}
                            onChange={(v) => setRelTaskFilters({ ...relTaskFilters, estDate: v })}
                            placeholder="ДД/ММ/ГГГГ"
                          />
                        </th>
                        <th className="pb-2 px-2">
                          <ColSelectFilter
                            value={relTaskFilters.status}
                            options={['не выполнена', 'в работе', 'выполнена', 'на паузе']}
                            onChange={(v) => setRelTaskFilters({ ...relTaskFilters, status: v })}
                          />
                        </th>
                        <th className="pb-2 px-2">
                          <ColTextFilter
                            value={relTaskFilters.comment}
                            onChange={(v) => setRelTaskFilters({ ...relTaskFilters, comment: v })}
                          />
                        </th>
                        <th className="pb-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectQuickTasks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            По этому проекту пока нет быстрых задач.
                          </td>
                        </tr>
                      ) : (
                        projectQuickTasks
                          .filter(
                            (t: any) =>
                              matchDateFilter(t.date, relTaskFilters.date) &&
                              (!relTaskFilters.desc ||
                                (t.desc || '').toLowerCase().includes(relTaskFilters.desc.toLowerCase())) &&
                              matchDateFilter(t.estDate, relTaskFilters.estDate) &&
                              matchStatusFilter(t.status, relTaskFilters.status) &&
                              (!relTaskFilters.comment ||
                                (t.comment || '').toLowerCase().includes(relTaskFilters.comment.toLowerCase()))
                          )
                          .map((t: any) => (
                            <tr key={t.id} className="group hover:bg-slate-50/70 align-top">
                              <td className="p-2">
                                <DateInput
                                  value={t.date}
                                  onChange={(val) => updateQuickTaskRow(t.id, 'date', val)}
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={t.desc}
                                  onChange={(val) => updateQuickTaskRow(t.id, 'desc', val)}
                                  placeholder="Описание задачи..."
                                />
                              </td>
                              <td className="p-2">
                                <DateInput
                                  value={t.estDate}
                                  onChange={(val) => updateQuickTaskRow(t.id, 'estDate', val)}
                                />
                              </td>
                              <td className="p-2">
                                <StatusPill
                                  value={t.status}
                                  options={['не выполнена', 'в работе', 'выполнена', 'на паузе']}
                                  onChange={(val) => updateQuickTaskRow(t.id, 'status', val)}
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={t.comment}
                                  onChange={(val) => updateQuickTaskRow(t.id, 'comment', val)}
                                  placeholder="Заметка..."
                                  className="text-xs text-slate-600"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setTasks(tasks.filter((item: any) => item.id !== t.id))}
                                  className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// === 12. ВКЛАДКА 3: ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ ===

function TabWeeklyReport({ reports, setReports, projects }: any) {
  const [weekFilter, setWeekFilter] = useState(getCurrentISOWeek());
  const [filters, setFilters] = useState({
    project: '',
    stage: '',
    deadline: '',
    done: '',
    inProgress: '',
    blockers: '',
    comment: '',
  });
  const [copiedWeek, setCopiedWeek] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter((p: any) => !p.archived),
    [projects]
  );

  const visibleReports = reports.filter(
    (r: any) =>
      (!weekFilter || r.week === weekFilter) &&
      (!filters.project || (r.project || '').toLowerCase().includes(filters.project.toLowerCase())) &&
      (!filters.stage || (r.stage || '').toLowerCase().includes(filters.stage.toLowerCase())) &&
      matchDateFilter(r.deadline, filters.deadline) &&
      (!filters.done || (r.done || '').toLowerCase().includes(filters.done.toLowerCase())) &&
      (!filters.inProgress || (r.inProgress || '').toLowerCase().includes(filters.inProgress.toLowerCase())) &&
      (!filters.blockers || (r.blockers || '').toLowerCase().includes(filters.blockers.toLowerCase())) &&
      (!filters.comment || (r.comment || '').toLowerCase().includes(filters.comment.toLowerCase()))
  );

  const updateReport = (id: any, field: string, value: any) => {
    setReports(reports.map((r: any) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleAutoPopulateFromProjects = () => {
    if (!activeProjects.length) {
      alert('Нет активных проектов для заполнения отчета.');
      return;
    }
    const targetWeek = weekFilter || getCurrentISOWeek();
    const updatedList = [...reports];
    let addedCount = 0;
    let updatedCount = 0;

    activeProjects.forEach((p: any, index: number) => {
      const summary = buildProjectReportSummary(p, targetWeek);
      const existingIdx = updatedList.findIndex(
        (r: any) =>
          r.week === targetWeek &&
          (r.projectId === p.id || (r.project || '').trim() === (p.num || '').trim())
      );

      if (existingIdx !== -1) {
        updatedList[existingIdx] = {
          ...updatedList[existingIdx],
          projectId: p.id,
          project: p.num,
          stage: summary.stage || updatedList[existingIdx].stage,
          deadline: summary.deadline || updatedList[existingIdx].deadline,
          done: summary.done,
          inProgress: summary.inProgress || updatedList[existingIdx].inProgress,
          blockers: summary.blockers,
        };
        updatedCount++;
      } else {
        updatedList.push({
          id: Date.now() + index,
          week: targetWeek,
          projectId: p.id,
          project: p.num,
          stage: summary.stage,
          deadline: summary.deadline,
          done: summary.done,
          inProgress: summary.inProgress,
          blockers: summary.blockers,
          comment: '',
        });
        addedCount++;
      }
    });

    setReports(updatedList);
    alert(
      `Отчет за ${targetWeek} актуализирован!\nДобавлено новых строк: ${addedCount}\nОбновлено существующих: ${updatedCount}`
    );
  };

  const handleCopyWeeklyReport = () => {
    const titleWeek = weekFilter || 'Все недели';
    const header = `Еженедельный статус по проектам (${titleWeek}):\n\n`;
    const body = visibleReports
      .map((r: any, idx: number) => {
        const title = `${idx + 1}. Проект ${r.project || '—'}${r.stage ? ` [${r.stage}]` : ''}${
          r.deadline ? ` (Дедлайн: ${formatToDMY(r.deadline)})` : ''
        }`;
        const lines = [
          title,
          r.done ? `   • Выполнено: ${r.done}` : '',
          r.inProgress ? `   • В работе: ${r.inProgress}` : '',
          r.blockers ? `   • Блокеры / Вопросы: ${r.blockers}` : '',
          r.comment ? `   • Комментарий: ${r.comment}` : '',
        ].filter(Boolean);
        return lines.join('\n');
      })
      .join('\n\n');

    navigator.clipboard.writeText(header + body);
    setCopiedWeek(true);
    setTimeout(() => setCopiedWeek(false), 2500);
  };

  const weekRange = getWeekRange(weekFilter);
  const weekRangeText = weekRange
    ? `${formatToDMY(weekRange.start.toISOString().slice(0, 10))} — ${formatToDMY(
        weekRange.end.toISOString().slice(0, 10)
      )}`
    : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Еженедельный статус по проектам</h2>
            {weekRangeText && (
              <p className="text-xs text-slate-400">Период недели: {weekRangeText}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <Calendar size={14} className="text-indigo-600" />
            <input
              type="week"
              className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
            />
            {weekFilter && (
              <button
                onClick={() => setWeekFilter('')}
                className="text-slate-400 hover:text-slate-600 ml-1"
                title="Показать все недели"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoPopulateFromProjects}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Собрать выполненное за выбранную неделю, активные задачи и блокеры из активных проектов"
          >
            <RefreshCw size={14} /> Заполнить из проектов
          </button>

          <button
            type="button"
            onClick={handleCopyWeeklyReport}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              copiedWeek
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {copiedWeek ? <Check size={14} /> : <Copy size={14} />}
            {copiedWeek ? 'Отчет скопирован!' : 'Копировать отчет'}
          </button>

          <button
            onClick={() =>
              exportToCSV(
                visibleReports.map(({ id, projectId, ...rest }: any) => rest),
                `Weekly_Report_${weekFilter || 'All'}.csv`
              )
            }
            className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
          >
            <Download size={14} /> CSV
          </button>

          <button
            onClick={() =>
              setReports([
                ...reports,
                {
                  id: Date.now(),
                  week: weekFilter || getCurrentISOWeek(),
                  project: '',
                  stage: '',
                  deadline: '',
                  done: '',
                  inProgress: '',
                  blockers: '',
                  comment: '',
                },
              ])
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} /> Добавить проект
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="pt-3 pb-1.5 px-3 w-24">Проект</th>
                <th className="pt-3 pb-1.5 px-3 w-36">Стадия</th>
                <th className="pt-3 pb-1.5 px-3 w-36">Дедлайн этапа</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[200px]">Выполнено на этой неделе</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[200px]">В работе / Далее</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[180px]">Проблемы / Блокеры</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[150px]">Комментарий</th>
                <th className="pt-3 pb-1.5 px-2 w-10"></th>
              </tr>
              <tr className="bg-slate-50/40 border-b border-slate-200">
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.project}
                    onChange={(v) => setFilters({ ...filters, project: v })}
                    placeholder="№..."
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.stage}
                    onChange={(v) => setFilters({ ...filters, stage: v })}
                    placeholder="Стадия..."
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.deadline}
                    onChange={(v) => setFilters({ ...filters, deadline: v })}
                    placeholder="ДД/ММ/ГГГГ"
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.done}
                    onChange={(v) => setFilters({ ...filters, done: v })}
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.inProgress}
                    onChange={(v) => setFilters({ ...filters, inProgress: v })}
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.blockers}
                    onChange={(v) => setFilters({ ...filters, blockers: v })}
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.comment}
                    onChange={(v) => setFilters({ ...filters, comment: v })}
                  />
                </th>
                <th className="pb-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Записей за выбранный период нет. Нажмите «Заполнить из проектов» или добавьте строку вручную.
                  </td>
                </tr>
              ) : (
                visibleReports.map((r: any) => (
                  <tr key={r.id} className="group hover:bg-slate-50/70 align-top">
                    <td className="p-2">
                      <input
                        className="w-full px-2 py-1 font-semibold text-indigo-600 bg-transparent hover:bg-slate-100/70 focus:bg-white rounded focus:outline-none"
                        placeholder="№..."
                        value={r.project}
                        onChange={(e) => updateReport(r.id, 'project', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="w-full px-2 py-1 text-xs font-medium text-slate-700 bg-transparent hover:bg-slate-100/70 focus:bg-white rounded focus:outline-none"
                        placeholder="היתר / ביצוע..."
                        value={r.stage || ''}
                        onChange={(e) => updateReport(r.id, 'stage', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <DateInput
                        value={r.deadline || ''}
                        onChange={(val) => updateReport(r.id, 'deadline', val)}
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={r.done}
                        onChange={(val) => updateReport(r.id, 'done', val)}
                        placeholder="Что сделано за неделю..."
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={r.inProgress}
                        onChange={(val) => updateReport(r.id, 'inProgress', val)}
                        placeholder="Текущие задачи..."
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={r.blockers}
                        onChange={(val) => updateReport(r.id, 'blockers', val)}
                        placeholder="Что тормозит работу..."
                        className="text-rose-700"
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={r.comment}
                        onChange={(val) => updateReport(r.id, 'comment', val)}
                        placeholder="Заметки..."
                        className="text-xs text-slate-600"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => setReports(reports.filter((rep: any) => rep.id !== r.id))}
                        className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// === 13. ВКЛАДКА 4: БЫСТРЫЕ ЗАДАЧИ ===

function TabTasks({
  tasks,
  setTasks,
  externalProjectFilter,
  onClearExternalFilter,
}: any) {
  const [filters, setFilters] = useState({
    date: '',
    project: '',
    desc: '',
    estDate: '',
    status: '',
    comment: '',
  });

  useEffect(() => {
    if (externalProjectFilter) {
      setFilters((prev) => ({ ...prev, project: externalProjectFilter }));
      if (onClearExternalFilter) onClearExternalFilter();
    }
  }, [externalProjectFilter, onClearExternalFilter]);

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const resetFilters = () =>
    setFilters({ date: '', project: '', desc: '', estDate: '', status: '', comment: '' });

  const filtered = tasks.filter(
    (t: any) =>
      matchDateFilter(t.date, filters.date) &&
      (!filters.project || (t.project || '').toLowerCase().includes(filters.project.toLowerCase())) &&
      (!filters.desc || (t.desc || '').toLowerCase().includes(filters.desc.toLowerCase())) &&
      matchDateFilter(t.estDate, filters.estDate) &&
      matchStatusFilter(t.status, filters.status) &&
      (!filters.comment || (t.comment || '').toLowerCase().includes(filters.comment.toLowerCase()))
  );

  const updateTask = (id: any, field: string, value: any) => {
    setTasks(tasks.map((t: any) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Оперативные задачи и поручения</h2>
          <p className="text-xs text-slate-500">Контроль текущих поручений с подсветкой приближающихся дедлайнов</p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <RotateCcw size={13} /> Сбросить
            </button>
          )}
          <button
            onClick={() =>
              setTasks([
                {
                  id: Date.now(),
                  num: tasks.length + 1,
                  date: getTodayDMY(),
                  project: filters.project || '',
                  desc: '',
                  estDate: '',
                  status: 'не выполнена',
                  comment: '',
                },
                ...tasks,
              ])
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={16} /> Новая задача
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="pt-3 pb-1.5 px-3 w-12 text-center">№</th>
                <th className="pt-3 pb-1.5 px-3 w-36">Дата создания</th>
                <th className="pt-3 pb-1.5 px-3 w-28">Проект</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[260px]">Описание задачи</th>
                <th className="pt-3 pb-1.5 px-3 w-36">Дедлайн</th>
                <th className="pt-3 pb-1.5 px-3 w-44">Статус</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[180px]">Комментарий</th>
                <th className="pt-3 pb-1.5 px-2 w-10"></th>
              </tr>
              <tr className="bg-slate-50/40 border-b border-slate-200">
                <th className="pb-2.5 px-2"></th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.date}
                    onChange={(v) => setFilters({ ...filters, date: v })}
                    placeholder="ДД/ММ/ГГГГ"
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.project}
                    onChange={(v) => setFilters({ ...filters, project: v })}
                    placeholder="№..."
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.desc}
                    onChange={(v) => setFilters({ ...filters, desc: v })}
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.estDate}
                    onChange={(v) => setFilters({ ...filters, estDate: v })}
                    placeholder="ДД/ММ/ГГГГ"
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColSelectFilter
                    value={filters.status}
                    options={['не выполнена', 'в работе', 'выполнена', 'на паузе']}
                    onChange={(v) => setFilters({ ...filters, status: v })}
                  />
                </th>
                <th className="pb-2.5 px-2">
                  <ColTextFilter
                    value={filters.comment}
                    onChange={(v) => setFilters({ ...filters, comment: v })}
                  />
                </th>
                <th className="pb-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Задач по заданным фильтрам не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map((t: any, idx: number) => {
                  const isDone = (t.status || '').toLowerCase() === 'выполнена';
                  const urgency = !isDone ? getDeadlineUrgency(t.estDate) : null;
                  const rowBg =
                    urgency === 'overdue'
                      ? 'bg-rose-50/70 hover:bg-rose-100/60'
                      : urgency === 'soon'
                      ? 'bg-amber-50/60 hover:bg-amber-100/50'
                      : 'hover:bg-slate-50/70';

                  return (
                    <tr key={t.id} className={`group align-top transition-colors ${rowBg}`}>
                      <td className="p-2.5 text-center font-mono text-xs text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="p-2">
                        <DateInput
                          value={t.date}
                          onChange={(val) => updateTask(t.id, 'date', val)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full px-2 py-1 font-semibold text-indigo-600 bg-transparent hover:bg-slate-100/70 focus:bg-white rounded focus:outline-none"
                          placeholder="№..."
                          value={t.project}
                          onChange={(e) => updateTask(t.id, 'project', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <AutoTextarea
                          value={t.desc}
                          onChange={(val) => updateTask(t.id, 'desc', val)}
                          placeholder="Что нужно сделать..."
                          className={isDone ? 'line-through text-slate-400' : ''}
                        />
                      </td>
                      <td className="p-2">
                        <DateInput
                          value={t.estDate}
                          onChange={(val) => updateTask(t.id, 'estDate', val)}
                          className={
                            urgency === 'overdue'
                              ? 'text-rose-700 font-bold'
                              : urgency === 'soon'
                              ? 'text-amber-800 font-semibold'
                              : ''
                          }
                        />
                      </td>
                      <td className="p-2">
                        <StatusPill
                          value={t.status}
                          options={['не выполнена', 'в работе', 'выполнена', 'на паузе']}
                          onChange={(val) => updateTask(t.id, 'status', val)}
                        />
                      </td>
                      <td className="p-2">
                        <AutoTextarea
                          value={t.comment}
                          onChange={(val) => updateTask(t.id, 'comment', val)}
                          placeholder="Заметка..."
                          className="text-xs text-slate-600"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => setTasks(tasks.filter((item: any) => item.id !== t.id))}
                          className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// === 14. ГЛАВНОЕ ПРИЛОЖЕНИЕ + СИНХРОНИЗАЦИЯ С GOOGLE ДИСКОМ + ЗАЩИТА ОТ КОНФЛИКТОВ ===

export default function App() {
  const [activeTab, setActiveTab] = useState(0);

  const [projects, setProjects, projectsLoaded] = useIndexedStorage<any[]>('sup_projects_v2', []);
  const [meetings, setMeetings, meetingsLoaded] = useIndexedStorage<any[]>('sup_meetings_v2', []);
  const [reports, setReports, reportsLoaded] = useIndexedStorage<any[]>('sup_reports_v2', []);
  const [tasks, setTasks, tasksLoaded] = useIndexedStorage<any[]>('sup_tasks_v2', []);
  const [calendarEvents, setCalendarEvents, calendarLoaded] = useIndexedStorage<any[]>('sup_calendar_events_v1', []);
  const [activeProjectId, setActiveProjectId, activeProjLoaded] = useIndexedStorage<string>('sup_active_project_id_v2', '');

  const isStorageReady =
    projectsLoaded && meetingsLoaded && reportsLoaded && tasksLoaded && calendarLoaded && activeProjLoaded;

  const [externalProjectFilter, setExternalProjectFilter] = useState('');
  const [externalProjectSubTab, setExternalProjectSubTab] = useState<
    'tasks' | 'remarks' | 'revisions' | 'docs' | 'related' | undefined
  >(undefined);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [lightboxState, setLightboxState] = useState<{
    images: string[];
    initialIndex: number;
    onSaveEdited?: (idx: number, newUrl: string) => void;
  } | null>(null);

  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [activeAlertBanner, setActiveAlertBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // === СОСТОЯНИЕ GOOGLE DRIVE SYNC + ЗАЩИТА ОТ КОНФЛИКТОВ ===
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [gdriveFileId, setGdriveFileId] = useState<string | null>(null);
  const [gdriveModifiedTime, setGdriveModifiedTime] = useState<string | null>(null);
  const [gdriveConflictTime, setGdriveConflictTime] = useState<string | null>(null);
  const [gdriveStatus, setGdriveStatus] = useState<'disconnected' | 'syncing' | 'synced' | 'conflict' | 'error'>('disconnected');
  const [gdriveLastSync, setGdriveLastSync] = useState<string>('');
  const [gdriveErrorMsg, setGdriveErrorMsg] = useState<string>('');
  const tokenClientRef = useRef<any>(null);
  const isRemoteApplyingRef = useRef(false);

  useEffect(() => {
    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) return;
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  const findCloudFileMeta = async (token: string): Promise<{ id: string; modifiedTime: string } | null> => {
    const query = encodeURIComponent(`name='${CLOUD_DB_FILENAME}' and trashed=false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) {
      throw new Error(`Ошибка поиска файла на Google Диске (${res.status})`);
    }
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return {
        id: data.files[0].id,
        modifiedTime: data.files[0].modifiedTime,
      };
    }
    return null;
  };

  const getRemoteFileModifiedTime = async (token: string, fileId: string): Promise<string | null> => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.modifiedTime || null;
  };

  const uploadPayloadToDrive = async (
    token: string,
    existingFileId: string | null,
    payloadObj: any
  ): Promise<{ id: string; modifiedTime: string }> => {
    const metadata = {
      name: CLOUD_DB_FILENAME,
      mimeType: 'application/json',
    };
    const boundary = '-------sup_tracker_sync_boundary_314159';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const multipartBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(payloadObj) +
      closeDelim;

    const url = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,modifiedTime`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime';

    const method = existingFileId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartBody,
    });

    if (!res.ok) {
      throw new Error(`Ошибка сохранения на Google Диск (${res.status})`);
    }
    const data = await res.json();
    return {
      id: data.id,
      modifiedTime: data.modifiedTime || new Date().toISOString(),
    };
  };

  const pullLatestFromGoogleDrive = async () => {
    if (!gdriveToken || !gdriveFileId) return;
    try {
      setGdriveStatus('syncing');
      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${gdriveFileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${gdriveToken}` },
        }
      );
      if (!fileRes.ok) throw new Error('Не удалось скачать файл с Google Диска');
      const cloudData = await fileRes.json();
      const freshModified = await getRemoteFileModifiedTime(gdriveToken, gdriveFileId);

      isRemoteApplyingRef.current = true;
      if (cloudData.projects) setProjects(cloudData.projects);
      if (cloudData.meetings) setMeetings(cloudData.meetings);
      if (cloudData.reports) setReports(cloudData.reports);
      if (cloudData.tasks) setTasks(cloudData.tasks);
      if (cloudData.calendarEvents) setCalendarEvents(cloudData.calendarEvents);
      if (cloudData.activeProjectId) setActiveProjectId(cloudData.activeProjectId);

      setGdriveModifiedTime(freshModified || new Date().toISOString());
      setGdriveConflictTime(null);
      setGdriveStatus('synced');
      setGdriveLastSync(
        new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      );
      setTimeout(() => {
        isRemoteApplyingRef.current = false;
      }, 600);
    } catch (err: any) {
      setGdriveStatus('error');
      setGdriveErrorMsg(err?.message || 'Ошибка загрузки с диска');
    }
  };

  const forceOverwriteGoogleDrive = async () => {
    if (!gdriveToken) return;
    try {
      setGdriveStatus('syncing');
      const payload = {
        projects,
        meetings,
        reports,
        tasks,
        calendarEvents,
        activeProjectId,
        exportedAt: new Date().toISOString(),
      };
      const saved = await uploadPayloadToDrive(gdriveToken, gdriveFileId, payload);
      setGdriveFileId(saved.id);
      setGdriveModifiedTime(saved.modifiedTime);
      setGdriveConflictTime(null);
      setGdriveStatus('synced');
      setGdriveLastSync(
        new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err: any) {
      setGdriveStatus('error');
      setGdriveErrorMsg(err?.message || 'Ошибка перезаписи');
    }
  };

  const handleConnectGoogleDrive = () => {
    const googleObj = (window as any).google;
    if (!googleObj?.accounts?.oauth2) {
      alert('Библиотека авторизации Google еще загружается. Попробуйте через 2 секунды.');
      return;
    }

    setGdriveStatus('syncing');
    setGdriveErrorMsg('');

    tokenClientRef.current = googleObj.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: async (tokenResponse: any) => {
        if (tokenResponse?.error) {
          setGdriveStatus('error');
          setGdriveErrorMsg(tokenResponse.error);
          return;
        }
        const accessToken = tokenResponse.access_token;
        setGdriveToken(accessToken);

        try {
          const existingMeta = await findCloudFileMeta(accessToken);
          if (existingMeta) {
            const fileRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${existingMeta.id}?alt=media`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            if (!fileRes.ok) throw new Error('Не удалось скачать файл базы с Google Диска');
            const cloudData = await fileRes.json();

            isRemoteApplyingRef.current = true;
            if (cloudData.projects) setProjects(cloudData.projects);
            if (cloudData.meetings) setMeetings(cloudData.meetings);
            if (cloudData.reports) setReports(cloudData.reports);
            if (cloudData.tasks) setTasks(cloudData.tasks);
            if (cloudData.calendarEvents) setCalendarEvents(cloudData.calendarEvents);
            if (cloudData.activeProjectId) setActiveProjectId(cloudData.activeProjectId);

            setGdriveFileId(existingMeta.id);
            setGdriveModifiedTime(existingMeta.modifiedTime);
            setGdriveConflictTime(null);
            setGdriveStatus('synced');
            setGdriveLastSync(
              new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            );
            setTimeout(() => {
              isRemoteApplyingRef.current = false;
            }, 600);
          } else {
            const initialPayload = {
              projects,
              meetings,
              reports,
              tasks,
              calendarEvents,
              activeProjectId,
              exportedAt: new Date().toISOString(),
            };
            const created = await uploadPayloadToDrive(accessToken, null, initialPayload);
            setGdriveFileId(created.id);
            setGdriveModifiedTime(created.modifiedTime);
            setGdriveConflictTime(null);
            setGdriveStatus('synced');
            setGdriveLastSync(
              new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            );
          }
        } catch (err: any) {
          console.error('Google Drive sync init error:', err);
          setGdriveStatus('error');
          setGdriveErrorMsg(err?.message || 'Ошибка синхронизации с Google Диском');
        }
      },
    });

    tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
  };

  const handleDisconnectGoogleDrive = () => {
    setGdriveToken(null);
    setGdriveFileId(null);
    setGdriveModifiedTime(null);
    setGdriveConflictTime(null);
    setGdriveStatus('disconnected');
    setGdriveLastSync('');
  };

  // Автосохранение на Google Диск с предварительной проверкой modifiedTime (защита от перезаписи с другого ПК)
  useEffect(() => {
    if (!gdriveToken || !isStorageReady || isRemoteApplyingRef.current || gdriveStatus === 'conflict') {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setGdriveStatus('syncing');

        if (gdriveFileId && gdriveModifiedTime) {
          const remoteTime = await getRemoteFileModifiedTime(gdriveToken, gdriveFileId);
          if (remoteTime && remoteTime !== gdriveModifiedTime) {
            setGdriveConflictTime(remoteTime);
            setGdriveStatus('conflict');
            return;
          }
        }

        const payload = {
          projects,
          meetings,
          reports,
          tasks,
          calendarEvents,
          activeProjectId,
          exportedAt: new Date().toISOString(),
        };
        const saved = await uploadPayloadToDrive(gdriveToken, gdriveFileId, payload);
        if (!gdriveFileId) setGdriveFileId(saved.id);
        setGdriveModifiedTime(saved.modifiedTime);
        setGdriveStatus('synced');
        setGdriveLastSync(
          new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        );
      } catch (err: any) {
        console.error('Google Drive auto-save error:', err);
        setGdriveStatus('error');
        setGdriveErrorMsg('Сессия Google истекла или нет сети. Нажмите для переподключения.');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [
    projects,
    meetings,
    reports,
    tasks,
    calendarEvents,
    activeProjectId,
    gdriveToken,
    gdriveFileId,
    gdriveModifiedTime,
    gdriveStatus,
    isStorageReady,
  ]);

  // Автоматическое создание служебного проекта 0000 при первом запуске
  useEffect(() => {
    if (!isStorageReady) return;
    setProjects((prev) => {
      if (prev.some((p: any) => p.id === 'system_0000' || (p.num || '').trim() === '0000')) {
        return prev;
      }
      return [createSystemProject0000(), ...prev];
    });
  }, [isStorageReady, setProjects]);

  useEffect(() => {
    if (!isStorageReady) return;
    if (!activeProjectId && projects.length > 0) {
      const firstActive = projects.find((p: any) => !p.archived) || projects[0];
      setActiveProjectId(firstActive.id);
    }
  }, [isStorageReady, activeProjectId, projects, setActiveProjectId]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const requestDesktopNotifications = async () => {
    if (typeof Notification === 'undefined') {
      alert('Ваш браузер не поддерживает системные уведомления.');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      playNotificationChime();
      new Notification('ProjectStatus SUP', {
        body: 'Системные напоминания включены! Приложение предупредит о запланированных задачах и встречах.',
      });
    }
  };

  useEffect(() => {
    if (!isStorageReady) return;
    const checkReminders = () => {
      const now = new Date();
      const todayStr = getTodayDMY();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      let triggeredTitle: string | null = null;
      let changed = false;

      const updatedEvents = calendarEvents.map((ev: any) => {
        if (ev.notified || formatToDMY(ev.date) !== todayStr) return ev;
        const shouldTrigger = !ev.time || ev.time <= currentHHMM;
        if (shouldTrigger) {
          changed = true;
          triggeredTitle = `${ev.time ? `[${ev.time}] ` : ''}${
            ev.projectNum ? `Проект #${ev.projectNum}: ` : ''
          }${ev.title}`;
          return { ...ev, notified: true };
        }
        return ev;
      });

      if (changed && triggeredTitle) {
        setCalendarEvents(updatedEvents);
        setActiveAlertBanner(triggeredTitle);
        playNotificationChime();
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Напоминание — ProjectStatus', { body: triggeredTitle });
        }
      }
    };

    checkReminders();
    const timer = setInterval(checkReminders, 30000);
    return () => clearInterval(timer);
  }, [isStorageReady, calendarEvents, setCalendarEvents]);

  const handleOpenProjectFromOverview = useCallback(
    (projectId: string, targetSubTab?: 'tasks' | 'remarks' | 'revisions' | 'docs' | 'related') => {
      setActiveProjectId(projectId);
      if (targetSubTab) {
        setExternalProjectSubTab(targetSubTab);
      }
      setActiveTab(2);
    },
    [setActiveProjectId]
  );

  const handleNavigateWithFilter = useCallback((targetTab: number, projectNumber: string) => {
    setExternalProjectFilter(projectNumber);
    setActiveTab(targetTab);
  }, []);

  const handleSyncSingleProjectToReport = (projectObj: any) => {
    const targetWeek = getCurrentISOWeek();
    const summary = buildProjectReportSummary(projectObj, targetWeek);
    const updatedList = [...reports];
    const existingIdx = updatedList.findIndex(
      (r: any) =>
        r.week === targetWeek &&
        (r.projectId === projectObj.id || (r.project || '').trim() === (projectObj.num || '').trim())
    );

    if (existingIdx !== -1) {
      updatedList[existingIdx] = {
        ...updatedList[existingIdx],
        projectId: projectObj.id,
        project: projectObj.num,
        stage: summary.stage || updatedList[existingIdx].stage,
        deadline: summary.deadline || updatedList[existingIdx].deadline,
        done: summary.done,
        inProgress: summary.inProgress || updatedList[existingIdx].inProgress,
        blockers: summary.blockers,
      };
    } else {
      updatedList.push({
        id: Date.now(),
        week: targetWeek,
        projectId: projectObj.id,
        project: projectObj.num,
        stage: summary.stage,
        deadline: summary.deadline,
        done: summary.done,
        inProgress: summary.inProgress,
        blockers: summary.blockers,
        comment: '',
      });
    }

    setReports(updatedList);
    setActiveTab(3);
  };

  const exportBackup = () => {
    const backup = {
      projects,
      meetings,
      reports,
      tasks,
      calendarEvents,
      activeProjectId,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SUP_Tracker_Backup_${getTodayDMY().replace(/\//g, '-')}.json`;
    link.click();
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.projects) setProjects(data.projects);
        if (data.meetings) setMeetings(data.meetings);
        if (data.reports) setReports(data.reports);
        if (data.tasks) setTasks(data.tasks);
        if (data.calendarEvents) setCalendarEvents(data.calendarEvents);
        if (data.activeProjectId) setActiveProjectId(data.activeProjectId);
        alert('База данных успешно восстановлена из файла!');
      } catch {
        alert('Ошибка: некорректный JSON-файл резервной копии.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeProjectsCount = useMemo(
    () => projects.filter((p: any) => !p.archived).length,
    [projects]
  );

  const navTabs = [
    { id: 0, label: 'Сводка и Календарь', icon: CalendarDays, count: null },
    { id: 1, label: 'Встречи', icon: Users, count: meetings.length },
    { id: 2, label: 'Статус проекта', icon: FolderKanban, count: activeProjectsCount },
    { id: 3, label: 'Еженедельный отчет', icon: FileSpreadsheet, count: reports.length },
    { id: 4, label: 'Задачи', icon: CheckSquare, count: tasks.length },
  ];

  if (!isStorageReady) {
    return (
      <div className="min-h-screen bg-slate-100/70 flex items-center justify-center text-slate-500 text-sm">
        Загрузка базы данных проектов...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans pb-12">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .shadow-sm { box-shadow: none !important; }
        }
      `}</style>

      {isSearchOpen && (
        <GlobalSearchModal
          projects={projects}
          meetings={meetings}
          tasks={tasks}
          onClose={() => setIsSearchOpen(false)}
          onSelectProject={handleOpenProjectFromOverview}
          onNavigateTab={handleNavigateWithFilter}
        />
      )}

      {lightboxState && (
        <ScreenshotLightboxModal
          images={lightboxState.images}
          initialIndex={lightboxState.initialIndex}
          onClose={() => setLightboxState(null)}
          onSaveEditedImage={(idx, newUrl) => {
            if (lightboxState.onSaveEdited) {
              lightboxState.onSaveEdited(idx, newUrl);
            }
            setLightboxState((prev) => {
              if (!prev) return null;
              const nextImgs = [...prev.images];
              nextImgs[idx] = newUrl;
              return { ...prev, images: nextImgs };
            });
          }}
        />
      )}

      {/* Баннер конфликта при работе с двух компьютеров */}
      {gdriveStatus === 'conflict' && (
        <div className="bg-rose-600 text-white px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-3 no-print shadow-md">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={17} className="shrink-0" />
            <span>
              <b>Обнаружен конфликт версий на Google Диске!</b> Файл на облаке был обновлён с другого компьютера
              {gdriveConflictTime
                ? ` (${new Date(gdriveConflictTime).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })})`
                : ''}
              . Автосохранение приостановлено, чтобы не затереть чужие изменения.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={pullLatestFromGoogleDrive}
              className="bg-white text-rose-700 hover:bg-rose-50 px-3 py-1 rounded-lg font-bold transition-colors"
            >
              Загрузить свежую с диска
            </button>
            <button
              type="button"
              onClick={forceOverwriteGoogleDrive}
              className="bg-rose-800 hover:bg-rose-900 text-white border border-rose-400 px-3 py-1 rounded-lg font-semibold transition-colors"
            >
              Перезаписать своими данными
            </button>
          </div>
        </div>
      )}

      {activeAlertBanner && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 text-xs flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 font-medium">
            <BellRing size={16} className="animate-bounce shrink-0" />
            <span>Напоминание: {activeAlertBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveAlertBanner(null)}
            className="bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded text-[11px] font-semibold"
          >
            Понятно
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap justify-between items-center py-3 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Layers size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">ProjectStatus</h1>
                <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Database size={10} /> Локально (IndexedDB) + Облако Google Диск
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* КНОПКА СИНХРОНИЗАЦИИ С GOOGLE ДИСКОМ */}
              {gdriveStatus === 'disconnected' ? (
                <button
                  type="button"
                  onClick={handleConnectGoogleDrive}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Подключить Google Диск для синхронизации между рабочим и домашним ПК"
                >
                  <CloudOff size={14} className="text-sky-600" /> Подключить Google Диск
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleConnectGoogleDrive}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                      gdriveStatus === 'conflict'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : gdriveStatus === 'error'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : gdriveStatus === 'syncing'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                    title={
                      gdriveStatus === 'conflict'
                        ? 'Обнаружен конфликт версий с другим компьютером'
                        : gdriveErrorMsg ||
                          `Файл на Google Диске: ${CLOUD_DB_FILENAME}. Нажмите для принудительного обновления.`
                    }
                  >
                    {gdriveStatus === 'syncing' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : gdriveStatus === 'conflict' ? (
                      <AlertTriangle size={14} className="text-rose-600" />
                    ) : (
                      <Cloud size={14} className="text-emerald-600" />
                    )}
                    {gdriveStatus === 'syncing'
                      ? 'Синхронизация...'
                      : gdriveStatus === 'conflict'
                      ? 'Конфликт версий!'
                      : gdriveStatus === 'error'
                      ? 'Ошибка Google Диска'
                      : `Google Диск ✓ ${gdriveLastSync ? `(${gdriveLastSync})` : ''}`}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogleDrive}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Отключить облачную синхронизацию"
                  >
                    <LogOut size={13} />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Быстрый поиск по всем проектам, встречам и замечаниям"
              >
                <Search size={14} className="text-indigo-600" />
                <span className="hidden sm:inline">Поиск</span>
                <kbd className="text-[10px] bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-400">
                  Ctrl+K
                </kbd>
              </button>

              {notifPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={requestDesktopNotifications}
                  className="text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  title="Разрешить звуковые и системные уведомления о событиях в календаре"
                >
                  <Bell size={14} /> <span className="hidden md:inline">Напоминания</span>
                </button>
              )}

              <button
                onClick={exportBackup}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Скачать резервную копию всех данных в JSON"
              >
                <Save size={15} /> <span className="hidden sm:inline">Бэкап</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Загрузить резервную копию из JSON"
              >
                <Upload size={15} /> <span className="hidden sm:inline">Восстановить</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={importBackup}
                className="hidden"
              />
              <button
                onClick={() => window.print()}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Распечатать или сохранить в PDF"
              >
                <Printer size={15} />
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 0 && (
          <TabOverviewCalendar
            projects={projects}
            setProjects={setProjects}
            meetings={meetings}
            setMeetings={setMeetings}
            tasks={tasks}
            calendarEvents={calendarEvents}
            setCalendarEvents={setCalendarEvents}
            onOpenProject={handleOpenProjectFromOverview}
            onNavigateWithFilter={handleNavigateWithFilter}
          />
        )}
        {activeTab === 1 && (
          <TabMeetings
            meetings={meetings}
            setMeetings={setMeetings}
            projects={projects}
            onPreviewImages={(images: string[], initialIndex: number, onSaveEdited: (idx: number, newUrl: string) => void) =>
              setLightboxState({ images, initialIndex, onSaveEdited })
            }
            externalProjectFilter={externalProjectFilter}
            onClearExternalFilter={() => setExternalProjectFilter('')}
          />
        )}
        {activeTab === 2 && (
          <TabProjectStatus
            projects={projects}
            setProjects={setProjects}
            activeProjectId={activeProjectId}
            setActiveProjectId={setActiveProjectId}
            meetings={meetings}
            setMeetings={setMeetings}
            tasks={tasks}
            setTasks={setTasks}
            onNavigateWithFilter={handleNavigateWithFilter}
            onPreviewImages={(images: string[], initialIndex: number, onSaveEdited: (idx: number, newUrl: string) => void) =>
              setLightboxState({ images, initialIndex, onSaveEdited })
            }
            onSyncSingleProjectToReport={handleSyncSingleProjectToReport}
            externalSubTab={externalProjectSubTab}
            onClearExternalSubTab={() => setExternalProjectSubTab(undefined)}
          />
        )}
        {activeTab === 3 && (
          <TabWeeklyReport
            reports={reports}
            setReports={setReports}
            projects={projects}
          />
        )}
        {activeTab === 4 && (
          <TabTasks
            tasks={tasks}
            setTasks={setTasks}
            externalProjectFilter={externalProjectFilter}
            onClearExternalFilter={() => setExternalProjectFilter('')}
          />
        )}
      </main>
    </div>
  );
}
