import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

// === 1. ХУКИ И УТИЛИТЫ ДАТ И НЕДЕЛЬ ===

function useLocalStorage(key: string, initialValue: any) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

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
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
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
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(
      2,
      '0'
    )}`;
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

const getDeadlineUrgency = (
  dateStr: string
): 'overdue' | 'soon' | 'normal' | null => {
  const target = parseDateObj(dateStr);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
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

const buildProjectReportSummary = (project: any, targetWeek: string) => {
  const tasksList = project.tasks || [];
  const blockersList = project.blockers || [];

  const doneThisWeek = tasksList.filter(
    (t: any) =>
      !t.isHeader &&
      t.status === 'выполнено' &&
      isDateInWeek(t.date, targetWeek)
  );
  const doneText =
    doneThisWeek.length > 0
      ? doneThisWeek.map((t: any) => t.name).join(', ')
      : 'На этой неделе ничего не выполнено';

  let currentSection = 'Общее';
  const groupedInProgress: Record<string, string[]> = {};

  tasksList.forEach((t: any) => {
    if (t.isHeader) {
      currentSection = t.name
        .replace('📋 ', '')
        .replace(/^\d+\.\s*/, '')
        .trim();
      return;
    }
    if (t.status === 'в работе' || t.status === 'передано другому') {
      if (!groupedInProgress[currentSection]) {
        groupedInProgress[currentSection] = [];
      }
      const label =
        t.status === 'передано другому' ? `${t.name} (передано)` : t.name;
      groupedInProgress[currentSection].push(label);
    }
  });

  const inProgressLines = Object.entries(groupedInProgress).map(
    ([section, items]) => {
      if (items.length <= 2) {
        return `${section}: ${items.join(', ')}`;
      }
      return `${section}: ${items.slice(0, 2).join(', ')} (+${
        items.length - 2
      })`;
    }
  );

  const inProgressText = inProgressLines.join('; ');

  const activeBlockers = blockersList.filter(
    (b: any) => !b.resolved && (b.text || '').trim()
  );
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
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(
        4
      )}`;
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
    if (
      [
        'выполнено',
        'выполнена',
        'исправлено',
        'одобрен',
        'решен',
        'есть',
      ].includes(s)
    ) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
        dot: 'bg-emerald-500',
      };
    }
    if (
      [
        'в работе',
        'создан',
        'отправлен',
        'отправили на согласование',
        'запросили',
      ].includes(s)
    ) {
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
  const mergedOptions =
    value && !options.includes(value) ? [...options, value] : options;

  return (
    <div className="relative inline-flex items-center w-full">
      <span
        className={`w-2 h-2 rounded-full absolute left-2.5 pointer-events-none ${style.dot}`}
      />
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
      <span className="pointer-events-none absolute right-2.5 text-[10px] opacity-60">
        ▼
      </span>
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
          value
            ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900'
            : 'bg-white border-slate-200 text-slate-600'
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
        value
          ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-medium'
          : 'bg-white border-slate-200 text-slate-600'
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

  if (clipboardData.items) {
    for (const item of clipboardData.items) {
      if (item.type && item.type.indexOf('image') === 0) {
        e.preventDefault();
        e.stopPropagation();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event: any) => callback(event.target.result);
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  }

  if (clipboardData.files && clipboardData.files.length > 0) {
    const file = clipboardData.files[0];
    if (file.type && file.type.indexOf('image') === 0) {
      e.preventDefault();
      e.stopPropagation();
      const reader = new FileReader();
      reader.onload = (event: any) => callback(event.target.result);
      reader.readAsDataURL(file);
    }
  }
};

// Универсальная ячейка скриншота (поддерживает клик + Ctrl+V и загрузку файла)
function ImageCell({
  src,
  onChange,
  onPreview,
}: {
  src: string;
  onChange: (val: string) => void;
  onPreview: (val: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: any) => onChange(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (src) {
    return (
      <div className="relative inline-block group/img">
        <img
          src={src}
          alt="Скриншот"
          onClick={() => onPreview(src)}
          className="h-11 w-18 object-cover rounded border border-slate-200 cursor-zoom-in shadow-xs"
        />
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity shadow"
          title="Удалить скриншот"
        >
          <X size={10} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <div
        ref={boxRef}
        tabIndex={0}
        onClick={() => boxRef.current?.focus()}
        onPaste={(e) => handlePasteImage(e, onChange)}
        className="text-[10px] text-slate-400 py-1.5 px-2 border border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:text-indigo-600 focus:border-indigo-600 focus:bg-indigo-50/70 focus:text-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer transition-all select-none"
        title="Кликните сюда и нажмите Ctrl+V, чтобы вставить скриншот из буфера"
      >
        Ctrl+V
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-200 transition-colors"
        title="Загрузить файл изображения с компьютера"
      >
        <ImageIcon size={13} />
      </button>
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

// === 2. СТРУКТУРА РАЗДЕЛОВ И ЗАДАЧ (17 РАЗДЕЛОВ) ===

const DEFAULT_TASK_STATUSES = [
  'выполнено',
  'в работе',
  'на паузе',
  'передано другому',
  'не требуется',
  'требует исправления',
];

const PROJECT_SECTIONS_TEMPLATE = [
  {
    code: '1',
    title: '1. Данные для проектирования',
    tasks: [
      {
        code: '1.1',
        name: 'Проверка уровней: 0.00 здание / благоустройство / инфраструктура / тротуар, дорога / мусорная комната',
      },
      { code: '1.2', name: 'Нанесение деревьев на сохранение' },
      { code: '1.3', name: 'Маркировка толщины стяжки согласно архитектуре' },
      { code: '1.4', name: 'Первый лист' },
      {
        code: '1.5',
        name: 'Подготовка городской инфраструктуры на масштабе 1:250',
      },
      {
        code: '1.6',
        name: 'Подготовка городской инфраструктуры на масштабе 1:100',
      },
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
      {
        code: '6.6',
        name: 'Расстановка стояков ливневой канализации от балконов',
      },
      { code: '6.7', name: 'Дренаж сада' },
      {
        code: '6.8',
        name: 'Сантехнический шкаф (расстановка и маркировка труб, проверка места и размеров, расстановка оборудования)',
      },
      {
        code: '6.9',
        name: 'Расстановка пожарного райзера на лестничной клетке + кран',
      },
      {
        code: '6.10',
        name: 'Райзеры воды, пожаротушения, спринклеров и их оборудование вне сантехнического шкафа',
      },
      { code: '6.11', name: 'Расстановка райзеров горячей воды' },
      { code: '6.12', name: 'Расстановка бойллеров' },
      { code: '6.13', name: 'Расстановка стояков для дренажа газа' },
      {
        code: '6.14',
        name: 'Расстановка стояков для промышленной канализации',
      },
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
      {
        code: '8.3',
        name: 'Прокладка труб ливневой канализации от крыш и балконов',
      },
      {
        code: '8.4',
        name: 'Прокладка труб ливневой канализации от благоустройства',
      },
      {
        code: '8.5',
        name: 'Прокладка магистральных труб воды, пожаротушения, спринклеров',
      },
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
      {
        code: '10.1',
        name: 'Определение местоположения канализационных насосных приямков и их оборудования',
      },
      {
        code: '10.2',
        name: 'Определение параметров для канализационных насосов (производительность, давление, электрическая нагрузка)',
      },
      {
        code: '10.3',
        name: 'Определение местоположения ливневых насосных приямков и их оборудования',
      },
      {
        code: '10.4',
        name: 'Определение параметров для ливневых насосов (производительность, давление, электрическая нагрузка)',
      },
      {
        code: '10.5',
        name: 'Определение местоположения насосных приямков грязной воды и их оборудования',
      },
      {
        code: '10.6',
        name: 'Определение параметров для насосов грязной воды (производительность, давление, электрическая нагрузка)',
      },
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
      {
        code: '14.4',
        name: 'Расстановка трапов в сантехнических шкафах и на мистор квиса',
      },
      { code: '14.5', name: 'Дренаж кондиционеров' },
    ],
  },
  {
    code: '15',
    title: '15. Подключение ливневых трапов',
    tasks: [
      { code: '15.1', name: 'Выбор материала труб для ливневой канализации' },
      {
        code: '15.2',
        name: 'Подключение ливневых трапов к стоякам ливневой канализации',
      },
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
      status: '',
      priority: '',
      estHours: '',
      date: '',
      comment: '',
    });
    sec.tasks.forEach((t) => {
      const matched = existingTasks.find(
        (old) =>
          !old.isHeader &&
          (old.code === t.code ||
            (old.name || '').trim().toLowerCase() ===
              t.name.trim().toLowerCase())
      );
      result.push({
        code: t.code,
        name: t.name,
        isHeader: false,
        status: matched ? matched.status : '',
        priority: matched ? matched.priority || '' : '',
        estHours: matched ? matched.estHours || '' : '',
        date: matched ? matched.date : '',
        comment: matched ? matched.comment : '',
      });
    });
  });

  let inCustomSection = false;
  existingTasks.forEach((old) => {
    if (old.isHeader) {
      inCustomSection = Boolean(old.isCustomSection);
      if (inCustomSection) {
        result.push(old);
      }
    } else if (inCustomSection || old.isCustom) {
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
].map((f) => ({ name: f, status: '', date: '' }));

const DEFAULT_PERMISSIONS = [
  'Вертикали',
  'Напорные приямки',
  'Краны для напорных приямков',
].map((p) => ({ name: p, status: '', date: '' }));

const calcProjectProgress = (proj: any) => {
  const tasks = proj.tasks || [];
  const actionable = tasks.filter(
    (t: any) => !t.isHeader && t.status !== 'не требуется'
  );
  const completed = actionable.filter((t: any) => t.status === 'выполнено');
  return actionable.length > 0
    ? Math.round((completed.length / actionable.length) * 100)
    : 0;
};

const calcProjectRemainingHours = (proj: any) => {
  const tasks = proj.tasks || [];
  let sum = 0;
  tasks.forEach((t: any) => {
    if (
      !t.isHeader &&
      t.status !== 'не требуется' &&
      t.status !== 'выполнено'
    ) {
      sum += parseFloat(String(t.estHours || '').replace(',', '.')) || 0;
    }
  });
  return Number(sum.toFixed(1));
};

// === 3. КОМПОНЕНТЫ ВКЛАДОК ===

function TabOverviewCalendar({
  projects,
  meetings,
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

  const [showSources, setShowSources] = useState({
    deadlines: true,
    tasks: true,
    meetings: true,
    custom: true,
  });

  const eventsByDate: Record<
    string,
    Array<{
      id: string;
      type: 'deadline' | 'task' | 'meeting' | 'custom';
      title: string;
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
    projects.forEach((p: any) => {
      if (p.deadline) {
        pushEvent(p.deadline, {
          id: `proj-${p.id}`,
          type: 'deadline',
          title: `Дедлайн этапа${p.stage ? ` (${p.stage})` : ''}${
            p.name ? `: ${p.name}` : ''
          }`,
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
      if (m.date) {
        pushEvent(m.date, {
          id: `mtg-${m.id}`,
          type: 'meeting',
          title: m.desc || '(Встреча без описания)',
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
        projectNum: newEventProject.trim(),
        title: newEventTitle.trim(),
      },
    ]);
    setNewEventTitle('');
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
      const dmy = `${String(dayNum).padStart(2, '0')}/${String(
        month + 1
      ).padStart(2, '0')}/${year}`;
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
  const selectedDayEvents = eventsByDate[selectedDayDMY] || [];

  const totalActiveBlockers = projects.reduce(
    (acc: number, p: any) =>
      acc + (p.blockers || []).filter((b: any) => !b.resolved).length,
    0
  );
  const totalOpenRemarks = projects.reduce(
    (acc: number, p: any) =>
      acc +
      (p.remarks || []).filter(
        (r: any) =>
          !['решен', 'не актуальный'].includes((r.status || '').toLowerCase())
      ).length,
    0
  );
  const totalOpenQuickTasks = tasks.filter(
    (t: any) =>
      !['выполнена', 'выполнено'].includes((t.status || '').toLowerCase())
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">
            Активных проектов
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-1">
            {projects.length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">
            Активных блокеров
          </div>
          <div
            className={`text-2xl font-bold mt-1 ${
              totalActiveBlockers > 0 ? 'text-rose-600' : 'text-slate-800'
            }`}
          >
            {totalActiveBlockers}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">
            Открытых замечаний
          </div>
          <div
            className={`text-2xl font-bold mt-1 ${
              totalOpenRemarks > 0 ? 'text-amber-600' : 'text-slate-800'
            }`}
          >
            {totalOpenRemarks}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">
            Задач в работе
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            {totalOpenQuickTasks}
          </div>
        </div>
      </div>

      {/* СВОДКА ПО ВСЕМ ПРОЕКТАМ */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <LayoutGrid size={17} className="text-indigo-600" />
            <h2 className="font-semibold text-sm text-slate-800">
              Краткая сводка по всем проектам
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Нажмите на карточку проекта, чтобы перейти в его чек-лист
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Проектов пока нет. Создайте первый проект во вкладке «Статус
            проекта».
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((p: any) => {
              const pct = calcProjectProgress(p);
              const remHours = calcProjectRemainingHours(p);
              const activeBlockers = (p.blockers || []).filter(
                (b: any) => !b.resolved
              );
              const openRemarks = (p.remarks || []).filter(
                (r: any) =>
                  !['решен', 'не актуальный'].includes(
                    (r.status || '').toLowerCase()
                  )
              );
              const openTasks = tasks.filter(
                (t: any) =>
                  (t.project || '').trim() === (p.num || '').trim() &&
                  !['выполнена', 'выполнено'].includes(
                    (t.status || '').toLowerCase()
                  )
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
                  onClick={() => onOpenProject(p.id)}
                  className="p-4 rounded-xl border border-slate-200/90 hover:border-indigo-400 hover:shadow-md bg-white cursor-pointer transition-all flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-indigo-700">
                            Проект #{p.num}
                          </span>
                          {p.stage && (
                            <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 rounded-md">
                              {p.stage}
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

                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">
                          Готовность чек-листа
                        </span>
                        <span className="font-bold text-slate-800">
                          {pct}%{' '}
                          {remHours > 0 && (
                            <span className="text-slate-400 font-normal">
                              (осталось {remHours} ч)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {activeBlockers.length > 0 && (
                      <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-rose-50/80 border border-rose-200/80 text-[11px] text-rose-800 line-clamp-1">
                        <span className="font-semibold">Блокер:</span>{' '}
                        {activeBlockers[0].text}
                        {activeBlockers.length > 1 &&
                          ` (+${activeBlockers.length - 1})`}
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
                      Замечания: {openRemarks.length}
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

      {/* КАЛЕНДАРЬ ПЛАНИРОВАНИЯ */}
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
                  setCurrentMonth(
                    new Date(now.getFullYear(), now.getMonth(), 1)
                  );
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
                onChange={(e) =>
                  setShowSources({
                    ...showSources,
                    deadlines: e.target.checked,
                  })
                }
                className="rounded text-rose-600"
              />
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">
                Дедлайны этапов
              </span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSources.tasks}
                onChange={(e) =>
                  setShowSources({ ...showSources, tasks: e.target.checked })
                }
                className="rounded text-amber-600"
              />
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                Дедлайны задач
              </span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSources.meetings}
                onChange={(e) =>
                  setShowSources({ ...showSources, meetings: e.target.checked })
                }
                className="rounded text-sky-600"
              />
              <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-medium">
                Встречи
              </span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSources.custom}
                onChange={(e) =>
                  setShowSources({ ...showSources, custom: e.target.checked })
                }
                className="rounded text-indigo-600"
              />
              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-medium">
                Мое планирование
              </span>
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
                return (
                  <div key={idx} className="min-h-[92px] bg-slate-50/40" />
                );
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
                      <span className="text-[10px] font-bold text-slate-400">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate font-medium ${getBadgeStyle(
                          ev.type
                        )}`}
                        title={`${ev.projectNum ? `[#${ev.projectNum}] ` : ''}${
                          ev.title
                        }`}
                      >
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
                <h3 className="text-base font-bold text-slate-800 font-mono">
                  {selectedDayDMY}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                Событий: {selectedDayEvents.length}
              </span>
            </div>

            <form
              onSubmit={handleAddCalendarEvent}
              className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2"
            >
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Flag size={13} className="text-indigo-600" /> Запланировать на{' '}
                {selectedDayDMY}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  list="projects-num-list"
                  value={newEventProject}
                  onChange={(e) => setNewEventProject(e.target.value)}
                  placeholder="Проект №"
                  className="w-24 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <datalist id="projects-num-list">
                  {projects.map((p: any) => (
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
                  placeholder="Подача, созвон, проверка модели..."
                  className="flex-grow px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <Plus size={14} /> Добавить в календарь
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
                        {ev.projectNum && (
                          <span className="text-xs font-bold text-indigo-700">
                            #{ev.projectNum}
                          </span>
                        )}
                        {ev.status && (
                          <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {ev.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                        {ev.title}
                      </p>
                    </div>

                    {ev.type === 'custom' && (
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarEvents(
                            calendarEvents.filter(
                              (item: any) => item.id !== ev.rawId
                            )
                          )
                        }
                        className="text-slate-300 hover:text-rose-500 p-1 shrink-0"
                        title="Удалить событие"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
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

function TabMeetings({
  meetings,
  setMeetings,
  onPreviewImage,
  externalProjectFilter,
  onClearExternalFilter,
}: any) {
  const [filters, setFilters] = useState({
    projectNum: '',
    date: '',
    desc: '',
    fix: '',
    screenshot: '',
    status: '',
    comment: '',
  });

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
      desc: '',
      fix: '',
      screenshot: '',
      status: '',
      comment: '',
    });

  const filtered = meetings.filter((m: any) => {
    return (
      (!filters.projectNum ||
        (m.projectNum || '')
          .toLowerCase()
          .includes(filters.projectNum.toLowerCase())) &&
      matchDateFilter(m.date, filters.date) &&
      (!filters.desc ||
        (m.desc || '').toLowerCase().includes(filters.desc.toLowerCase())) &&
      (!filters.fix ||
        (m.fix || '').toLowerCase().includes(filters.fix.toLowerCase())) &&
      (!filters.screenshot ||
        (filters.screenshot === 'yes' && Boolean(m.screenshot)) ||
        (filters.screenshot === 'no' && !m.screenshot)) &&
      matchStatusFilter(m.status, filters.status) &&
      (!filters.comment ||
        (m.comment || '').toLowerCase().includes(filters.comment.toLowerCase()))
    );
  });

  const updateItem = (id: any, field: string, value: any) => {
    setMeetings(
      meetings.map((m: any) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Протоколы и результаты встреч
          </h2>
          <p className="text-xs text-slate-500">
            Фильтрация по всем колонкам (формат даты: ДД/ММ/ГГГГ)
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={13} /> Сбросить фильтры
            </button>
          )}
          <button
            onClick={() =>
              setMeetings([
                {
                  id: Date.now(),
                  projectNum: filters.projectNum || '',
                  date: getTodayDMY(),
                  desc: '',
                  fix: '',
                  screenshot: '',
                  status: 'в работе',
                  comment: '',
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
                <th className="pt-3 pb-1.5 px-3 w-28">Проект</th>
                <th className="pt-3 pb-1.5 px-3 w-36">Дата</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[220px]">
                  Описание вопроса
                </th>
                <th className="pt-3 pb-1.5 px-3 min-w-[220px]">
                  Что исправить
                </th>
                <th className="pt-3 pb-1.5 px-3 w-32 text-center">Скриншот</th>
                <th className="pt-3 pb-1.5 px-3 w-44">Статус</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[160px]">Комментарий</th>
                <th className="pt-3 pb-1.5 px-2 w-10"></th>
              </tr>
              <tr className="bg-slate-50/40 border-b border-slate-200">
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
                    onChange={(e) =>
                      setFilters({ ...filters, screenshot: e.target.value })
                    }
                    className={`w-full px-1.5 py-1 text-[11px] font-normal rounded border ${
                      filters.screenshot
                        ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900'
                        : 'bg-white border-slate-200 text-slate-600'
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
                    options={[
                      'в работе',
                      'исправлено',
                      'на паузе',
                      'передано другому',
                    ]}
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
                    Записей по заданным фильтрам не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map((m: any) => (
                  <tr
                    key={m.id}
                    onPaste={(e) =>
                      handlePasteImage(e, (img) =>
                        updateItem(m.id, 'screenshot', img)
                      )
                    }
                    className="group hover:bg-slate-50/70 transition-colors align-top"
                  >
                    <td className="p-2">
                      <input
                        placeholder="№..."
                        className="w-full px-2 py-1 font-semibold text-indigo-600 bg-transparent hover:bg-slate-100/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 rounded focus:outline-none"
                        value={m.projectNum}
                        onChange={(e) =>
                          updateItem(m.id, 'projectNum', e.target.value)
                        }
                      />
                    </td>
                    <td className="p-2">
                      <DateInput
                        value={m.date}
                        onChange={(val) => updateItem(m.id, 'date', val)}
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
                        onChange={(img) => updateItem(m.id, 'screenshot', img)}
                        onPreview={onPreviewImage}
                      />
                    </td>
                    <td className="p-2">
                      <StatusPill
                        value={m.status}
                        options={[
                          'в работе',
                          'исправлено',
                          'на паузе',
                          'передано другому',
                        ]}
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
                        onClick={() =>
                          setMeetings(
                            meetings.filter((mtg: any) => mtg.id !== m.id)
                          )
                        }
                        className="text-slate-300 hover:text-rose-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                        title="Удалить строку"
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

// === МОДАЛЬНОЕ ОКНО ФОРМИРОВАНИЯ СТАТУСА ПРОЕКТА (ПИСЬМО / WORD) ===

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
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    'в работе',
    'передано другому',
    'требует исправления',
  ]);
  const [includeResolvedBlockers, setIncludeResolvedBlockers] = useState(false);
  const [remarksMode, setRemarksMode] = useState<'open' | 'all' | 'none'>(
    'open'
  );
  const [copiedText, setCopiedText] = useState(false);

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

  let currentSection = 'Общее';
  let currentBucket: any[] = [];

  (projectData.tasks || []).forEach((t: any) => {
    if (t.isHeader) {
      if (currentBucket.length > 0) {
        filteredSections.push({
          sectionTitle: currentSection,
          tasks: currentBucket,
        });
      }
      currentSection = t.name.replace('📋 ', '').trim();
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
    filteredSections.push({
      sectionTitle: currentSection,
      tasks: currentBucket,
    });
  }

  const generatePlainText = () => {
    const lines: string[] = [];
    lines.push(
      `СТАТУС ПРОЕКТА #${projectData.num}${
        projectData.name ? ` — ${projectData.name}` : ''
      }`
    );
    lines.push(`Дата формирования: ${getTodayDMY()}`);
    if (projectData.stage) lines.push(`Стадия: ${projectData.stage}`);
    if (projectData.deadline)
      lines.push(`Дедлайн этапа: ${formatToDMY(projectData.deadline)}`);
    if (projectData.team) lines.push(`Смежники: ${projectData.team}`);
    lines.push(
      `Общая готовность чек-листа: ${progressPercent}%${
        totalRemainingHours > 0
          ? ` (осталось ~${Number(totalRemainingHours.toFixed(1))} ч)`
          : ''
      }`
    );
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

    const totalFilteredTasks = filteredSections.reduce(
      (acc, s) => acc + s.tasks.length,
      0
    );
    lines.push(
      `=== 3. ПУНКТЫ ПРОЕКТИРОВАНИЯ ПО ВЫБРАННЫМ СТАТУСАМ (${totalFilteredTasks}) ===`
    );
    if (filteredSections.length === 0) {
      lines.push('Задач с выбранными статусами не найдено.');
    } else {
      filteredSections.forEach((sec) => {
        lines.push(`\n${sec.sectionTitle}:`);
        sec.tasks.forEach((t: any) => {
          const codePart = t.code ? `${t.code} ` : '- ';
          const statusLabel = t.status || 'не задан';
          const extra = [
            t.priority ? `Приоритет: ${t.priority}` : '',
            t.date ? `Дата: ${formatToDMY(t.date)}` : '',
            t.comment ? `Комментарий: ${t.comment}` : '',
          ]
            .filter(Boolean)
            .join(' | ');
          lines.push(
            `  • ${codePart}${t.name} — [${statusLabel}]${
              extra ? ` (${extra})` : ''
            }`
          );
        });
      });
    }

    return lines.join('\n');
  };

  const plainTextReport = generatePlainText();

  const handleCopyText = () => {
    navigator.clipboard.writeText(plainTextReport);
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
                  b.date
                    ? `<span style="color:#64748b;">(от ${formatToDMY(
                        b.date
                      )})</span>`
                    : ''
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
                    <th style="width:140px;">Скриншот</th>
                    <th>Решение</th>
                    <th style="width:100px;">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredRemarks
                    .map(
                      (r: any, idx: number) => `
                    <tr>
                      <td align="center">${idx + 1}</td>
                      <td>${escapeHtml(formatToDMY(r.date))}</td>
                      <td>${escapeHtml(r.to)}</td>
                      <td>${escapeHtml(r.desc)}</td>
                      <td align="center">${
                        r.screenshot
                          ? `<img src="${r.screenshot}" width="130" style="max-width:130px;height:auto;" />`
                          : '—'
                      }</td>
                      <td>${escapeHtml(r.resolution)}</td>
                      <td><b>${escapeHtml(r.status)}</b></td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>`);

    const tasksHtml =
      filteredSections.length === 0
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
                    <td>${escapeHtml(t.name)}</td>
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
          </table>`;

    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Статус проекта ${escapeHtml(
        projectData.num
      )}</title></head>
      <body style="font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b;">
        <h1 style="color:#1e3a8a;margin-bottom:4px;">Статус проекта #${escapeHtml(
          projectData.num
        )}${projectData.name ? ` — ${escapeHtml(projectData.name)}` : ''}</h1>
        <p style="color:#475569;margin-top:0;">
          <b>Дата отчета:</b> ${getTodayDMY()} &nbsp;|&nbsp;
          ${
            projectData.stage
              ? `<b>Стадия:</b> ${escapeHtml(projectData.stage)} &nbsp;|&nbsp;`
              : ''
          }
          ${
            projectData.deadline
              ? `<b>Дедлайн этапа:</b> ${formatToDMY(
                  projectData.deadline
                )} &nbsp;|&nbsp;`
              : ''
          }
          <b>Готовность:</b> ${progressPercent}%
        </p>
        ${
          projectData.team
            ? `<p><b>Смежники:</b> ${escapeHtml(projectData.team)}</p>`
            : ''
        }
        <hr/>
        <h2 style="color:#b91c1c;">1. Что блокирует проект (${
          filteredBlockers.length
        })</h2>
        ${blockersHtml}
        ${remarksHtml}
        <h2>${
          remarksMode === 'none' ? '2' : '3'
        }. Состояние разделов проектирования</h2>
        ${tasksHtml}
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF', fullHtml], {
      type: 'application/msword;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Status_Project_${projectData.num}_${getTodayDMY().replace(
      /\//g,
      '-'
    )}.doc`;
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
                Сформировать статус проекта #{projectData.num}
              </h3>
              <p className="text-xs text-slate-500">
                Настройте фильтры, скопируйте текст для письма или скачайте
                документ Word
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

        <div className="p-4 bg-slate-50/50 border-b border-slate-200 space-y-3 text-xs">
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

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Замечания:</span>
              <select
                value={remarksMode}
                onChange={(e) => setRemarksMode(e.target.value as any)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="open">Только открытые</option>
                <option value="all">
                  Все замечания ({(projectData.remarks || []).length})
                </option>
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

        <div className="p-4 flex-grow overflow-y-auto bg-white">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Предпросмотр сформированного отчета:
          </div>
          <textarea
            value={plainTextReport}
            readOnly
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
              {copiedText ? 'Текст скопирован!' : 'Копировать текст для письма'}
            </button>

            <button
              type="button"
              onClick={handleDownloadWord}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download size={15} /> Скачать в Word (.doc)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  onPreviewImage,
  onSyncSingleProjectToReport,
  externalSubTab,
  onClearExternalSubTab,
}: any) {
  const [subTab, setSubTab] = useState<
    'tasks' | 'remarks' | 'docs' | 'related'
  >('tasks');
  const [isCreating, setIsCreating] = useState(false);
  const [newNum, setNewNum] = useState('');
  const [newName, setNewName] = useState('');
  const [newStage, setNewStage] = useState('');
  const [newBlockerText, setNewBlockerText] = useState('');
  const [showResolvedBlockers, setShowResolvedBlockers] = useState(false);
  const [showOverviewGrid, setShowOverviewGrid] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [addingToSection, setAddingToSection] = useState<string | null>(null);
  const [customTaskName, setCustomTaskName] = useState('');
  const [copiedRemarks, setCopiedRemarks] = useState(false);

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [isManagingStatuses, setIsManagingStatuses] = useState(false);
  const [newCustomStatus, setNewCustomStatus] = useState('');
  const [sortByPriority, setSortByPriority] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    if (externalSubTab) {
      setSubTab(externalSubTab);
      if (onClearExternalSubTab) onClearExternalSubTab();
    }
  }, [externalSubTab, onClearExternalSubTab]);

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
  const [permFilters, setPermFilters] = useState({
    name: '',
    status: '',
    date: '',
  });
  const [fileFilters, setFileFilters] = useState({
    name: '',
    status: '',
    date: '',
  });
  const [relMeetingFilters, setRelMeetingFilters] = useState({
    date: '',
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

  const activeProject =
    projects.find((p: any) => p.id === activeProjectId) || null;
  const projectData = activeProject
    ? {
        ...activeProject,
        stage: activeProject.stage || '',
        deadline: activeProject.deadline || '',
        team: activeProject.team || '',
        blockers: activeProject.blockers || [],
        customStatuses: activeProject.customStatuses || [],
        tasks: activeProject.tasks || createTasksFromTemplate(),
        files: activeProject.files || [...DEFAULT_FILES],
        permissions: activeProject.permissions || [...DEFAULT_PERMISSIONS],
        remarks: activeProject.remarks || [],
      }
    : null;

  const availableTaskStatuses = projectData
    ? [...DEFAULT_TASK_STATUSES, ...projectData.customStatuses]
    : DEFAULT_TASK_STATUSES;

  const usedPriorities: string[] = projectData
    ? Array.from(
        new Set(
          projectData.tasks
            .filter((t: any) => !t.isHeader && (t.priority || '').trim())
            .map((t: any) => String(t.priority).trim())
        )
      )
    : [];

  const updateField = (field: string, value: any) => {
    setProjects(
      projects.map((p: any) =>
        p.id === activeProjectId ? { ...p, [field]: value } : p
      )
    );
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNum.trim()) return;
    const newProj = {
      id: Date.now().toString(),
      num: newNum.trim(),
      name: newName.trim(),
      stage: newStage.trim(),
      deadline: '',
      team: '',
      comment: '',
      blockers: [],
      customStatuses: [],
      tasks: createTasksFromTemplate(),
      files: [...DEFAULT_FILES],
      permissions: [...DEFAULT_PERMISSIONS],
      remarks: [],
    };
    setProjects([...projects, newProj]);
    setActiveProjectId(newProj.id);
    setNewNum('');
    setNewName('');
    setNewStage('');
    setIsCreating(false);
  };

  const handleMigrateToNewTemplate = () => {
    if (!projectData) return;
    const upgradedTasks = createTasksFromTemplate(projectData.tasks);
    updateField('tasks', upgradedTasks);
  };

  const handleAddCustomSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim() || !projectData) return;
    const headersCount = projectData.tasks.filter(
      (t: any) => t.isHeader
    ).length;
    const nextNum = headersCount + 1;
    const rawTitle = newSectionTitle.trim();
    const formattedTitle = /^\d+\./.test(rawTitle)
      ? rawTitle
      : `${nextNum}. ${rawTitle}`;

    const newHeader = {
      code: String(nextNum),
      name: `📋 ${formattedTitle}`,
      isHeader: true,
      isCustomSection: true,
      status: '',
      priority: '',
      estHours: '',
      date: '',
      comment: '',
    };

    updateField('tasks', [...projectData.tasks, newHeader]);
    setNewSectionTitle('');
    setIsAddingSection(false);
  };

  const handleDeleteCustomSection = (sectionHeaderName: string) => {
    if (!projectData) return;
    const tasksArr = [...projectData.tasks];
    const startIdx = tasksArr.findIndex(
      (t: any) => t.isHeader && t.name === sectionHeaderName
    );
    if (startIdx === -1) return;

    let endIdx = startIdx + 1;
    while (endIdx < tasksArr.length && !tasksArr[endIdx].isHeader) {
      endIdx++;
    }
    tasksArr.splice(startIdx, endIdx - startIdx);
    updateField('tasks', tasksArr);
  };

  const handleAddCustomStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomStatus.trim() || !projectData) return;
    const cleaned = newCustomStatus.trim();
    if (
      !availableTaskStatuses.some(
        (s) => s.toLowerCase() === cleaned.toLowerCase()
      )
    ) {
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

  const handleAddCustomTaskToSection = (sectionHeaderName: string) => {
    if (!customTaskName.trim() || !projectData) return;
    const tasksArr = [...projectData.tasks];
    const headerIdx = tasksArr.findIndex(
      (t: any) => t.isHeader && t.name === sectionHeaderName
    );
    if (headerIdx === -1) return;

    const sectionCode = tasksArr[headerIdx].code || '';
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
      status: '',
      priority: '',
      estHours: '',
      date: '',
      comment: '',
    });

    updateField('tasks', tasksArr);
    setCustomTaskName('');
    setAddingToSection(null);
  };

  const handleCopyOpenRemarks = () => {
    if (!projectData) return;
    const openRemarks = projectData.remarks.filter(
      (r: any) =>
        !['решен', 'не актуальный'].includes((r.status || '').toLowerCase())
    );
    if (!openRemarks.length) {
      alert('Открытых замечаний по этому проекту нет.');
      return;
    }
    const header = `Проект ${projectData.num}${
      projectData.name ? ` (${projectData.name})` : ''
    } — открытые замечания (${openRemarks.length}):\n\n`;
    const body = openRemarks
      .map((r: any, idx: number) => {
        const meta = [
          r.to ? `Кому: ${r.to}` : '',
          r.date ? `Дата: ${formatToDMY(r.date)}` : '',
          r.status ? `Статус: ${r.status}` : '',
        ]
          .filter(Boolean)
          .join(' | ');
        return `${idx + 1}. ${r.desc || '(без описания)'}${
          meta ? `\n   [${meta}]` : ''
        }`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(header + body);
    setCopiedRemarks(true);
    setTimeout(() => setCopiedRemarks(false), 2500);
  };

  const buildGroupedSections = () => {
    if (!projectData) return [];
    const sections: Array<{
      headerName: string;
      displayTitle: string;
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
          headerName: t.name,
          displayTitle: t.name.replace('📋 ', '').trim(),
          isCustomSection: Boolean(t.isCustomSection),
          items: [],
          completedCount: 0,
          totalActionable: 0,
          remainingHours: 0,
        };
      } else {
        if (!currentSection) {
          currentSection = {
            headerName: '📋 Общее',
            displayTitle: 'Общее',
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
          const hrs =
            parseFloat(String(t.estHours || '').replace(',', '.')) || 0;
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
  const activeBlockersCount = projectData
    ? projectData.blockers.filter((b: any) => !b.resolved).length
    : 0;
  const displayedBlockers = projectData
    ? showResolvedBlockers
      ? projectData.blockers
      : projectData.blockers.filter((b: any) => !b.resolved)
    : [];

  const projectMeetings = projectData
    ? meetings.filter(
        (m: any) =>
          (m.projectNum || '').trim() === (projectData.num || '').trim()
      )
    : [];
  const projectQuickTasks = projectData
    ? tasks.filter(
        (t: any) => (t.project || '').trim() === (projectData.num || '').trim()
      )
    : [];
  const sectionsList = buildGroupedSections();
  const totalRemainingHours = sectionsList.reduce(
    (acc, s) => acc + s.remainingHours,
    0
  );

  const isLegacyTemplate =
    projectData &&
    projectData.tasks.filter((t: any) => t.isHeader).length <
      PROJECT_SECTIONS_TEMPLATE.length;

  const toggleAllSections = (collapse: boolean) => {
    const next: Record<string, boolean> = {};
    sectionsList.forEach((sec) => {
      next[sec.headerName] = collapse;
    });
    setCollapsedSections(next);
  };

  const updateMeetingRow = (id: any, field: string, value: any) => {
    setMeetings(
      meetings.map((m: any) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const updateQuickTaskRow = (id: any, field: string, value: any) => {
    setTasks(
      tasks.map((t: any) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  let fallbackCounter = 1;

  return (
    <div className="space-y-5">
      {/* Быстрый переключатель объектов */}
      {projects.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowOverviewGrid(!showOverviewGrid)}
            className="w-full px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100/70 border-b border-slate-200/70 flex items-center justify-between text-xs font-semibold text-slate-600 transition-colors"
          >
            <span className="flex items-center gap-2">
              <LayoutGrid size={15} className="text-indigo-600" />
              Быстрый переход между объектами ({projects.length})
            </span>
            <span className="text-slate-400 flex items-center gap-1">
              {showOverviewGrid ? 'Свернуть' : 'Развернуть'}
              {showOverviewGrid ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </span>
          </button>

          {showOverviewGrid && (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {projects.map((p: any) => {
                const isSelected = p.id === activeProjectId;
                const pct = calcProjectProgress(p);
                const blockersCnt = (p.blockers || []).filter(
                  (b: any) => !b.resolved
                ).length;
                const openRemarksCnt = (p.remarks || []).filter(
                  (r: any) =>
                    !['решен', 'не актуальный'].includes(
                      (r.status || '').toLowerCase()
                    )
                ).length;
                const urgency = getDeadlineUrgency(p.deadline);

                return (
                  <div
                    key={p.id}
                    onClick={() => setActiveProjectId(p.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-500/15'
                        : 'bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-indigo-700">
                            #{p.num}
                          </span>
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
                      <span className="text-xs font-bold text-slate-700 shrink-0">
                        {pct}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2.5">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

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
                          Зам: {openRemarksCnt}
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

      {/* Панель выбора проекта и основных действий */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-grow">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-grow md:flex-grow-0 md:min-w-[320px]">
              <FolderKanban size={18} className="text-indigo-600 shrink-0" />
              <select
                className="w-full bg-transparent font-semibold text-slate-800 text-sm focus:outline-none cursor-pointer"
                value={activeProjectId || ''}
                onChange={(e) => setActiveProjectId(e.target.value)}
              >
                <option value="" disabled>
                  Выберите проект из списка...
                </option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    Проект {p.num} {p.name ? `— ${p.name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {projectData && (
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70">
                <div className="text-xs text-slate-500">
                  Готовность:{' '}
                  <span className="font-bold text-slate-800">
                    {progressPercent}%
                  </span>
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
                  onClick={() => setIsExportModalOpen(true)}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Сформировать отчет по статусу, замечаниям и блокерам для письма или Word"
                >
                  <FileText size={15} /> Сформировать статус (Word / Письмо)
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

        {/* ПАСПОРТ ОБЪЕКТА */}
        {projectData && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 bg-slate-50/70 px-3 py-1.5 rounded-lg border border-slate-200/70">
              <span className="text-xs font-semibold text-slate-500 shrink-0">
                Стадия:
              </span>
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
              </datalist>
            </div>

            <div className="flex items-center gap-2 bg-slate-50/70 px-3 py-1.5 rounded-lg border border-slate-200/70">
              <Clock size={14} className="text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-500 shrink-0">
                Дедлайн этапа:
              </span>
              <div className="w-36">
                <DateInput
                  value={projectData.deadline}
                  onChange={(val) => updateField('deadline', val)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50/70 px-3 py-1.5 rounded-lg border border-slate-200/70">
              <UserCheck size={14} className="text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-500 shrink-0">
                Смежники:
              </span>
              <input
                type="text"
                value={projectData.team}
                onChange={(e) => updateField('team', e.target.value)}
                placeholder="Архитектор, конструктор, BIM..."
                className="w-full text-xs text-slate-700 bg-transparent focus:bg-white px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreateProject}
          className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-xl flex flex-col sm:flex-row items-end gap-3"
        >
          <div className="w-full sm:w-36">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Номер проекта *
            </label>
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
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Стадия
            </label>
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
        </form>
      )}

      {!projectData ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-sm">
          <FolderKanban size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-700">
            Проект не выбран
          </h3>
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

          {/* БЛОКЕРЫ ПО ПРОЕКТУ */}
          <div className="bg-white rounded-xl border border-rose-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-rose-50/60 border-b border-rose-100 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert size={17} className="text-rose-600" />
                <h3 className="font-semibold text-sm text-slate-800">
                  Что блокирует проект
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                  Активных: {activeBlockersCount}
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  — автоматически подтягивается в еженедельный отчет, пока не
                  отмечено как решенное
                </span>
              </div>
              {projectData.blockers.some((b: any) => b.resolved) && (
                <button
                  onClick={() => setShowResolvedBlockers(!showResolvedBlockers)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  {showResolvedBlockers
                    ? 'Скрыть решенные'
                    : 'Показать решенные'}
                </button>
              )}
            </div>

            <div className="p-3 space-y-2">
              <form onSubmit={handleAddBlocker} className="flex gap-2">
                <input
                  type="text"
                  value={newBlockerText}
                  onChange={(e) => setNewBlockerText(e.target.value)}
                  placeholder="Опишите блокер (например: Нет архитектуры подвала, Ждем отчет гидролога)..."
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
                          b.resolved
                            ? 'text-emerald-600'
                            : 'text-slate-300 hover:text-emerald-600'
                        }`}
                        title={
                          b.resolved
                            ? 'Вернуть в активные'
                            : 'Отметить как решенное'
                        }
                      >
                        {b.resolved ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <Circle size={17} />
                        )}
                      </button>
                      <input
                        type="text"
                        value={b.text}
                        onChange={(e) =>
                          updateBlockerText(b.id, e.target.value)
                        }
                        className={`flex-grow bg-transparent focus:bg-slate-50 px-1.5 py-0.5 rounded focus:outline-none ${
                          b.resolved
                            ? 'line-through text-slate-400'
                            : 'text-slate-700 font-medium'
                        }`}
                      />
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {formatToDMY(b.date)}
                      </span>
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

          {/* Внутренняя навигация по разделам проекта */}
          <div className="flex flex-wrap gap-1.5 bg-slate-200/60 p-1 rounded-xl w-fit">
            {[
              {
                id: 'tasks',
                label: 'Инженерия (Чек-лист)',
                icon: Layers,
                count: projectData.tasks.filter((t: any) => !t.isHeader).length,
              },
              {
                id: 'remarks',
                label: 'Замечания',
                icon: AlertCircle,
                count: projectData.remarks.length,
              },
              {
                id: 'docs',
                label: 'Разрешения и Файлы',
                icon: FileCheck2,
                count:
                  projectData.permissions.length + projectData.files.length,
              },
              {
                id: 'related',
                label: 'Встречи и Задачи по проекту',
                icon: MessageSquare,
                count: projectMeetings.length + projectQuickTasks.length,
              },
            ].map((item) => {
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
                      isActive
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-300/70 text-slate-600'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* РАЗДЕЛ 1: ИНЖЕНЕРНЫЕ ЗАДАЧИ */}
          {subTab === 'tasks' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <datalist id="project-priorities-list">
                {usedPriorities.map((pr) => (
                  <option key={pr} value={pr} />
                ))}
              </datalist>

              <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-semibold text-slate-800">
                    Чек-лист проектирования
                  </h3>
                  {totalRemainingHours > 0 && (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1"
                      title="Сумма часов по всем незавершенным и актуальным задачам"
                    >
                      <Clock size={12} /> Осталось:{' '}
                      {Number(totalRemainingHours.toFixed(1))} ч
                    </span>
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
                    <ArrowUpDown size={12} />{' '}
                    {sortByPriority ? 'По приоритету ✓' : 'По приоритету'}
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
                        setTaskFilters({
                          name: '',
                          status: '',
                          priority: '',
                          estHours: '',
                          date: '',
                          comment: '',
                        })
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
                  <span className="text-xs font-semibold text-indigo-900">
                    Новый раздел для проекта:
                  </span>
                  <input
                    type="text"
                    autoFocus
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="Например: 18. Насосная станция или Бассейн..."
                    className="flex-grow min-w-[240px] px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
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
                  <form
                    onSubmit={handleAddCustomStatus}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="text-xs font-semibold text-purple-900">
                      Добавить уникальный статус:
                    </span>
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
                      <span className="text-slate-500 mr-1">
                        Добавленные для этого проекта:
                      </span>
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
                      <th className="pt-2.5 pb-1.5 px-3 w-14 text-center">
                        Пункт
                      </th>
                      <th className="pt-2.5 pb-1.5 px-3 min-w-[250px]">
                        Раздел / Задача
                      </th>
                      <th className="pt-2.5 pb-1.5 px-2 w-48">Статус</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-32">Приоритет</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-24 text-center">
                        Время (ч)
                      </th>
                      <th className="pt-2.5 pb-1.5 px-2 w-36">Дата</th>
                      <th className="pt-2.5 pb-1.5 px-3 min-w-[200px]">
                        Комментарий
                      </th>
                    </tr>
                    <tr className="bg-slate-50/40 border-b border-slate-200">
                      <th className="pb-2 px-2"></th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.name}
                          onChange={(v) =>
                            setTaskFilters({ ...taskFilters, name: v })
                          }
                          placeholder="Название или код..."
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColSelectFilter
                          value={taskFilters.status}
                          options={availableTaskStatuses}
                          onChange={(v) =>
                            setTaskFilters({ ...taskFilters, status: v })
                          }
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.priority}
                          onChange={(v) =>
                            setTaskFilters({ ...taskFilters, priority: v })
                          }
                          placeholder="Фильтр..."
                          listId="project-priorities-list"
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.estHours}
                          onChange={(v) =>
                            setTaskFilters({ ...taskFilters, estHours: v })
                          }
                          placeholder="ч..."
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.date}
                          onChange={(v) =>
                            setTaskFilters({ ...taskFilters, date: v })
                          }
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={taskFilters.comment}
                          onChange={(v) =>
                            setTaskFilters({ ...taskFilters, comment: v })
                          }
                          placeholder="Комментарий..."
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sectionsList.map((sec) => {
                      const hasFilter =
                        Object.values(taskFilters).some(Boolean);
                      let visibleItems = sec.items.filter(({ task: t }) => {
                        const searchStr = `${t.code || ''} ${
                          t.name || ''
                        }`.toLowerCase();
                        return (
                          (!taskFilters.name ||
                            searchStr.includes(
                              taskFilters.name.toLowerCase()
                            )) &&
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
                          (!taskFilters.comment ||
                            (t.comment || '')
                              .toLowerCase()
                              .includes(taskFilters.comment.toLowerCase()))
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

                      const isCollapsed =
                        !hasFilter &&
                        Boolean(collapsedSections[sec.headerName]);
                      const isSectionComplete =
                        sec.totalActionable > 0 &&
                        sec.completedCount === sec.totalActionable;

                      return (
                        <React.Fragment key={sec.headerName}>
                          <tr className="bg-slate-100/90 hover:bg-slate-200/60 transition-colors">
                            <td colSpan={7} className="py-2 px-3">
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCollapsedSections({
                                      ...collapsedSections,
                                      [sec.headerName]: !isCollapsed,
                                    })
                                  }
                                  className="flex items-center gap-2 font-bold text-xs text-slate-700 uppercase tracking-wider text-left"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight
                                      size={15}
                                      className="text-slate-500"
                                    />
                                  ) : (
                                    <ChevronDown
                                      size={15}
                                      className="text-slate-500"
                                    />
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
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCollapsedSections({
                                        ...collapsedSections,
                                        [sec.headerName]: false,
                                      });
                                      setAddingToSection(
                                        addingToSection === sec.headerName
                                          ? null
                                          : sec.headerName
                                      );
                                      setCustomTaskName('');
                                    }}
                                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-slate-200/80 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                    title="Добавить свой пункт в этот раздел"
                                  >
                                    <Plus size={12} /> Задача
                                  </button>
                                  {sec.isCustomSection && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteCustomSection(
                                          sec.headerName
                                        )
                                      }
                                      className="text-slate-400 hover:text-rose-600 bg-white border border-slate-200/80 p-1 rounded transition-colors"
                                      title="Удалить добавленный раздел"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>

                          {!isCollapsed &&
                            addingToSection === sec.headerName && (
                              <tr className="bg-indigo-50/50">
                                <td className="p-2 text-center text-xs text-indigo-400">
                                  +
                                </td>
                                <td colSpan={6} className="p-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      autoFocus
                                      value={customTaskName}
                                      onChange={(e) =>
                                        setCustomTaskName(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleAddCustomTaskToSection(
                                            sec.headerName
                                          );
                                        }
                                      }}
                                      placeholder="Название новой задачи в этом разделе..."
                                      className="flex-grow px-2.5 py-1 text-xs bg-white border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAddCustomTaskToSection(
                                          sec.headerName
                                        )
                                      }
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-medium"
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
                            visibleItems.map(
                              ({ task: t, originalIndex: i }) => {
                                const itemCode =
                                  t.code || String(fallbackCounter++);
                                const isMuted = t.status === 'не требуется';

                                return (
                                  <tr
                                    key={i}
                                    className={`group hover:bg-slate-50/80 transition-colors align-top ${
                                      isMuted ? 'opacity-50 bg-slate-50/40' : ''
                                    }`}
                                  >
                                    <td className="p-2.5 text-center text-xs text-slate-400 font-mono font-semibold">
                                      {itemCode}
                                    </td>
                                    <td
                                      className={`p-2.5 font-medium text-slate-700 whitespace-pre-wrap break-words ${
                                        isMuted ? 'line-through' : ''
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span>{t.name}</span>
                                        {t.isCustom && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const arr =
                                                projectData.tasks.filter(
                                                  (_: any, idx: number) =>
                                                    idx !== i
                                                );
                                              updateField('tasks', arr);
                                            }}
                                            className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
                                          arr[i].status = val;
                                          if (
                                            val &&
                                            !arr[i].date &&
                                            val !== 'не требуется'
                                          ) {
                                            arr[i].date = getTodayDMY();
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
                                          arr[i].priority = e.target.value;
                                          updateField('tasks', arr);
                                        }}
                                        placeholder="—"
                                        className={`w-full px-2 py-1 text-xs rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                                          (t.priority || '').trim()
                                            ? 'bg-amber-50/80 border-amber-200/90 text-amber-900 font-medium'
                                            : 'bg-transparent border-transparent hover:bg-slate-100/80 hover:border-slate-200 text-slate-700'
                                        }`}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <div className="relative flex items-center">
                                        <input
                                          type="number"
                                          step="0.5"
                                          min="0"
                                          placeholder="0"
                                          value={t.estHours || ''}
                                          onChange={(e) => {
                                            const arr = [...projectData.tasks];
                                            arr[i].estHours = e.target.value;
                                            updateField('tasks', arr);
                                          }}
                                          className="w-full px-2 py-1 text-xs text-center font-mono text-slate-700 bg-transparent hover:bg-slate-100/80 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 rounded border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none"
                                        />
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <DateInput
                                        value={t.date}
                                        onChange={(val) => {
                                          const arr = [...projectData.tasks];
                                          arr[i].date = val;
                                          updateField('tasks', arr);
                                        }}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <AutoTextarea
                                        value={t.comment}
                                        onChange={(val) => {
                                          const arr = [...projectData.tasks];
                                          arr[i].comment = val;
                                          updateField('tasks', arr);
                                        }}
                                        placeholder="Заметка..."
                                        className="text-xs text-slate-600"
                                      />
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* РАЗДЕЛ 2: ЗАМЕЧАНИЯ ПО ПРОЕКТУ */}
          {subTab === 'remarks' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h3 className="font-semibold text-slate-800">
                    Реестр замечаний и координации
                  </h3>
                  <p className="text-xs text-slate-400">
                    Для вставки скриншота кликните в ячейку «Скрин» (или прямо в
                    строку замечания) и нажмите Ctrl+V, либо выберите файл
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyOpenRemarks}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                      copiedRemarks
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title="Скопировать список нерешенных замечаний для вставки в письмо"
                  >
                    {copiedRemarks ? <Check size={14} /> : <Copy size={14} />}
                    {copiedRemarks ? 'Скопировано!' : 'Скопировать для письма'}
                  </button>
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
                      className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-lg flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Сбросить
                    </button>
                  )}
                  <button
                    onClick={() =>
                      updateField('remarks', [
                        {
                          id: Date.now(),
                          date: getTodayDMY(),
                          to: '',
                          desc: '',
                          screenshot: '',
                          dateSent: '',
                          dateAnswer: '',
                          resolution: '',
                          status: 'создан',
                        },
                        ...projectData.remarks,
                      ])
                    }
                    className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 shadow-xs whitespace-nowrap"
                  >
                    <Plus size={14} /> Добавить замечание
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="pt-2.5 pb-1.5 px-2 w-36">Дата</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-32">Кому / От</th>
                      <th className="pt-2.5 pb-1.5 px-2 min-w-[200px]">
                        Описание
                      </th>
                      <th className="pt-2.5 pb-1.5 px-2 w-32 text-center">
                        Скрин
                      </th>
                      <th className="pt-2.5 pb-1.5 px-2 w-36">Отправлено</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-36">Ответ</th>
                      <th className="pt-2.5 pb-1.5 px-2 min-w-[180px]">
                        Решение
                      </th>
                      <th className="pt-2.5 pb-1.5 px-2 w-44">Статус</th>
                      <th className="pt-2.5 pb-1.5 px-2 w-10"></th>
                    </tr>
                    <tr className="bg-slate-50/40 border-b border-slate-200">
                      <th className="pb-2 px-1.5">
                        <ColTextFilter
                          value={remarkFilters.date}
                          onChange={(v) =>
                            setRemarkFilters({ ...remarkFilters, date: v })
                          }
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-1.5">
                        <ColTextFilter
                          value={remarkFilters.to}
                          onChange={(v) =>
                            setRemarkFilters({ ...remarkFilters, to: v })
                          }
                          placeholder="Кому"
                        />
                      </th>
                      <th className="pb-2 px-1.5">
                        <ColTextFilter
                          value={remarkFilters.desc}
                          onChange={(v) =>
                            setRemarkFilters({ ...remarkFilters, desc: v })
                          }
                        />
                      </th>
                      <th className="pb-2 px-1.5"></th>
                      <th className="pb-2 px-1.5">
                        <ColTextFilter
                          value={remarkFilters.dateSent}
                          onChange={(v) =>
                            setRemarkFilters({ ...remarkFilters, dateSent: v })
                          }
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-1.5">
                        <ColTextFilter
                          value={remarkFilters.dateAnswer}
                          onChange={(v) =>
                            setRemarkFilters({
                              ...remarkFilters,
                              dateAnswer: v,
                            })
                          }
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                      <th className="pb-2 px-1.5">
                        <ColTextFilter
                          value={remarkFilters.resolution}
                          onChange={(v) =>
                            setRemarkFilters({
                              ...remarkFilters,
                              resolution: v,
                            })
                          }
                        />
                      </th>
                      <th className="pb-2 px-1.5">
                        <ColSelectFilter
                          value={remarkFilters.status}
                          options={[
                            'создан',
                            'отправлен',
                            'решен',
                            'частичный ответ',
                            'не актуальный',
                          ]}
                          onChange={(v) =>
                            setRemarkFilters({ ...remarkFilters, status: v })
                          }
                        />
                      </th>
                      <th className="pb-2 px-1.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectData.remarks
                      .filter((r: any) => {
                        return (
                          matchDateFilter(r.date, remarkFilters.date) &&
                          (!remarkFilters.to ||
                            (r.to || '')
                              .toLowerCase()
                              .includes(remarkFilters.to.toLowerCase())) &&
                          (!remarkFilters.desc ||
                            (r.desc || '')
                              .toLowerCase()
                              .includes(remarkFilters.desc.toLowerCase())) &&
                          matchDateFilter(r.dateSent, remarkFilters.dateSent) &&
                          matchDateFilter(
                            r.dateAnswer,
                            remarkFilters.dateAnswer
                          ) &&
                          (!remarkFilters.resolution ||
                            (r.resolution || '')
                              .toLowerCase()
                              .includes(
                                remarkFilters.resolution.toLowerCase()
                              )) &&
                          matchStatusFilter(r.status, remarkFilters.status)
                        );
                      })
                      .map((r: any) => {
                        const i = projectData.remarks.findIndex(
                          (rm: any) => rm.id === r.id
                        );
                        return (
                          <tr
                            key={r.id}
                            onPaste={(e) =>
                              handlePasteImage(e, (img) => {
                                const arr = [...projectData.remarks];
                                arr[i].screenshot = img;
                                updateField('remarks', arr);
                              })
                            }
                            className="group hover:bg-slate-50/70 align-top"
                          >
                            <td className="p-2">
                              <DateInput
                                value={r.date}
                                onChange={(val) => {
                                  const arr = [...projectData.remarks];
                                  arr[i].date = val;
                                  updateField('remarks', arr);
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                placeholder="Архитектор..."
                                className="w-full px-2 py-1 text-xs font-medium bg-transparent hover:bg-slate-100 rounded focus:bg-white focus:outline-none"
                                value={r.to}
                                onChange={(e) => {
                                  const arr = [...projectData.remarks];
                                  arr[i].to = e.target.value;
                                  updateField('remarks', arr);
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <AutoTextarea
                                value={r.desc}
                                onChange={(val) => {
                                  const arr = [...projectData.remarks];
                                  arr[i].desc = val;
                                  updateField('remarks', arr);
                                }}
                                placeholder="Текст замечания..."
                                className="text-xs"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <ImageCell
                                src={r.screenshot}
                                onChange={(img) => {
                                  const arr = [...projectData.remarks];
                                  arr[i].screenshot = img;
                                  updateField('remarks', arr);
                                }}
                                onPreview={onPreviewImage}
                              />
                            </td>
                            <td className="p-2">
                              <DateInput
                                value={r.dateSent}
                                onChange={(val) => {
                                  const arr = [...projectData.remarks];
                                  arr[i].dateSent = val;
                                  updateField('remarks', arr);
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <DateInput
                                value={r.dateAnswer}
                                onChange={(val) => {
                                  const arr = [...projectData.remarks];
                                  arr[i].dateAnswer = val;
                                  updateField('remarks', arr);
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <AutoTextarea
                                value={r.resolution}
                                onChange={(val) => {
                                  const arr = [...projectData.remarks];
                                  arr[i].resolution = val;
                                  updateField('remarks', arr);
                                }}
                                placeholder="Как решено..."
                                className="text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <StatusPill
                                value={r.status}
                                options={[
                                  'создан',
                                  'отправлен',
                                  'решен',
                                  'частичный ответ',
                                  'не актуальный',
                                ]}
                                onChange={(val) => {
                                  const arr = [...projectData.remarks];
                                  arr[i].status = val;
                                  updateField('remarks', arr);
                                }}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() =>
                                  updateField(
                                    'remarks',
                                    projectData.remarks.filter(
                                      (rm: any) => rm.id !== r.id
                                    )
                                  )
                                }
                                className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* РАЗДЕЛ 3: РАЗРЕШЕНИЯ И ФАЙЛЫ */}
          {subTab === 'docs' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800">
                    Согласования и разрешения
                  </h3>
                  {Object.values(permFilters).some(Boolean) && (
                    <button
                      onClick={() =>
                        setPermFilters({ name: '', status: '', date: '' })
                      }
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="pt-2 pb-1 px-3">Процесс</th>
                      <th className="pt-2 pb-1 px-3 w-48">Статус</th>
                      <th className="pt-2 pb-1 px-3 w-36">Дата</th>
                    </tr>
                    <tr className="bg-slate-50/40 border-b border-slate-200">
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={permFilters.name}
                          onChange={(v) =>
                            setPermFilters({ ...permFilters, name: v })
                          }
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColSelectFilter
                          value={permFilters.status}
                          options={[
                            'отправили на согласование',
                            'требует исправления',
                            'одобрен',
                          ]}
                          onChange={(v) =>
                            setPermFilters({ ...permFilters, status: v })
                          }
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={permFilters.date}
                          onChange={(v) =>
                            setPermFilters({ ...permFilters, date: v })
                          }
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectData.permissions
                      .filter(
                        (p: any) =>
                          (!permFilters.name ||
                            p.name
                              .toLowerCase()
                              .includes(permFilters.name.toLowerCase())) &&
                          matchStatusFilter(p.status, permFilters.status) &&
                          matchDateFilter(p.date, permFilters.date)
                      )
                      .map((p: any) => {
                        const i = projectData.permissions.findIndex(
                          (item: any) => item.name === p.name
                        );
                        return (
                          <tr key={i} className="hover:bg-slate-50/70">
                            <td className="p-3 font-medium text-slate-700">
                              {p.name}
                            </td>
                            <td className="p-2">
                              <StatusPill
                                value={p.status}
                                options={[
                                  'отправили на согласование',
                                  'требует исправления',
                                  'одобрен',
                                ]}
                                onChange={(val) => {
                                  const arr = [...projectData.permissions];
                                  arr[i].status = val;
                                  updateField('permissions', arr);
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <DateInput
                                value={p.date}
                                onChange={(val) => {
                                  const arr = [...projectData.permissions];
                                  arr[i].date = val;
                                  updateField('permissions', arr);
                                }}
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
                  <h3 className="font-semibold text-slate-800">
                    Исходные данные и смежники
                  </h3>
                  {Object.values(fileFilters).some(Boolean) && (
                    <button
                      onClick={() =>
                        setFileFilters({ name: '', status: '', date: '' })
                      }
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="pt-2 pb-1 px-3">Документ / Раздел</th>
                      <th className="pt-2 pb-1 px-3 w-40">Наличие</th>
                      <th className="pt-2 pb-1 px-3 w-36">Дата</th>
                    </tr>
                    <tr className="bg-slate-50/40 border-b border-slate-200">
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={fileFilters.name}
                          onChange={(v) =>
                            setFileFilters({ ...fileFilters, name: v })
                          }
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColSelectFilter
                          value={fileFilters.status}
                          options={['есть', 'нет', 'запросили']}
                          onChange={(v) =>
                            setFileFilters({ ...fileFilters, status: v })
                          }
                        />
                      </th>
                      <th className="pb-2 px-2">
                        <ColTextFilter
                          value={fileFilters.date}
                          onChange={(v) =>
                            setFileFilters({ ...fileFilters, date: v })
                          }
                          placeholder="ДД/ММ/ГГГГ"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectData.files
                      .filter(
                        (f: any) =>
                          (!fileFilters.name ||
                            f.name
                              .toLowerCase()
                              .includes(fileFilters.name.toLowerCase())) &&
                          matchStatusFilter(f.status, fileFilters.status) &&
                          matchDateFilter(f.date, fileFilters.date)
                      )
                      .map((f: any) => {
                        const i = projectData.files.findIndex(
                          (item: any) => item.name === f.name
                        );
                        return (
                          <tr key={i} className="hover:bg-slate-50/70">
                            <td className="p-3 font-medium text-slate-700">
                              {f.name}
                            </td>
                            <td className="p-2">
                              <StatusPill
                                value={f.status}
                                options={['есть', 'нет', 'запросили']}
                                onChange={(val) => {
                                  const arr = [...projectData.files];
                                  arr[i].status = val;
                                  updateField('files', arr);
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <DateInput
                                value={f.date}
                                onChange={(val) => {
                                  const arr = [...projectData.files];
                                  arr[i].date = val;
                                  updateField('files', arr);
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-2">
                  Общие заметки по объекту
                </h3>
                <AutoTextarea
                  value={projectData.comment}
                  onChange={(val) => updateField('comment', val)}
                  placeholder="Ключевые особенности объекта, контакты ГИПа, ссылки на папки..."
                  className="min-h-[90px] bg-slate-50/70 p-3 text-sm text-slate-700 border border-slate-200/70"
                />
              </div>
            </div>
          )}

          {/* РАЗДЕЛ 4: ПОЛНАЯ ИНФОРМАЦИЯ ПО ВСТРЕЧАМ И ЗАДАЧАМ ПРОЕКТА */}
          {subTab === 'related' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      Все встречи по проекту #{projectData.num} (
                      {projectMeetings.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Полная информация с возможностью редактирования, вставки
                      скриншотов и смены статуса прямо здесь
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMeetings([
                          {
                            id: Date.now(),
                            projectNum: projectData.num,
                            date: getTodayDMY(),
                            desc: '',
                            fix: '',
                            screenshot: '',
                            status: 'в работе',
                            comment: '',
                          },
                          ...meetings,
                        ])
                      }
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <Plus size={14} /> Добавить встречу
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateWithFilter(1, projectData.num)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg"
                    >
                      Открыть во вкладке «Встречи» →
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                        <th className="pt-2.5 pb-1.5 px-2 w-36">Дата</th>
                        <th className="pt-2.5 pb-1.5 px-2 min-w-[210px]">
                          Описание вопроса
                        </th>
                        <th className="pt-2.5 pb-1.5 px-2 min-w-[210px]">
                          Что исправить
                        </th>
                        <th className="pt-2.5 pb-1.5 px-2 w-32 text-center">
                          Скриншот
                        </th>
                        <th className="pt-2.5 pb-1.5 px-2 w-44">Статус</th>
                        <th className="pt-2.5 pb-1.5 px-2 min-w-[160px]">
                          Комментарий
                        </th>
                        <th className="pt-2.5 pb-1.5 px-2 w-10"></th>
                      </tr>
                      <tr className="bg-slate-50/40 border-b border-slate-200">
                        <th className="pb-2 px-1.5">
                          <ColTextFilter
                            value={relMeetingFilters.date}
                            onChange={(v) =>
                              setRelMeetingFilters({
                                ...relMeetingFilters,
                                date: v,
                              })
                            }
                            placeholder="ДД/ММ/ГГГГ"
                          />
                        </th>
                        <th className="pb-2 px-1.5">
                          <ColTextFilter
                            value={relMeetingFilters.desc}
                            onChange={(v) =>
                              setRelMeetingFilters({
                                ...relMeetingFilters,
                                desc: v,
                              })
                            }
                          />
                        </th>
                        <th className="pb-2 px-1.5">
                          <ColTextFilter
                            value={relMeetingFilters.fix}
                            onChange={(v) =>
                              setRelMeetingFilters({
                                ...relMeetingFilters,
                                fix: v,
                              })
                            }
                          />
                        </th>
                        <th className="pb-2 px-1.5"></th>
                        <th className="pb-2 px-1.5">
                          <ColSelectFilter
                            value={relMeetingFilters.status}
                            options={[
                              'в работе',
                              'исправлено',
                              'на паузе',
                              'передано другому',
                            ]}
                            onChange={(v) =>
                              setRelMeetingFilters({
                                ...relMeetingFilters,
                                status: v,
                              })
                            }
                          />
                        </th>
                        <th className="pb-2 px-1.5">
                          <ColTextFilter
                            value={relMeetingFilters.comment}
                            onChange={(v) =>
                              setRelMeetingFilters({
                                ...relMeetingFilters,
                                comment: v,
                              })
                            }
                          />
                        </th>
                        <th className="pb-2 px-1.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectMeetings.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-xs text-slate-400"
                          >
                            По проекту #{projectData.num} записей встреч пока
                            нет.
                          </td>
                        </tr>
                      ) : (
                        projectMeetings
                          .filter(
                            (m: any) =>
                              matchDateFilter(m.date, relMeetingFilters.date) &&
                              (!relMeetingFilters.desc ||
                                (m.desc || '')
                                  .toLowerCase()
                                  .includes(
                                    relMeetingFilters.desc.toLowerCase()
                                  )) &&
                              (!relMeetingFilters.fix ||
                                (m.fix || '')
                                  .toLowerCase()
                                  .includes(
                                    relMeetingFilters.fix.toLowerCase()
                                  )) &&
                              matchStatusFilter(
                                m.status,
                                relMeetingFilters.status
                              ) &&
                              (!relMeetingFilters.comment ||
                                (m.comment || '')
                                  .toLowerCase()
                                  .includes(
                                    relMeetingFilters.comment.toLowerCase()
                                  ))
                          )
                          .map((m: any) => (
                            <tr
                              key={m.id}
                              onPaste={(e) =>
                                handlePasteImage(e, (img) =>
                                  updateMeetingRow(m.id, 'screenshot', img)
                                )
                              }
                              className="group hover:bg-slate-50/70 align-top"
                            >
                              <td className="p-2">
                                <DateInput
                                  value={m.date}
                                  onChange={(val) =>
                                    updateMeetingRow(m.id, 'date', val)
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={m.desc}
                                  onChange={(val) =>
                                    updateMeetingRow(m.id, 'desc', val)
                                  }
                                  placeholder="Суть вопроса..."
                                  className="text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={m.fix}
                                  onChange={(val) =>
                                    updateMeetingRow(m.id, 'fix', val)
                                  }
                                  placeholder="Что исправить..."
                                  className="text-xs"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <ImageCell
                                  src={m.screenshot}
                                  onChange={(img) =>
                                    updateMeetingRow(m.id, 'screenshot', img)
                                  }
                                  onPreview={onPreviewImage}
                                />
                              </td>
                              <td className="p-2">
                                <StatusPill
                                  value={m.status}
                                  options={[
                                    'в работе',
                                    'исправлено',
                                    'на паузе',
                                    'передано другому',
                                  ]}
                                  onChange={(val) =>
                                    updateMeetingRow(m.id, 'status', val)
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={m.comment}
                                  onChange={(val) =>
                                    updateMeetingRow(m.id, 'comment', val)
                                  }
                                  placeholder="Комментарий..."
                                  className="text-xs text-slate-600"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={() =>
                                    setMeetings(
                                      meetings.filter(
                                        (mtg: any) => mtg.id !== m.id
                                      )
                                    )
                                  }
                                  className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={14} />
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
                <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      Все быстрые задачи по проекту #{projectData.num} (
                      {projectQuickTasks.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Полный список оперативных задач по этому объекту со
                      сроками, статусами и комментариями
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setTasks([
                          {
                            id: Date.now(),
                            date: getTodayDMY(),
                            project: projectData.num,
                            desc: '',
                            estDate: '',
                            status: 'в работе',
                            comment: '',
                          },
                          ...tasks,
                        ])
                      }
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <Plus size={14} /> Добавить задачу
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateWithFilter(4, projectData.num)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg"
                    >
                      Открыть во вкладке «Быстрые задачи» →
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                        <th className="pt-2.5 pb-1.5 px-2 w-36">Создано</th>
                        <th className="pt-2.5 pb-1.5 px-2 min-w-[260px]">
                          Описание задачи
                        </th>
                        <th className="pt-2.5 pb-1.5 px-2 w-36">Дедлайн</th>
                        <th className="pt-2.5 pb-1.5 px-2 w-44">Статус</th>
                        <th className="pt-2.5 pb-1.5 px-2 min-w-[180px]">
                          Комментарий
                        </th>
                        <th className="pt-2.5 pb-1.5 px-2 w-10"></th>
                      </tr>
                      <tr className="bg-slate-50/40 border-b border-slate-200">
                        <th className="pb-2 px-1.5">
                          <ColTextFilter
                            value={relTaskFilters.date}
                            onChange={(v) =>
                              setRelTaskFilters({ ...relTaskFilters, date: v })
                            }
                            placeholder="ДД/ММ/ГГГГ"
                          />
                        </th>
                        <th className="pb-2 px-1.5">
                          <ColTextFilter
                            value={relTaskFilters.desc}
                            onChange={(v) =>
                              setRelTaskFilters({ ...relTaskFilters, desc: v })
                            }
                          />
                        </th>
                        <th className="pb-2 px-1.5">
                          <ColTextFilter
                            value={relTaskFilters.estDate}
                            onChange={(v) =>
                              setRelTaskFilters({
                                ...relTaskFilters,
                                estDate: v,
                              })
                            }
                            placeholder="ДД/ММ/ГГГГ"
                          />
                        </th>
                        <th className="pb-2 px-1.5">
                          <ColSelectFilter
                            value={relTaskFilters.status}
                            options={[
                              'в работе',
                              'выполнена',
                              'на паузе',
                              'передано',
                            ]}
                            onChange={(v) =>
                              setRelTaskFilters({
                                ...relTaskFilters,
                                status: v,
                              })
                            }
                          />
                        </th>
                        <th className="pb-2 px-1.5">
                          <ColTextFilter
                            value={relTaskFilters.comment}
                            onChange={(v) =>
                              setRelTaskFilters({
                                ...relTaskFilters,
                                comment: v,
                              })
                            }
                          />
                        </th>
                        <th className="pb-2 px-1.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectQuickTasks.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-xs text-slate-400"
                          >
                            По проекту #{projectData.num} быстрых задач пока
                            нет.
                          </td>
                        </tr>
                      ) : (
                        projectQuickTasks
                          .filter(
                            (t: any) =>
                              matchDateFilter(t.date, relTaskFilters.date) &&
                              (!relTaskFilters.desc ||
                                (t.desc || '')
                                  .toLowerCase()
                                  .includes(
                                    relTaskFilters.desc.toLowerCase()
                                  )) &&
                              matchDateFilter(
                                t.estDate,
                                relTaskFilters.estDate
                              ) &&
                              matchStatusFilter(
                                t.status,
                                relTaskFilters.status
                              ) &&
                              (!relTaskFilters.comment ||
                                (t.comment || '')
                                  .toLowerCase()
                                  .includes(
                                    relTaskFilters.comment.toLowerCase()
                                  ))
                          )
                          .map((t: any) => (
                            <tr
                              key={t.id}
                              className="group hover:bg-slate-50/70 align-top"
                            >
                              <td className="p-2">
                                <DateInput
                                  value={t.date}
                                  onChange={(val) =>
                                    updateQuickTaskRow(t.id, 'date', val)
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={t.desc}
                                  onChange={(val) =>
                                    updateQuickTaskRow(t.id, 'desc', val)
                                  }
                                  placeholder="Что нужно сделать..."
                                  className="text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <DateInput
                                  value={t.estDate}
                                  onChange={(val) =>
                                    updateQuickTaskRow(t.id, 'estDate', val)
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <StatusPill
                                  value={t.status}
                                  options={[
                                    'в работе',
                                    'выполнена',
                                    'на паузе',
                                    'передано',
                                  ]}
                                  onChange={(val) =>
                                    updateQuickTaskRow(t.id, 'status', val)
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <AutoTextarea
                                  value={t.comment}
                                  onChange={(val) =>
                                    updateQuickTaskRow(t.id, 'comment', val)
                                  }
                                  placeholder="Примечание..."
                                  className="text-xs text-slate-600"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={() =>
                                    setTasks(
                                      tasks.filter(
                                        (task: any) => task.id !== t.id
                                      )
                                    )
                                  }
                                  className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={14} />
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

function TabReports({ reports, setReports, projects, onSyncAllProjects }: any) {
  const [selectedWeek, setSelectedWeek] = useState(getCurrentISOWeek());
  const [filters, setFilters] = useState({
    week: '',
    projNum: '',
    stage: '',
    done: '',
    inProgress: '',
    blockers: '',
    dateTasks: '',
    dateTotal: '',
  });

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const resetFilters = () =>
    setFilters({
      week: '',
      projNum: '',
      stage: '',
      done: '',
      inProgress: '',
      blockers: '',
      dateTasks: '',
      dateTotal: '',
    });

  const filtered = reports.filter((r: any) => {
    return (
      (!filters.week ||
        (r.week || '').toLowerCase().includes(filters.week.toLowerCase())) &&
      (!filters.projNum ||
        (r.projNum || '')
          .toLowerCase()
          .includes(filters.projNum.toLowerCase())) &&
      (!filters.stage ||
        (r.stage || '').toLowerCase().includes(filters.stage.toLowerCase())) &&
      (!filters.done ||
        (r.done || '').toLowerCase().includes(filters.done.toLowerCase())) &&
      (!filters.inProgress ||
        (r.inProgress || '')
          .toLowerCase()
          .includes(filters.inProgress.toLowerCase())) &&
      (!filters.blockers ||
        (r.blockers || '')
          .toLowerCase()
          .includes(filters.blockers.toLowerCase())) &&
      matchDateFilter(r.dateTasks, filters.dateTasks) &&
      matchDateFilter(r.dateTotal, filters.dateTotal)
    );
  });

  const updateItem = (id: any, field: string, value: any) => {
    setReports(
      reports.map((r: any) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const refreshSingleRow = (row: any) => {
    const proj = projects.find(
      (p: any) => p.num === (row.projNum || '').trim()
    );
    if (!proj) {
      alert(
        `Проект с номером "${row.projNum}" не найден в разделе «Статус проекта».`
      );
      return;
    }
    const targetWeek = row.week || selectedWeek;
    const summary = buildProjectReportSummary(proj, targetWeek);
    setReports(
      reports.map((r: any) =>
        r.id === row.id
          ? {
              ...r,
              week: targetWeek,
              stage: summary.stage || r.stage,
              done: summary.done,
              inProgress: summary.inProgress,
              blockers: summary.blockers,
              dateTotal: summary.deadline || r.dateTotal,
            }
          : r
      )
    );
  };

  return (
    <div className="space-y-4 print-area">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm print-hidden">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Еженедельный отчет
          </h2>
          <p className="text-xs text-slate-500">
            1 строка = 1 проект. Все колонки доступны для ручного редактирования
            после автозаполнения
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200/80 px-2.5 py-1 rounded-lg">
            <input
              type="week"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="text-xs font-semibold text-indigo-900 bg-transparent focus:outline-none"
              title="Выберите отчетную неделю"
            />
            <button
              onClick={() => onSyncAllProjects(selectedWeek)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap"
              title="Создать или обновить по 1 строке на каждый проект за выбранную неделю"
            >
              <RefreshCw size={13} /> Сформировать по проектам
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <RotateCcw size={13} /> Сбросить
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
          >
            <Printer size={15} /> PDF
          </button>
          <button
            onClick={() => exportToCSV(reports, 'reports.csv')}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download size={15} /> Excel
          </button>
          <button
            onClick={() =>
              setReports([
                {
                  id: Date.now(),
                  week: selectedWeek,
                  projNum: '',
                  stage: '',
                  done: '',
                  inProgress: '',
                  blockers: '',
                  dateTasks: '',
                  dateTotal: '',
                },
                ...reports,
              ])
            }
            className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
            title="Добавить пустую строку вручную"
          >
            <Plus size={15} /> Пустая строка
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="pt-3 pb-1.5 px-2 w-10 text-center">№</th>
                <th className="pt-3 pb-1.5 px-2 w-36">Неделя</th>
                <th className="pt-3 pb-1.5 px-2 w-24">Проект</th>
                <th className="pt-3 pb-1.5 px-2 w-32">Стадия</th>
                <th className="pt-3 pb-1.5 px-2 min-w-[190px]">
                  Завершено (за неделю)
                </th>
                <th className="pt-3 pb-1.5 px-2 min-w-[210px]">
                  В работе / Передано
                </th>
                <th className="pt-3 pb-1.5 px-2 min-w-[180px]">Блокирует</th>
                <th className="pt-3 pb-1.5 px-2 w-36">Дата (задачи)</th>
                <th className="pt-3 pb-1.5 px-2 w-36">Дата (этап)</th>
                <th className="pt-3 pb-1.5 px-2 w-16 print-hidden"></th>
              </tr>
              <tr className="bg-slate-50/40 border-b border-slate-200 print-hidden">
                <th className="pb-2 px-1.5"></th>
                <th className="pb-2 px-1.5">
                  <ColTextFilter
                    value={filters.week}
                    onChange={(v) => setFilters({ ...filters, week: v })}
                    placeholder="2026-W..."
                  />
                </th>
                <th className="pb-2 px-1.5">
                  <ColTextFilter
                    value={filters.projNum}
                    onChange={(v) => setFilters({ ...filters, projNum: v })}
                    placeholder="№..."
                  />
                </th>
                <th className="pb-2 px-1.5">
                  <ColTextFilter
                    value={filters.stage}
                    onChange={(v) => setFilters({ ...filters, stage: v })}
                  />
                </th>
                <th className="pb-2 px-1.5">
                  <ColTextFilter
                    value={filters.done}
                    onChange={(v) => setFilters({ ...filters, done: v })}
                  />
                </th>
                <th className="pb-2 px-1.5">
                  <ColTextFilter
                    value={filters.inProgress}
                    onChange={(v) => setFilters({ ...filters, inProgress: v })}
                  />
                </th>
                <th className="pb-2 px-1.5">
                  <ColTextFilter
                    value={filters.blockers}
                    onChange={(v) => setFilters({ ...filters, blockers: v })}
                  />
                </th>
                <th className="pb-2 px-1.5">
                  <ColTextFilter
                    value={filters.dateTasks}
                    onChange={(v) => setFilters({ ...filters, dateTasks: v })}
                    placeholder="ДД/ММ/ГГГГ"
                  />
                </th>
                <th className="pb-2 px-1.5">
                  <ColTextFilter
                    value={filters.dateTotal}
                    onChange={(v) => setFilters({ ...filters, dateTotal: v })}
                    placeholder="ДД/ММ/ГГГГ"
                  />
                </th>
                <th className="pb-2 px-1.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Записей пока нет. Нажмите «Сформировать по проектам», чтобы
                    подтянуть данные из карточек проектов.
                  </td>
                </tr>
              ) : (
                filtered.map((r: any, idx: number) => (
                  <tr
                    key={r.id}
                    className="group hover:bg-slate-50/70 align-top"
                  >
                    <td className="p-2.5 text-center text-xs text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="p-2">
                      <input
                        type="week"
                        className="w-full px-1.5 py-1 text-xs bg-transparent hover:bg-slate-100 rounded focus:bg-white focus:outline-none"
                        value={r.week}
                        onChange={(e) =>
                          updateItem(r.id, 'week', e.target.value)
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        placeholder="№..."
                        className="w-full px-2 py-1 font-semibold text-indigo-600 bg-transparent hover:bg-slate-100 rounded focus:bg-white focus:outline-none"
                        value={r.projNum}
                        onChange={(e) =>
                          updateItem(r.id, 'projNum', e.target.value)
                        }
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={r.stage}
                        onChange={(val) => updateItem(r.id, 'stage', val)}
                        placeholder="Стадия..."
                        className="text-xs font-medium text-slate-700"
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={r.done}
                        onChange={(val) => updateItem(r.id, 'done', val)}
                        placeholder="Выполнено..."
                        className="text-xs text-slate-700"
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={r.inProgress}
                        onChange={(val) => updateItem(r.id, 'inProgress', val)}
                        placeholder="В работе..."
                        className="text-xs text-slate-700"
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={r.blockers}
                        onChange={(val) => updateItem(r.id, 'blockers', val)}
                        placeholder="Блокеры..."
                        className="text-xs text-rose-700 font-medium"
                      />
                    </td>
                    <td className="p-2">
                      <DateInput
                        value={r.dateTasks}
                        onChange={(val) => updateItem(r.id, 'dateTasks', val)}
                      />
                    </td>
                    <td className="p-2">
                      <DateInput
                        value={r.dateTotal}
                        onChange={(val) => updateItem(r.id, 'dateTotal', val)}
                      />
                    </td>
                    <td className="p-2 text-center print-hidden">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => refreshSingleRow(r)}
                          className="text-slate-400 hover:text-indigo-600 p-1 rounded"
                          title="Обновить строку из статуса проекта"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          onClick={() =>
                            setReports(
                              reports.filter((rep: any) => rep.id !== r.id)
                            )
                          }
                          className="text-slate-400 hover:text-rose-500 p-1 rounded"
                          title="Удалить строку"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
    setFilters({
      date: '',
      project: '',
      desc: '',
      estDate: '',
      status: '',
      comment: '',
    });

  const filtered = tasks.filter((t: any) => {
    return (
      matchDateFilter(t.date, filters.date) &&
      (!filters.project ||
        (t.project || '')
          .toLowerCase()
          .includes(filters.project.toLowerCase())) &&
      (!filters.desc ||
        (t.desc || '').toLowerCase().includes(filters.desc.toLowerCase())) &&
      matchDateFilter(t.estDate, filters.estDate) &&
      matchStatusFilter(t.status, filters.status) &&
      (!filters.comment ||
        (t.comment || '').toLowerCase().includes(filters.comment.toLowerCase()))
    );
  });

  const updateItem = (id: any, field: string, value: any) => {
    setTasks(
      tasks.map((t: any) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Оперативные и быстрые задачи
          </h2>
          <p className="text-xs text-slate-500">
            Фильтрация по проекту, срокам (ДД/ММ/ГГГГ), статусам и комментариям
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <RotateCcw size={13} /> Сбросить фильтры
            </button>
          )}
          <button
            onClick={() =>
              setTasks([
                {
                  id: Date.now(),
                  date: getTodayDMY(),
                  project: filters.project || '',
                  desc: '',
                  estDate: '',
                  status: 'в работе',
                  comment: '',
                },
                ...tasks,
              ])
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus size={16} /> Новая задача
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="pt-3 pb-1.5 px-3 w-36">Создано</th>
                <th className="pt-3 pb-1.5 px-3 w-28">Проект</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[260px]">
                  Описание задачи
                </th>
                <th className="pt-3 pb-1.5 px-3 w-36">Дедлайн</th>
                <th className="pt-3 pb-1.5 px-3 w-44">Статус</th>
                <th className="pt-3 pb-1.5 px-3 min-w-[180px]">Комментарий</th>
                <th className="pt-3 pb-1.5 px-2 w-10"></th>
              </tr>
              <tr className="bg-slate-50/40 border-b border-slate-200">
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
                    options={['в работе', 'выполнена', 'на паузе', 'передано']}
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
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Задач по заданным фильтрам не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map((t: any) => (
                  <tr
                    key={t.id}
                    className="group hover:bg-slate-50/70 align-top"
                  >
                    <td className="p-2">
                      <DateInput
                        value={t.date}
                        onChange={(val) => updateItem(t.id, 'date', val)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        placeholder="№..."
                        className="w-full px-2 py-1 font-semibold text-indigo-600 bg-transparent hover:bg-slate-100/70 rounded focus:bg-white focus:outline-none"
                        value={t.project}
                        onChange={(e) =>
                          updateItem(t.id, 'project', e.target.value)
                        }
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={t.desc}
                        onChange={(val) => updateItem(t.id, 'desc', val)}
                        placeholder="Что нужно сделать..."
                      />
                    </td>
                    <td className="p-2">
                      <DateInput
                        value={t.estDate}
                        onChange={(val) => updateItem(t.id, 'estDate', val)}
                      />
                    </td>
                    <td className="p-2">
                      <StatusPill
                        value={t.status}
                        options={[
                          'в работе',
                          'выполнена',
                          'на паузе',
                          'передано',
                        ]}
                        onChange={(val) => updateItem(t.id, 'status', val)}
                      />
                    </td>
                    <td className="p-2">
                      <AutoTextarea
                        value={t.comment}
                        onChange={(val) => updateItem(t.id, 'comment', val)}
                        placeholder="Примечание..."
                        className="text-xs text-slate-600"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() =>
                          setTasks(
                            tasks.filter((task: any) => task.id !== t.id)
                          )
                        }
                        className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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

// === 4. ГЛАВНЫЙ КОМПОНЕНТ ===

export default function App() {
  const [activeTab, setActiveTab] = useState(0);

  const [projects, setProjects] = useLocalStorage('pm_projects', []);
  const [activeProjectId, setActiveProjectId] = useLocalStorage(
    'pm_active_project',
    null
  );
  const [meetings, setMeetings] = useLocalStorage('pm_meetings', []);
  const [tasks, setTasks] = useLocalStorage('pm_tasks', []);
  const [reports, setReports] = useLocalStorage('pm_reports', []);
  const [calendarEvents, setCalendarEvents] = useLocalStorage(
    'pm_calendar_events',
    []
  );

  const [externalProjectFilter, setExternalProjectFilter] =
    useState<string>('');
  const [externalProjectSubTab, setExternalProjectSubTab] = useState<
    'tasks' | 'remarks' | 'docs' | 'related' | null
  >(null);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenProjectFromOverview = (
    projectId: string,
    targetSubTab: 'tasks' | 'remarks' | 'docs' | 'related' = 'tasks'
  ) => {
    setActiveProjectId(projectId);
    setExternalProjectSubTab(targetSubTab);
    setActiveTab(2);
  };

  const handleNavigateWithProjectFilter = (
    tabId: number,
    projectNum: string
  ) => {
    setExternalProjectFilter(projectNum);
    setActiveTab(tabId);
  };

  const syncSingleProjectToReport = (
    project: any,
    targetWeek = getCurrentISOWeek()
  ) => {
    const summary = buildProjectReportSummary(project, targetWeek);
    setReports((prev: any[]) => {
      const existingIdx = prev.findIndex(
        (r) =>
          r.week === targetWeek &&
          (r.projNum || '').trim() === (project.num || '').trim()
      );
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          stage: summary.stage || updated[existingIdx].stage,
          done: summary.done,
          inProgress: summary.inProgress,
          blockers: summary.blockers,
          dateTotal: summary.deadline || updated[existingIdx].dateTotal,
        };
        return updated;
      }
      return [
        {
          id: Date.now() + Math.random(),
          week: targetWeek,
          projNum: project.num,
          stage: summary.stage,
          done: summary.done,
          inProgress: summary.inProgress,
          blockers: summary.blockers,
          dateTasks: '',
          dateTotal: summary.deadline,
        },
        ...prev,
      ];
    });
    setActiveTab(3);
  };

  const syncAllProjectsToReport = (targetWeek: string) => {
    if (!projects.length) {
      alert(
        'Сначала создайте хотя бы один проект во вкладке «Статус проекта».'
      );
      return;
    }
    setReports((prev: any[]) => {
      const updated = [...prev];
      projects.forEach((proj: any, idx: number) => {
        const summary = buildProjectReportSummary(proj, targetWeek);
        const existingIdx = updated.findIndex(
          (r) =>
            r.week === targetWeek &&
            (r.projNum || '').trim() === (proj.num || '').trim()
        );
        if (existingIdx !== -1) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            stage: summary.stage || updated[existingIdx].stage,
            done: summary.done,
            inProgress: summary.inProgress,
            blockers: summary.blockers,
            dateTotal: summary.deadline || updated[existingIdx].dateTotal,
          };
        } else {
          updated.unshift({
            id: Date.now() + idx,
            week: targetWeek,
            projNum: proj.num,
            stage: summary.stage,
            done: summary.done,
            inProgress: summary.inProgress,
            blockers: summary.blockers,
            dateTasks: '',
            dateTotal: summary.deadline,
          });
        }
      });
      return updated;
    });
  };

  const exportFullDatabase = () => {
    const data = {
      pm_projects: localStorage.getItem('pm_projects'),
      pm_active_project: localStorage.getItem('pm_active_project'),
      pm_meetings: localStorage.getItem('pm_meetings'),
      pm_tasks: localStorage.getItem('pm_tasks'),
      pm_reports: localStorage.getItem('pm_reports'),
      pm_calendar_events: localStorage.getItem('pm_calendar_events'),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SUP_Backup_${getTodayDMY().replace(/\//g, '-')}.json`;
    link.click();
  };

  const importFullDatabase = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: any) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.pm_projects)
          localStorage.setItem('pm_projects', data.pm_projects);
        if (data.pm_active_project)
          localStorage.setItem('pm_active_project', data.pm_active_project);
        if (data.pm_meetings)
          localStorage.setItem('pm_meetings', data.pm_meetings);
        if (data.pm_tasks) localStorage.setItem('pm_tasks', data.pm_tasks);
        if (data.pm_reports)
          localStorage.setItem('pm_reports', data.pm_reports);
        if (data.pm_calendar_events)
          localStorage.setItem('pm_calendar_events', data.pm_calendar_events);
        window.location.reload();
      } catch {
        alert('Неверный формат файла бэкапа.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const navItems = [
    { id: 0, name: 'Сводка и Календарь', icon: CalendarDays },
    { id: 2, name: 'Статус проекта', icon: FolderKanban },
    { id: 1, name: 'Встречи', icon: Users },
    { id: 4, name: 'Быстрые задачи', icon: CheckSquare },
    { id: 3, name: 'Еженедельный отчет', icon: FileSpreadsheet },
  ];

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-800 font-sans antialiased">
      <style>{`
        @media print {
          .print-hidden { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 print-hidden">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                S
              </div>
              <div>
                <span className="font-bold text-slate-900 tracking-tight text-sm block leading-none">
                  SUP Engineering
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Трекер проектов
                </span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      size={16}
                      className={active ? 'text-indigo-600' : 'text-slate-400'}
                    />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportFullDatabase}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg transition-colors"
              title="Скачать резервную копию базы на компьютер"
            >
              <Save size={14} className="text-slate-500" />
              <span className="hidden sm:inline">Сохранить базу</span>
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={importFullDatabase}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg transition-colors"
              title="Загрузить ранее сохраненный JSON-файл"
            >
              <Upload size={14} className="text-slate-500" />
              <span className="hidden sm:inline">Загрузить</span>
            </button>
          </div>
        </div>

        <div className="flex md:hidden overflow-x-auto px-4 py-2 gap-1 border-t border-slate-100 bg-slate-50">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 bg-white border border-slate-200'
                }`}
              >
                <Icon size={14} />
                {tab.name}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        {activeTab === 0 && (
          <TabOverviewCalendar
            projects={projects}
            meetings={meetings}
            tasks={tasks}
            calendarEvents={calendarEvents}
            setCalendarEvents={setCalendarEvents}
            onOpenProject={handleOpenProjectFromOverview}
            onNavigateWithFilter={handleNavigateWithProjectFilter}
          />
        )}
        {activeTab === 1 && (
          <TabMeetings
            meetings={meetings}
            setMeetings={setMeetings}
            onPreviewImage={setPreviewImage}
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
            onNavigateWithFilter={handleNavigateWithProjectFilter}
            onPreviewImage={setPreviewImage}
            onSyncSingleProjectToReport={syncSingleProjectToReport}
            externalSubTab={externalProjectSubTab}
            onClearExternalSubTab={() => setExternalProjectSubTab(null)}
          />
        )}
        {activeTab === 3 && (
          <TabReports
            reports={reports}
            setReports={setReports}
            projects={projects}
            onSyncAllProjects={syncAllProjectsToReport}
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

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Просмотр"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border border-white/20"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-1.5 shadow-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
