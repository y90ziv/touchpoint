'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Network,
  Calendar as CalendarIcon,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Plus,
  Clock,
  Phone,
  MessageSquare,
  UserCheck,
  RefreshCw,
  GitMerge,
  Trash2,
  Send,
  Download,
  Link2,
  BookOpen,
  CheckCircle2,
  Cake,
  Search,
  Palmtree,
  PlayCircle,
  X,
  Menu,
  Filter,
  Pencil,
  SlidersHorizontal,
  Eye,
  AlertTriangle,
  GripVertical,
  RotateCcw,
  Mail,
  Briefcase,
  Sparkles,
  Heart,
  Share2,
  ExternalLink,
  FileText,
  Tag,
  LogOut,
  Lock,
  User,
  ShieldCheck,
  Camera,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';
import { TimezoneSelect } from '@/components/TimezoneSelect';
import { guessCountryDialCode } from '@/lib/geo-data';
import {
  applySmartSpreading,
  calculateRelationshipHealthScore,
} from '@/lib/cadence';

interface GroupItem {
  id: number;
  name: string;
  color: string;
  intervalDays: number;
  pausedUntil?: string | null;
  memberCount?: number;
}

interface TopicItem {
  id: number;
  contactId: number;
  content: string;
  isCompleted: boolean;
}

interface ImportantDateItem {
  id: number;
  contactId: number;
  label: string;
  date: string;
  remindDaysBefore: number;
}

interface ContactItem {
  id: number;
  source: 'google' | 'local' | 'vcard';
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  jobTitle: string | null;
  pets: string[];
  birthday: string | null;
  significantDate?: string | null;
  significantDateLabel?: string | null;
  keepInTouch: boolean;
  customIntervalDays: number | null;
  lastContactedAt: string | null;
  notes: string | null;
  groups: GroupItem[];
  topics: TopicItem[];
  importantDates: ImportantDateItem[];
  customFields: Record<number, string>;
  lastTouchpoint?: {
    method: string;
    note: string | null;
    contactedAt: string;
  } | null;
  cadence: {
    contactId: number;
    effectiveIntervalDays: number;
    daysSinceContact: number;
    daysUntilDue: number;
    nextDueDate: string;
    progressPercent: number;
    status: 'overdue' | 'due_today' | 'due_soon' | 'on_track' | 'paused' | 'untracked';
  };
}

interface DuplicatePairItem {
  contactA: ContactItem;
  contactB: ContactItem;
  reasons: string[];
}

interface GraphData {
  nodes: Array<{
    id: number;
    fullName: string;
    keepInTouch: boolean;
    status: ContactItem['cadence']['status'];
    progressPercent: number;
  }>;
  edges: Array<{
    id: number;
    source: number;
    target: number;
    type: string;
  }>;
}

const INTERVAL_PRESETS = [
  { label: 'Inherit Group', value: null },
  { label: 'Every Week (7d)', value: 7 },
  { label: 'Every 2 Weeks (14d)', value: 14 },
  { label: 'Monthly (30d)', value: 30 },
  { label: 'Every 2 Months (60d)', value: 60 },
  { label: 'Quarterly (90d)', value: 90 },
] as const;

const CRON_PRESETS = [
  { label: 'Manual Only (Off)', expr: 'manual' },
  { label: 'Daily at 03:00', expr: '0 3 * * *' },
  { label: 'Weekly (Sun 04:00)', expr: '0 4 * * 0' },
  { label: 'Monthly (1st at 04:00)', expr: '0 4 1 * *' },
] as const;

const DEFAULT_COLUMN_ORDER = [
  'firstName',
  'lastName',
  'name',
  'phone',
  'email',
  'birthday',
  'significantDates',
  'source',
  'company',
  'notes',
  'groups',
  'lastContacted',
  'keepInTouch',
  'actions',
];

const ALL_COLUMN_METADATA: { id: string; label: string; title: string }[] = [
  { id: 'firstName', label: '👤 First Name', title: 'First Name' },
  { id: 'lastName', label: '👤 Last Name', title: 'Last Name' },
  { id: 'name', label: '📇 Full Name (fn + ln)', title: 'Full Name' },
  { id: 'phone', label: '📞 Phone Number', title: 'Phone' },
  { id: 'email', label: '✉️ Email', title: 'Email' },
  { id: 'birthday', label: '🎂 Birthday', title: 'Birthday' },
  { id: 'significantDates', label: '✨ Significant Dates / Events', title: 'Significant Dates' },
  { id: 'source', label: '🏷️ Source', title: 'Source' },
  { id: 'company', label: '🏢 Company & Job Title', title: 'Company & Notes' },
  { id: 'notes', label: '📝 Notes', title: 'Notes' },
  { id: 'groups', label: '👥 Groups & Interval', title: 'Groups & Interval' },
  { id: 'lastContacted', label: '🕒 Last Contacted', title: 'Last Contacted' },
  { id: 'keepInTouch', label: '⚡ Keep in Touch Toggle', title: 'Keep in Touch' },
  { id: 'actions', label: '✏️ Actions (Edit)', title: 'Actions' },
];

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  firstName: 130,
  lastName: 130,
  name: 210,
  phone: 140,
  email: 180,
  birthday: 130,
  significantDates: 190,
  source: 100,
  company: 190,
  notes: 200,
  groups: 190,
  lastContacted: 130,
  keepInTouch: 120,
  actions: 100,
};

const PRESET_GROUP_COLORS = [
  '#e85d3a', // Studio Orange
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
];

function normalizeDateInput(val: string): string | null {
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return trimmed;
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
    const norm = trimmed.replace(/\//g, '-');
    const d = new Date(norm);
    if (!isNaN(d.getTime())) return norm;
  }
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      const norm = `${y}-${m}-${d}`;
      if (!isNaN(new Date(norm).getTime())) return norm;
    } else if (parts[2].length === 4) {
      const y = parts[2];
      const p1 = Number(parts[0]);
      const p2 = Number(parts[1]);
      if (p1 > 12 && p2 <= 12) {
        const norm = `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        if (!isNaN(new Date(norm).getTime())) return norm;
      } else {
        const norm = `${y}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
        if (!isNaN(new Date(norm).getTime())) return norm;
      }
    }
  }
  return null;
}

function cleanPhoneForDial(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

function parseLocalDate(val: string | null | undefined): Date | null {
  if (!val || !val.trim()) return null;
  const norm = normalizeDateInput(val) || val.trim();
  const parts = norm.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const dt = new Date(y, m, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
  }
  const dt = new Date(val);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatLocalDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateByPattern(
  val: string | Date | null | undefined,
  pattern: string = 'YYYY-MM-DD'
): string {
  if (!val) return '';
  let y = 0,
    m = 0,
    d = 0;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    y = val.getFullYear();
    m = val.getMonth() + 1;
    d = val.getDate();
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.slice(0, 10).split('-');
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    } else {
      const parsed = parseLocalDate(trimmed);
      if (!parsed) return trimmed;
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
    }
  }

  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) {
    return typeof val === 'string' ? val : '';
  }

  const yyyy = String(y);
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');

  switch (pattern) {
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'DD-MM-YYYY':
      return `${dd}-${mm}-${yyyy}`;
    case 'YYYY/MM/DD':
      return `${yyyy}/${mm}/${dd}`;
    case 'DD.MM.YYYY':
      return `${dd}.${mm}.${yyyy}`;
    case 'YYYY-MM-DD':
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}

function BirthdayDatePicker({
  value,
  onChange,
  placeholder,
  className = '',
  displayFormat = 'YYYY-MM-DD',
}: {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  displayFormat?: string;
}) {
  const selectedDate = useMemo(() => parseLocalDate(value), [value]);

  const datePickerFormats = useMemo(() => {
    const formatMap: Record<string, string> = {
      'YYYY-MM-DD': 'yyyy-MM-dd',
      'DD/MM/YYYY': 'dd/MM/yyyy',
      'MM/DD/YYYY': 'MM/dd/yyyy',
      'DD-MM-YYYY': 'dd-MM-yyyy',
      'YYYY/MM/DD': 'yyyy/MM/dd',
      'DD.MM.YYYY': 'dd.MM.yyyy',
    };
    const primary = formatMap[displayFormat] || 'yyyy-MM-dd';
    const all = [
      'yyyy-MM-dd',
      'dd/MM/yyyy',
      'MM/dd/yyyy',
      'dd-MM-yyyy',
      'yyyy/MM/dd',
      'dd.MM.yyyy',
    ];
    return [primary, ...all.filter((f) => f !== primary)];
  }, [displayFormat]);

  const effectivePlaceholder = placeholder || `${displayFormat} (type or pick)`;

  return (
    <div className={`relative w-full ${className}`}>
      <DatePicker
        selected={selectedDate}
        onChange={(date: Date | null) => {
          onChange(formatLocalDate(date));
        }}
        onChangeRaw={(e) => {
          if (e && e.target) {
            const raw = (e.target as HTMLInputElement).value;
            const norm = normalizeDateInput(raw);
            if (norm) {
              onChange(norm);
            } else if (!raw.trim()) {
              onChange('');
            } else {
              onChange(raw);
            }
          }
        }}
        onBlur={(e) => {
          if (e && e.target) {
            const raw = (e.target as HTMLInputElement).value;
            const norm = normalizeDateInput(raw);
            onChange(norm || (raw.trim() ? raw : ''));
          }
        }}
        dateFormat={datePickerFormats}
        placeholderText={effectivePlaceholder}
        showYearDropdown
        showMonthDropdown
        scrollableYearDropdown
        yearDropdownItemNumber={100}
        dropdownMode="select"
        isClearable
        autoComplete="off"
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono placeholder:font-sans"
        wrapperClassName="w-full"
      />
    </div>
  );
}

export default function TouchpointApp() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; username: string; totpEnabled?: boolean } | null>(null);
  const [authDisabled, setAuthDisabled] = useState<boolean>(false);
  const [allowSignups, setAllowSignups] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '', rememberMe: false });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorTempToken, setTwoFactorTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [serendipitySuggestion, setSerendipitySuggestion] = useState<any>(null);
  const [serendipityOffset, setSerendipityOffset] = useState(0);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [show2faSetupModal, setShow2faSetupModal] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; otpauthUrl: string; qrDataUrl: string } | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[] | null>(null);
  const [show2faDisableModal, setShow2faDisableModal] = useState(false);
  const [disable2faPassword, setDisable2faPassword] = useState('');
  const [disable2faCode, setDisable2faCode] = useState('');
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'contacts' | 'groups' | 'map' | 'calendar' | 'settings' | 'help'
  >('dashboard');

  const [themePreset, setThemePreset] = useState<'sbb' | 'leadflow' | 'studio' | 'nordic' | 'midnight' | 'kyoto'>(
    'sbb'
  );
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('light');

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicatePairItem[]>([]);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [settingsState, setSettingsState] = useState<Record<string, any>>({
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    defaultCountryCode: '+1',
    dailyDigestTime: '09:00',
    firstDayOfWeek: 0,
    maxDailyDue: 3,
    birthdayDaysAdvance: 7,
    googleSyncInterval: 'manual',
    logLevel: 'info',
    icalSecretToken: '',
  });

  // UI Selection & Modals
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [activeContactDrawer, setActiveContactDrawer] = useState<ContactItem | null>(null);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [currentDuplicateIndex, setCurrentDuplicateIndex] = useState(0);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [openHelpSection, setOpenHelpSection] = useState<number | null>(null);

  // Column Ordering, Visibility & Custom Widths for Contacts Directory
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'firstName',
    'lastName',
    'name',
    'phone',
    'email',
    'birthday',
    'source',
    'company',
    'groups',
    'keepInTouch',
    'actions',
  ]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [resizingCol, setResizingCol] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [showColumnsPopover, setShowColumnsPopover] = useState(false);

  // Pagination for Contacts Directory
  const [contactsPageSize, setContactsPageSize] = useState<number>(20);
  const [contactsCurrentPage, setContactsCurrentPage] = useState<number>(1);

  // Full Contact Editing Modal & Inline Group Creation
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [showInlineNewGroup, setShowInlineNewGroup] = useState(false);
  const [inlineGroupName, setInlineGroupName] = useState('');
  const [inlineGroupInterval, setInlineGroupInterval] = useState(30);
  const [inlineGroupLoading, setInlineGroupLoading] = useState(false);
  const [editContactForm, setEditContactForm] = useState({
    firstName: '',
    lastName: '',
    fullName: '',
    phone: '',
    email: '',
    company: '',
    jobTitle: '',
    birthday: '',
    significantDate: '',
    significantDateLabel: 'Anniversary',
    importantDates: [] as Array<{ id?: number; label: string; date: string }>,
    notes: '',
    keepInTouch: true,
    intervalMode: 'inherit' as 'inherit' | 'custom',
    customIntervalDays: 30,
    groupIds: [] as number[],
  });

  // Customizable Dashboard Widgets
  const [dashboardWidgets, setDashboardWidgets] = useState<Record<string, boolean>>({
    healthStrip: true,
    overdueDue: true,
    birthdays: true,
    upcomingCalls: true,
    recentTalked: true,
    scheduledLater: true,
  });
  const [showDashboardCustomizer, setShowDashboardCustomizer] = useState(false);

  // Settings Accordion (Single-Expand, similar to Help)
  const [openSettingsSection, setOpenSettingsSection] = useState<number | null>(1);

  // Danger Zone / Delete Everything State
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Quick Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilterTab, setSearchFilterTab] = useState<'all' | 'due' | 'birthdays' | 'tracked'>('all');
  const [searchFilterGroup, setSearchFilterGroup] = useState<number | null>(null);
  const [showQuickSearchModal, setShowQuickSearchModal] = useState(false);

  // Global Vacation / Pause Mode State
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseCustomDate, setPauseCustomDate] = useState('');

  // Mobile Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Setup Wizard Form
  const [setupForm, setSetupForm] = useState({
    username: '',
    email: '',
    password: '',
    timezone: 'UTC',
    defaultCountryCode: '+1',
  });

  // New Contact Form (First Name + Last Name, Optional Company, Notes, Interactive Cadence Selector)
  const [newContactForm, setNewContactForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    company: '',
    jobTitle: '',
    notes: '',
    birthday: '',
    significantDate: '',
    significantDateLabel: 'Anniversary',
    significantDates: [{ label: 'Anniversary', date: '' }] as Array<{ label: string; date: string }>,
    keepInTouch: true,
    intervalMode: 'preset' as 'preset' | 'custom',
    selectedPresetDays: null as number | null,
    customDaysValue: 21,
    groupIds: [] as number[],
  });
  const [addMoreContact, setAddMoreContact] = useState(false);

  // Drawer Touchpoint History & Milestones
  const [drawerTouchpoints, setDrawerTouchpoints] = useState<Array<{
    id: number;
    contactedAt: string;
    method: string;
    note: string | null;
  }>>([]);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [showAddMilestone, setShowAddMilestone] = useState(false);

  // New Group Form
  const [newGroupForm, setNewGroupForm] = useState({
    name: '',
    intervalDays: 0,
    color: '#e85d3a',
  });

  // Selected Group Details & Management Modal
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<GroupItem | null>(null);
  const [editGroupForm, setEditGroupForm] = useState<{
    id: number;
    name: string;
    color: string;
    intervalDays: number;
  }>({
    id: 0,
    name: '',
    color: '#e85d3a',
    intervalDays: 0,
  });
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [addContactIdToGroup, setAddContactIdToGroup] = useState<number | ''>('');

  // New Relationship Form
  const [newRelForm, setNewRelForm] = useState({
    contactAId: '',
    contactBId: '',
    type: 'spouse',
  });
  const [personASearch, setPersonASearch] = useState('');
  const [personBSearch, setPersonBSearch] = useState('');

  // Touchpoint inline editing inside Drawer
  const [editingTouchpointId, setEditingTouchpointId] = useState<number | null>(null);
  const [editTpMethod, setEditTpMethod] = useState<string>('call');
  const [editTpNote, setEditTpNote] = useState<string>('');
  const [editTpDate, setEditTpDate] = useState<string>('');

  const notify = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 4000);
  };

  const handleResumeCadence = async () => {
    setSettingsState((prev) => ({ ...prev, globalPausedUntil: null }));
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ globalPausedUntil: null }),
    });
    await loadAllData();
    notify('Cadence timers resumed. Vacation mode cleared.');
  };

  const handleSetGlobalPause = async (daysOrIsoDate: number | string) => {
    let targetIso: string;
    if (typeof daysOrIsoDate === 'number') {
      const d = new Date(Date.now() + daysOrIsoDate * 86400000);
      targetIso = d.toISOString();
    } else {
      targetIso = new Date(daysOrIsoDate + 'T23:59:59').toISOString();
    }
    setSettingsState((prev) => ({ ...prev, globalPausedUntil: targetIso }));
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ globalPausedUntil: targetIso }),
    });
    setShowPauseModal(false);
    await loadAllData();
    const formatted = new Date(targetIso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    notify(`Cadence paused until ${formatted}. Vacation mode active.`);
  };

  const applyThemeAttributes = useCallback((preset: string, mode: string) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', preset);
      document.documentElement.setAttribute('data-mode', mode);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      setSetupComplete(meData.setupComplete);
      setAuthDisabled(Boolean(meData.authDisabled));
      setAllowSignups(Boolean(meData.allowSignups));

      if (meData.authDisabled || meData.user) {
        setCurrentUser(meData.user || { id: 1, email: 'admin@localhost', username: 'admin' });
      } else {
        setCurrentUser(null);
        if (!meData.setupComplete) {
          setAuthMode('signup');
        } else {
          setAuthMode('login');
        }
        return;
      }

      const [cRes, gRes, dRes, rRes, sRes] = await Promise.all([
        fetch('/api/contacts'),
        fetch('/api/groups'),
        fetch('/api/contacts?mode=duplicates'),
        fetch('/api/relationships'),
        fetch('/api/settings'),
      ]);

      const [cData, gData, dData, rData, sData] = await Promise.all([
        cRes.json(),
        gRes.json(),
        dRes.json(),
        rRes.json(),
        sRes.json(),
      ]);

      if (cData.contacts) {
        setContacts(cData.contacts);
        setActiveContactDrawer((prev) => {
          if (!prev) return null;
          return cData.contacts.find((c: ContactItem) => c.id === prev.id) || prev;
        });
      }
      if (gData.groups) {
        setGroups(gData.groups);
        setSelectedGroupDetails((prev) => {
          if (!prev) return null;
          return gData.groups.find((g: GroupItem) => g.id === prev.id) || null;
        });
      }
      if (dData.duplicates) setDuplicates(dData.duplicates);
      if (rData.nodes) setGraph(rData);
      if (sData.settings) {
        setSettingsState(sData.settings);
        let preset = (sData.settings.themePreset || 'sbb') as typeof themePreset;
        let mode: 'dark' | 'light' = sData.settings.themeMode === 'dark' ? 'dark' : 'light';
        if (
          typeof window !== 'undefined' &&
          !localStorage.getItem('tp_sbb_dispatch_migrated_v1')
        ) {
          preset = 'sbb';
          mode = 'light';
          localStorage.setItem('tp_sbb_dispatch_migrated_v1', '1');
          fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ themePreset: 'sbb', themeMode: 'light' }),
          }).catch(() => {});
        }
        setThemePreset(preset);
        setThemeMode(mode);
        applyThemeAttributes(preset, mode);
      }

      fetch('/api/serendipity')
        .then((r) => r.json())
        .then((data) => setSerendipitySuggestion(data.suggestion))
        .catch(() => {});

      fetch('/api/backup/snapshots')
        .then((r) => r.json())
        .then((data) => setSnapshots(data.snapshots || []))
        .catch(() => {});
    } catch (e) {
      console.error('Failed to load Touchpoint state:', e);
    }
  }, [applyThemeAttributes]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (!activeContactDrawer?.id) {
      setDrawerTouchpoints([]);
      return;
    }
    let isCancelled = false;
    fetch(`/api/touchpoints?contactId=${activeContactDrawer.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.touchpoints) {
          setDrawerTouchpoints(data.touchpoints);
        }
      })
      .catch((err) => console.error('Failed to load contact touchpoints:', err));
    return () => {
      isCancelled = true;
    };
  }, [activeContactDrawer?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowQuickSearchModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (activeContactDrawer) {
          setActiveContactDrawer(null);
          return;
        }
        if (selectedGroupDetails) {
          setSelectedGroupDetails(null);
          return;
        }
        setShowQuickSearchModal(false);
        setShowPauseModal(false);
        setShowColumnsPopover(false);
        setShowDashboardCustomizer(false);
        setShowNewContactModal(false);
        setShowMergeModal(false);
        setEditingContact(null);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-detect browser timezone and matching country dial code for First-Run Setup / Signup
  useEffect(() => {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedTz) {
          const detectedCountry = guessCountryDialCode(detectedTz);
          setSetupForm((prev) => {
            if (prev.timezone === 'UTC' || !prev.timezone) {
              return {
                ...prev,
                timezone: detectedTz,
                defaultCountryCode: detectedCountry || prev.defaultCountryCode,
              };
            }
            return prev;
          });
        }
      }
    } catch {
      // Ignore in unsupported environments
    }
  }, []);

  useEffect(() => {
    try {
      const savedCols = localStorage.getItem('touchpoint_columns');
      if (savedCols) {
        const parsed = JSON.parse(savedCols);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.includes('firstName') && !parsed.includes('lastName')) {
            parsed.unshift('firstName', 'lastName');
          }
          setVisibleColumns(parsed);
        }
      }
      const savedOrder = localStorage.getItem('touchpoint_column_order');
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((id) => DEFAULT_COLUMN_ORDER.includes(id));
          const missing = DEFAULT_COLUMN_ORDER.filter((id) => !valid.includes(id));
          setColumnOrder([...valid, ...missing]);
        }
      }
      const savedWidths = localStorage.getItem('touchpoint_column_widths');
      if (savedWidths) {
        const parsed = JSON.parse(savedWidths);
        if (typeof parsed === 'object' && parsed !== null) {
          setColumnWidths((prev) => ({ ...prev, ...parsed }));
        }
      }
      const savedWidgets = localStorage.getItem('touchpoint_dashboard_widgets');
      if (savedWidgets) {
        const parsed = JSON.parse(savedWidgets);
        if (typeof parsed === 'object' && parsed !== null) {
          setDashboardWidgets((prev) => ({ ...prev, ...parsed }));
        }
      }
      const savedPageSize = localStorage.getItem('touchpoint_contacts_page_size');
      if (savedPageSize) {
        const parsed = Number(savedPageSize);
        if ([20, 50, 100].includes(parsed)) {
          setContactsPageSize(parsed);
        }
      }
    } catch {}
  }, []);

  // Global Mouse Listener for Column Resizing
  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingCol.startX;
      const newWidth = Math.max(60, Math.round(resizingCol.startWidth + deltaX));
      setColumnWidths((prev) => ({
        ...prev,
        [resizingCol.id]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setColumnWidths((latest) => {
        try {
          localStorage.setItem('touchpoint_column_widths', JSON.stringify(latest));
        } catch {}
        return latest;
      });
      setResizingCol(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingCol]);

  const startColumnResize = (colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[colId] || DEFAULT_COLUMN_WIDTHS[colId] || 140;
    setResizingCol({
      id: colId,
      startX: e.clientX,
      startWidth,
    });
  };

  const resetSingleColumnWidth = (colId: string) => {
    setColumnWidths((prev) => {
      const next = { ...prev, [colId]: DEFAULT_COLUMN_WIDTHS[colId] || 140 };
      try {
        localStorage.setItem('touchpoint_column_widths', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleColumn = (colId: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(colId) ? prev.filter((c) => c !== colId) : [...prev, colId];
      try {
        localStorage.setItem('touchpoint_columns', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const moveColumn = (colId: string, direction: 'left' | 'right' | 'up' | 'down') => {
    setColumnOrder((prev) => {
      const currentIndex = prev.indexOf(colId);
      if (currentIndex === -1) return prev;
      const targetIndex =
        direction === 'left' || direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, removed);
      try {
        localStorage.setItem('touchpoint_column_order', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const moveColumnToTop = (colId: string) => {
    setColumnOrder((prev) => {
      const currentIndex = prev.indexOf(colId);
      if (currentIndex <= 0) return prev;
      const next = [...prev];
      const [removed] = next.splice(currentIndex, 1);
      next.unshift(removed);
      try {
        localStorage.setItem('touchpoint_column_order', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const reorderColumns = (sourceId: string, targetId: string) => {
    setColumnOrder((prev) => {
      const srcIdx = prev.indexOf(sourceId);
      const tgtIdx = prev.indexOf(targetId);
      if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
      const next = [...prev];
      const [removed] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, removed);
      try {
        localStorage.setItem('touchpoint_column_order', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetColumnSettings = () => {
    const defaultVisible = [
      'firstName',
      'lastName',
      'name',
      'phone',
      'email',
      'birthday',
      'source',
      'company',
      'groups',
      'keepInTouch',
      'actions',
    ];
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setVisibleColumns(defaultVisible);
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.setItem('touchpoint_column_order', JSON.stringify(DEFAULT_COLUMN_ORDER));
      localStorage.setItem('touchpoint_columns', JSON.stringify(defaultVisible));
      localStorage.setItem('touchpoint_column_widths', JSON.stringify(DEFAULT_COLUMN_WIDTHS));
    } catch {}
  };

  const handlePageSizeChange = (size: number) => {
    setContactsPageSize(size);
    setContactsCurrentPage(1);
    try {
      localStorage.setItem('touchpoint_contacts_page_size', String(size));
    } catch {}
  };

  const handleCreateInlineGroupForContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineGroupName.trim()) return;
    setInlineGroupLoading(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineGroupName.trim(),
          intervalDays: Number(inlineGroupInterval) || 30,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newGroup: GroupItem = data.group || data;
        if (newGroup && newGroup.id) {
          setGroups((prev) => [...prev.filter((g) => g.id !== newGroup.id), newGroup]);
          setEditContactForm((prev) => ({
            ...prev,
            groupIds: Array.from(new Set([...prev.groupIds.filter(Boolean), newGroup.id])),
          }));
          setInlineGroupName('');
          setInlineGroupInterval(30);
          setShowInlineNewGroup(false);
          setStatusToast(`Group "${newGroup.name}" created and assigned!`);
        }
      } else {
        const err = await res.json();
        setStatusToast(err.error || 'Failed to create group');
      }
    } catch {
      setStatusToast('Failed to create group');
    } finally {
      setInlineGroupLoading(false);
    }
  };

  const effectiveActiveColumns = useMemo(() => {
    let cols = columnOrder.filter((id) => visibleColumns.includes(id));
    if (
      cols.length === 0 ||
      (!cols.includes('name') && !cols.includes('firstName') && !cols.includes('lastName'))
    ) {
      if (!cols.includes('name')) {
        cols = ['name', ...cols];
      }
    }
    return cols;
  }, [columnOrder, visibleColumns]);

  const toggleDashboardWidget = (key: string) => {
    setDashboardWidgets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('touchpoint_dashboard_widgets', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSwitchTheme = async (
    preset: 'sbb' | 'leadflow' | 'studio' | 'nordic' | 'midnight' | 'kyoto',
    mode: 'dark' | 'light'
  ) => {
    setThemePreset(preset);
    setThemeMode(mode);
    applyThemeAttributes(preset, mode);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themePreset: preset, themeMode: mode }),
    });
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupForm),
      });
      const data = await res.json();
      if (res.ok) {
        setSetupComplete(true);
        setCurrentUser(data.user);
        loadAllData();
        notify('Account created successfully.');
      } else {
        setLoginError(data.error || 'Setup failed');
        notify(data.error || 'Setup failed');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Setup request failed');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        setSetupComplete(true);
        loadAllData();
        notify(`Welcome back, ${data.user.username}!`);
      } else if (res.ok && data.require2fa) {
        setTwoFactorTempToken(data.tempToken);
        setTwoFactorRequired(true);
        setLoginError(null);
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login request failed');
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempToken: twoFactorTempToken,
          code: twoFactorCode,
          rememberMe: loginForm.rememberMe,
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        setSetupComplete(true);
        setTwoFactorRequired(false);
        setTwoFactorTempToken(null);
        setTwoFactorCode('');
        loadAllData();
        notify(`Welcome back, ${data.user.username}!`);
      } else {
        setLoginError(data.error || 'Invalid verification code');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Verification failed');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setAuthMode('login');
    notify('Signed out successfully.');
  };

  const handleShuffleSerendipity = async () => {
    const nextOffset = serendipityOffset + 1;
    setSerendipityOffset(nextOffset);
    try {
      const res = await fetch(`/api/serendipity?offset=${nextOffset}`);
      const data = await res.json();
      setSerendipitySuggestion(data.suggestion);
    } catch {
      // ignore
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      const res = await fetch('/api/backup/snapshots', { method: 'POST' });
      if (res.ok) {
        const snapRes = await fetch('/api/backup/snapshots');
        const snapData = await snapRes.json();
        setSnapshots(snapData.snapshots || []);
        notify('Point-in-time database snapshot created successfully!');
      } else {
        notify('Failed to create snapshot');
      }
    } catch {
      notify('Failed to create snapshot');
    }
  };

  const handleStart2faSetup = async () => {
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTotpSetupData(data);
        setTotpVerifyCode('');
        setTotpBackupCodes(null);
        setShow2faSetupModal(true);
      } else {
        notify(data.error || 'Failed to start 2FA setup');
      }
    } catch {
      notify('Failed to start 2FA setup');
    }
  };

  const handleConfirm2faEnable = async () => {
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpVerifyCode }),
      });
      const data = await res.json();
      if (res.ok && data.backupCodes) {
        setTotpBackupCodes(data.backupCodes);
        setCurrentUser((prev: any) => prev ? { ...prev, totpEnabled: true } : prev);
        notify('Two-Factor Authentication is now ENABLED!');
      } else {
        notify(data.error || 'Invalid verification code');
      }
    } catch {
      notify('Failed to enable 2FA');
    }
  };

  const handleConfirm2faDisable = async () => {
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disable2faPassword, code: disable2faCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setShow2faDisableModal(false);
        setDisable2faPassword('');
        setDisable2faCode('');
        setCurrentUser((prev: any) => prev ? { ...prev, totpEnabled: false } : prev);
        notify('Two-Factor Authentication has been DISABLED.');
      } else {
        notify(data.error || 'Failed to disable 2FA');
      }
    } catch {
      notify('Failed to disable 2FA');
    }
  };

  const handleCreateLocalContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const combinedName = [newContactForm.firstName.trim(), newContactForm.lastName.trim()]
      .filter(Boolean)
      .join(' ');
    if (!combinedName) return;

    const customIntervalDays =
      newContactForm.intervalMode === 'custom'
        ? Number(newContactForm.customDaysValue) || 30
        : newContactForm.selectedPresetDays;

    const validSignificantDates = newContactForm.significantDates
      .filter((d) => d.date && d.date.trim())
      .map((d) => ({
        label: d.label.trim() || 'Anniversary',
        date: d.date.trim(),
      }));
    const primarySignificant = validSignificantDates[0] || null;

    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'local',
        firstName: newContactForm.firstName.trim() || null,
        lastName: newContactForm.lastName.trim() || null,
        fullName: combinedName,
        phone: newContactForm.phone || null,
        email: newContactForm.email || null,
        company: newContactForm.company || null,
        jobTitle: newContactForm.jobTitle || null,
        notes: newContactForm.notes || null,
        birthday: newContactForm.birthday || null,
        significantDate: primarySignificant ? primarySignificant.date : null,
        significantDateLabel: primarySignificant ? primarySignificant.label : null,
        importantDates: validSignificantDates,
        keepInTouch: newContactForm.keepInTouch,
        customIntervalDays,
        groupIds: newContactForm.groupIds,
      }),
    });
    if (res.ok) {
      if (!addMoreContact) {
        setShowNewContactModal(false);
      }
      setNewContactForm({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        company: '',
        jobTitle: '',
        notes: '',
        birthday: '',
        significantDate: '',
        significantDateLabel: 'Anniversary',
        significantDates: [{ label: 'Anniversary', date: '' }],
        keepInTouch: true,
        intervalMode: 'preset',
        selectedPresetDays: null,
        customDaysValue: 21,
        groupIds: [],
      });
      await loadAllData();
      notify(addMoreContact ? 'Contact saved. Ready to add another.' : 'Contact saved.');
    }
  };

  const handleLogTouchpoint = async (
    contactId: number,
    method: 'call' | 'message' | 'in_person' | 'other',
    note?: string
  ) => {
    const res = await fetch('/api/touchpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, method, note }),
    });
    if (res.ok) {
      await loadAllData();
      notify(`Logged ${method.replace('_', ' ')} & reset cadence timer.`);
    }
  };

  const handleSnooze = async (contactId: number, daysOrDate: number | string) => {
    const isDateStr = typeof daysOrDate === 'string' && daysOrDate.includes('-');
    const payload = isDateStr
      ? { action: 'snooze', contactId, date: daysOrDate }
      : { action: 'snooze', contactId, days: Number(daysOrDate) || 3 };

    const res = await fetch('/api/touchpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await loadAllData();
      if (activeContactDrawer && activeContactDrawer.id === contactId) {
        try {
          const contactRes = await fetch(`/api/contacts/${contactId}`);
          const cData = await contactRes.json();
          if (cData.contact) setActiveContactDrawer(cData.contact);
        } catch {
          // ignore
        }
      }
      if (isDateStr) {
        notify(`Follow-up scheduled for ${daysOrDate}.`);
      } else if (Number(daysOrDate) === 1) {
        notify('Follow-up scheduled for tomorrow.');
      } else {
        notify(`Snoozed reminder for ${daysOrDate} days.`);
      }
    }
  };

  const handleBulkAction = async (
    action:
      | 'enable_keep_in_touch'
      | 'disable_keep_in_touch'
      | 'assign_group'
      | 'remove_group'
      | 'delete',
    groupId?: number
  ) => {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'bulk',
        contactIds: selectedContactIds,
        action,
        groupId,
      }),
    });
    if (res.ok) {
      setSelectedContactIds([]);
      await loadAllData();
      notify(`Bulk operation (${action.replace(/_/g, ' ')}) applied.`);
    }
  };

  const handleMergeDuplicate = async (primaryId: number, secondaryId: number) => {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'merge', primaryId, secondaryId }),
    });
    if (res.ok) {
      await loadAllData();
      notify('Contacts merged cleanly.');
      setDuplicates((prev) => {
        const remaining = prev.filter(
          (p) =>
            !(
              (p.contactA.id === primaryId && p.contactB.id === secondaryId) ||
              (p.contactA.id === secondaryId && p.contactB.id === primaryId)
            )
        );
        if (remaining.length === 0) {
          setShowMergeModal(false);
          setCurrentDuplicateIndex(0);
          notify('All duplicate contacts processed!');
        } else {
          setCurrentDuplicateIndex((idx) => (idx >= remaining.length ? 0 : idx));
        }
        return remaining;
      });
    } else {
      notify('Failed to merge contacts');
    }
  };

  const handleOpenEditContact = (c: ContactItem) => {
    setEditingContact(c);
    const fn = c.firstName || '';
    const ln = c.lastName || '';
    const full = c.fullName || [fn, ln].filter(Boolean).join(' ');

    const initialImportantDates: Array<{ id?: number; label: string; date: string }> = [
      ...(c.importantDates || []).map((d) => ({
        id: d.id,
        label: d.label,
        date: d.date,
      })),
    ];
    if (
      c.significantDate &&
      !initialImportantDates.some((d) => d.date === c.significantDate)
    ) {
      initialImportantDates.unshift({
        label: c.significantDateLabel || 'Anniversary',
        date: c.significantDate,
      });
    }
    if (initialImportantDates.length === 0) {
      initialImportantDates.push({ label: 'Anniversary', date: '' });
    }

    setEditContactForm({
      firstName: fn,
      lastName: ln,
      fullName: full,
      phone: c.phone || '',
      email: c.email || '',
      company: c.company || '',
      jobTitle: c.jobTitle || '',
      birthday: c.birthday || '',
      significantDate: c.significantDate || '',
      significantDateLabel: c.significantDateLabel || 'Anniversary',
      importantDates: initialImportantDates,
      notes: c.notes || '',
      keepInTouch: Boolean(c.keepInTouch),
      intervalMode: c.customIntervalDays ? 'custom' : 'inherit',
      customIntervalDays: c.customIntervalDays || 30,
      groupIds: c.groups.map((g) => g.id),
    });
  };

  const handleSaveEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    const fn = editContactForm.firstName.trim();
    const ln = editContactForm.lastName.trim();
    const full = editContactForm.fullName.trim() || [fn, ln].filter(Boolean).join(' ');

    const validImportantDates = editContactForm.importantDates
      .filter((d) => d.date && d.date.trim())
      .map((d) => ({
        id: d.id,
        label: d.label.trim() || 'Anniversary',
        date: d.date.trim(),
      }));
    const primarySignificant = validImportantDates[0] || null;

    const payload = {
      firstName: fn || null,
      lastName: ln || null,
      fullName: full,
      phone: editContactForm.phone.trim() || null,
      email: editContactForm.email.trim() || null,
      company: editContactForm.company.trim() || null,
      jobTitle: editContactForm.jobTitle.trim() || null,
      birthday: editContactForm.birthday.trim() || null,
      significantDate: primarySignificant ? primarySignificant.date : null,
      significantDateLabel: primarySignificant ? primarySignificant.label : null,
      importantDates: validImportantDates,
      notes: editContactForm.notes.trim() || null,
      keepInTouch: editContactForm.keepInTouch,
      customIntervalDays:
        editContactForm.intervalMode === 'custom'
          ? Number(editContactForm.customIntervalDays)
          : null,
      groupIds: editContactForm.groupIds,
    };
    const res = await fetch(`/api/contacts/${editingContact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setEditingContact(null);
      if (activeContactDrawer && activeContactDrawer.id === editingContact.id && data.contact) {
        setActiveContactDrawer(data.contact);
      }
      await loadAllData();
      notify('Contact updated successfully.');
    } else {
      notify('Failed to update contact');
    }
  };

  const handleWipeAllData = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    const res = await fetch('/api/backup', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE' }),
    });
    if (res.ok) {
      setDeleteConfirmText('');
      setShowDeleteModal(false);
      setSelectedContactIds([]);
      setActiveContactDrawer(null);
      await loadAllData();
      notify('All contacts, groups, and activity have been permanently deleted.');
    } else {
      const data = await res.json().catch(() => ({}));
      notify(data.error || 'Failed to delete data');
    }
  };

  const handleSaveAllSettings = async () => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timezone: settingsState.timezone,
        dateFormat: settingsState.dateFormat || 'YYYY-MM-DD',
        defaultCountryCode: settingsState.defaultCountryCode,
        firstDayOfWeek: Number(settingsState.firstDayOfWeek ?? 0),
        birthdayDaysAdvance: Number(settingsState.birthdayDaysAdvance || 7),
        maxDailyDue: Number(settingsState.maxDailyDue || 3),
        cadenceFuzzinessEnabled: Boolean(settingsState.cadenceFuzzinessEnabled),
        cadenceFuzzinessPercent: Number(settingsState.cadenceFuzzinessPercent || 15),
        logLevel: settingsState.logLevel || 'info',
        telegramBotToken: settingsState.telegramBotToken || null,
        telegramChatId: settingsState.telegramChatId || null,
        webhookEnabled: Boolean(settingsState.webhookEnabled),
        webhookUrl: settingsState.webhookUrl || null,
        webhookSecret: settingsState.webhookSecret || null,
        googleClientId: settingsState.googleClientId || null,
        googleClientSecret: settingsState.googleClientSecret || null,
        googleRefreshToken: settingsState.googleRefreshToken || null,
        googleSyncInterval: settingsState.googleSyncInterval || 'manual',
        skipGoogleEmailOnly: Boolean(settingsState.skipGoogleEmailOnly),
        googleCalendarPushEnabled: Boolean(settingsState.googleCalendarPushEnabled),
        googleCalendarId: settingsState.googleCalendarId || 'primary',
      }),
    });
    if (res.ok) {
      await loadAllData();
      notify('All settings saved successfully.');
    } else {
      notify('Failed to save settings');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGroupForm),
    });
    if (res.ok) {
      setNewGroupForm({ name: '', intervalDays: 0, color: '#2b7fff' });
      await loadAllData();
      notify('Group created.');
    } else {
      const data = await res.json().catch(() => ({}));
      notify(data.error || 'Failed to create group (name may already exist).');
    }
  };

  const handleOpenGroupDetails = (g: GroupItem) => {
    setSelectedGroupDetails(g);
    setEditGroupForm({
      id: g.id,
      name: g.name,
      color: g.color || '#e85d3a',
      intervalDays: g.intervalDays ?? 0,
    });
    setGroupSearchQuery('');
    setAddContactIdToGroup('');
  };

  const handleSaveGroupSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editGroupForm.name.trim()) return;
    try {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editGroupForm),
      });
      if (res.ok) {
        notify(`Group "${editGroupForm.name}" settings saved.`);
        await loadAllData();
      } else {
        const err = await res.json();
        notify(err.error || 'Failed to update group');
      }
    } catch {
      notify('Failed to update group');
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the group "${groupName}"? Contacts linked to this group will remain in your contacts directory.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/groups?id=${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedGroupDetails?.id === groupId) {
          setSelectedGroupDetails(null);
        }
        await loadAllData();
        notify(`Group "${groupName}" deleted.`);
      } else {
        notify('Failed to delete group');
      }
    } catch {
      notify('Failed to delete group');
    }
  };

  const handleRemoveContactFromGroup = async (contactId: number, groupId: number) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'bulk',
          contactIds: [contactId],
          action: 'remove_group',
          groupId,
        }),
      });
      if (res.ok) {
        await loadAllData();
        notify('Contact removed from group.');
      } else {
        notify('Failed to remove contact from group.');
      }
    } catch {
      notify('Failed to remove contact from group.');
    }
  };

  const handleAddContactToGroup = async (contactId: number, groupId: number) => {
    if (!contactId) return;
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'bulk',
          contactIds: [contactId],
          action: 'assign_group',
          groupId,
        }),
      });
      if (res.ok) {
        setAddContactIdToGroup('');
        await loadAllData();
        notify('Contact added to group.');
      } else {
        notify('Failed to add contact to group.');
      }
    } catch {
      notify('Failed to add contact to group.');
    }
  };

  const handleCreateRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelForm.contactAId || !newRelForm.contactBId) return;
    const res = await fetch('/api/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRelForm),
    });
    if (res.ok) {
      setNewRelForm({ contactAId: '', contactBId: '', type: 'spouse' });
      setPersonASearch('');
      setPersonBSearch('');
      await loadAllData();
      notify('Relationship linked on map.');
    }
  };

  const handleDeleteTouchpoint = async (touchpointId: number) => {
    if (!confirm('Are you sure you want to remove this touchpoint from the log?')) return;
    const res = await fetch(`/api/touchpoints?id=${touchpointId}`, { method: 'DELETE' });
    if (res.ok) {
      if (activeContactDrawer) {
        const historyRes = await fetch(`/api/touchpoints?contactId=${activeContactDrawer.id}`);
        const historyData = await historyRes.json();
        if (historyData.touchpoints) setDrawerTouchpoints(historyData.touchpoints);
        const contactRes = await fetch(`/api/contacts/${activeContactDrawer.id}`);
        const contactData = await contactRes.json();
        if (contactData.contact) setActiveContactDrawer(contactData.contact);
      }
      await loadAllData();
      notify('Touchpoint entry removed.');
    } else {
      notify('Failed to delete touchpoint.');
    }
  };

  const handleStartEditTouchpoint = (tp: { id: number; method: string; note: string | null; contactedAt: string }) => {
    setEditingTouchpointId(tp.id);
    setEditTpMethod(tp.method);
    setEditTpNote(tp.note || '');
    setEditTpDate(tp.contactedAt ? tp.contactedAt.substring(0, 10) : '');
  };

  const handleSaveEditTouchpoint = async (touchpointId: number) => {
    const res = await fetch('/api/touchpoints', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: touchpointId,
        method: editTpMethod,
        note: editTpNote,
        contactedAt: editTpDate ? new Date(editTpDate).toISOString() : new Date().toISOString(),
      }),
    });
    if (res.ok) {
      setEditingTouchpointId(null);
      if (activeContactDrawer) {
        const historyRes = await fetch(`/api/touchpoints?contactId=${activeContactDrawer.id}`);
        const historyData = await historyRes.json();
        if (historyData.touchpoints) setDrawerTouchpoints(historyData.touchpoints);
        const contactRes = await fetch(`/api/contacts/${activeContactDrawer.id}`);
        const contactData = await contactRes.json();
        if (contactData.contact) setActiveContactDrawer(contactData.contact);
      }
      await loadAllData();
      notify('Touchpoint entry updated.');
    } else {
      notify('Failed to update touchpoint.');
    }
  };

  const drawerRelationships = useMemo(() => {
    if (!activeContactDrawer) return [];
    return graph.edges
      .filter((e) => e.source === activeContactDrawer.id || e.target === activeContactDrawer.id)
      .map((edge) => {
        const otherId = edge.source === activeContactDrawer.id ? edge.target : edge.source;
        const other = contacts.find((c) => c.id === otherId);
        return {
          id: edge.id,
          type: edge.type,
          otherId,
          otherName: other ? other.fullName : `Contact #${otherId}`,
          otherContact: other,
        };
      });
  }, [activeContactDrawer, graph.edges, contacts]);

  const handleDrawerPatch = async (updates: Partial<ContactItem>) => {
    if (!activeContactDrawer) return;
    setActiveContactDrawer((prev) => (prev ? { ...prev, ...updates } : null));
    await fetch(`/api/contacts/${activeContactDrawer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await loadAllData();
    const updated = await (await fetch(`/api/contacts/${activeContactDrawer.id}`)).json();
    if (updated.contact) setActiveContactDrawer(updated.contact);
    notify('Contact updated.');
  };

  const handleDrawerLogTouchpoint = async (method: 'call' | 'message' | 'in_person' | 'other') => {
    if (!activeContactDrawer) return;
    const res = await fetch('/api/touchpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: activeContactDrawer.id,
        method,
        note: `Quick touchpoint logged from Contact details`,
        contactedAt: new Date().toISOString().split('T')[0],
      }),
    });
    if (res.ok) {
      await loadAllData();
      const [updatedContactRes, tpRes] = await Promise.all([
        fetch(`/api/contacts/${activeContactDrawer.id}`),
        fetch(`/api/touchpoints?contactId=${activeContactDrawer.id}`),
      ]);
      const updatedData = await updatedContactRes.json();
      const tpData = await tpRes.json();
      if (updatedData.contact) setActiveContactDrawer(updatedData.contact);
      if (tpData.touchpoints) setDrawerTouchpoints(tpData.touchpoints);
      notify(`Logged ${method} touchpoint & reset cadence.`);
    }
  };

  const handleDrawerAddMilestone = async () => {
    if (!activeContactDrawer || !newMilestoneDate || !newMilestoneLabel.trim()) return;
    const res = await fetch('/api/touchpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_important_date',
        contactId: activeContactDrawer.id,
        label: newMilestoneLabel.trim(),
        date: newMilestoneDate,
      }),
    });
    if (res.ok) {
      setNewMilestoneLabel('');
      setNewMilestoneDate('');
      setShowAddMilestone(false);
      await loadAllData();
      const updated = await (await fetch(`/api/contacts/${activeContactDrawer.id}`)).json();
      if (updated.contact) setActiveContactDrawer(updated.contact);
      notify('Significant date added.');
    }
  };

  const handleDrawerDeleteMilestone = async (dateId: number) => {
    if (!activeContactDrawer) return;
    const res = await fetch('/api/touchpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_important_date',
        id: dateId,
      }),
    });
    if (res.ok) {
      await loadAllData();
      const updated = await (await fetch(`/api/contacts/${activeContactDrawer.id}`)).json();
      if (updated.contact) setActiveContactDrawer(updated.contact);
      notify('Milestone removed.');
    }
  };

  // Authentication & Onboarding Gate
  if (!authDisabled && !currentUser) {
    if (setupComplete === null) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground space-y-4">
          <img
            src="/logo.png"
            alt="Touchpoint Logo"
            className="w-12 h-12 rounded-xl object-contain shadow-md animate-pulse"
          />
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            Loading Touchpoint...
          </div>
        </div>
      );
    }

    if (setupComplete === false || (allowSignups && authMode === 'signup')) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <img
                  src="/logo.png"
                  alt="Touchpoint Logo"
                  className="w-8 h-8 rounded-lg object-contain shrink-0 shadow-xs"
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {setupComplete === false ? 'First-Run Setup' : 'Create Account'}
                </span>
              </div>
              <h1 className="text-2xl font-bold">
                {setupComplete === false ? 'Welcome to Touchpoint' : 'Create an Account'}
              </h1>
              <p className="text-xs text-muted mt-1">
                {setupComplete === false
                  ? 'Set up your initial administrator account. Each user gets their own segregated personal database.'
                  : 'Register a new account. Your contacts, groups, and logs will be isolated in your personal database.'}
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {loginError}
              </div>
            )}

            <form onSubmit={handleCompleteSetup} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-muted mb-1">Username</label>
                <input
                  required
                  value={setupForm.username}
                  onChange={(e) => setSetupForm({ ...setupForm, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={setupForm.email}
                  onChange={(e) => setSetupForm({ ...setupForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Password (min 6 chars)</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={setupForm.password}
                  onChange={(e) => setSetupForm({ ...setupForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TimezoneSelect
                  id="signup-timezone"
                  label="Timezone"
                  value={setupForm.timezone}
                  onChange={(tz) => setSetupForm({ ...setupForm, timezone: tz })}
                />
                <CountryCodeSelect
                  id="signup-country-code"
                  label="Default Country Code"
                  value={setupForm.defaultCountryCode}
                  onChange={(code) =>
                    setSetupForm({ ...setupForm, defaultCountryCode: code })
                  }
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-primary text-primary-fg font-semibold text-sm mt-2 hover:opacity-95 transition"
              >
                {setupComplete === false ? 'Create Account & Start' : 'Sign Up'}
              </button>
            </form>

            {setupComplete && (
              <div className="text-center pt-2 border-t border-border/50 text-xs text-muted">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setLoginError(null);
                    setAuthMode('login');
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Standard Login Screen
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img
                src="/logo.png"
                alt="Touchpoint Logo"
                className="w-8 h-8 rounded-lg object-contain shrink-0 shadow-xs"
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Sign In
              </span>
            </div>
            <h1 className="text-2xl font-bold">Welcome Back</h1>
            <p className="text-xs text-muted mt-1">
              Enter your credentials to access your Touchpoint contact dashboard.
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {loginError}
            </div>
          )}

          {twoFactorRequired ? (
            <form onSubmit={handleVerify2fa} className="space-y-4 text-sm">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center space-y-1">
                <div className="text-sm font-bold text-foreground">Two-Factor Authentication</div>
                <p className="text-xs text-muted">
                  Enter the 6-digit verification code from your authenticator app, or an 8-character backup recovery code.
                </p>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 font-medium">Verification Code</label>
                <input
                  required
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="w-full text-center tracking-widest text-lg font-mono px-3 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="123456"
                  maxLength={10}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-primary text-primary-fg font-semibold text-sm hover:opacity-95 transition shadow-xs"
              >
                Verify &amp; Sign In
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorRequired(false);
                    setTwoFactorTempToken(null);
                    setTwoFactorCode('');
                    setLoginError(null);
                  }}
                  className="text-xs text-muted hover:text-foreground underline"
                >
                  Back to password login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs text-muted mb-1">Username or Email</label>
                <input
                  required
                  type="text"
                  value={loginForm.identifier}
                  onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Username or email address"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Password</label>
                <input
                  required
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={loginForm.rememberMe}
                    onChange={(e) => setLoginForm({ ...loginForm, rememberMe: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-muted">Remember me (90 days)</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-primary text-primary-fg font-semibold text-sm mt-3 hover:opacity-95 transition"
              >
                Sign In
              </button>
            </form>
          )}

          {allowSignups ? (
            <div className="text-center pt-2 border-t border-border/50 text-xs text-muted">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setLoginError(null);
                  setAuthMode('signup');
                }}
                className="text-primary hover:underline font-medium"
              >
                Create one
              </button>
            </div>
          ) : (
            <div className="text-center pt-2 border-t border-border/50 text-[11px] text-muted/70">
              Signups are locked. Set <code className="px-1 py-0.5 rounded bg-muted/20 text-foreground font-mono text-[10px]">ALLOW_SIGNUPS=true</code> in your environment to enable additional user registration.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dashboard Metrics
  const evaluations = contacts.map((c) => c.cadence);
  const health = calculateRelationshipHealthScore(evaluations);
  const { surfacedToday } = applySmartSpreading(
    evaluations,
    Number(settingsState.maxDailyDue || 3)
  );
  const surfacedIds = new Set(surfacedToday.map((s) => s.contactId));
  const attentionContacts = contacts.filter((c) => surfacedIds.has(c.id));
  const upcomingWeekContacts = contacts
    .filter(
      (c) =>
        c.keepInTouch &&
        !surfacedIds.has(c.id) &&
        c.cadence.status !== 'paused' &&
        c.cadence.status !== 'untracked' &&
        c.cadence.daysUntilDue >= 0 &&
        c.cadence.daysUntilDue <= 7
    )
    .sort((a, b) => a.cadence.daysUntilDue - b.cadence.daysUntilDue);

  const onTrackContacts = contacts.filter(
    (c) =>
      c.keepInTouch &&
      !surfacedIds.has(c.id) &&
      c.cadence.status !== 'untracked' &&
      c.cadence.daysUntilDue > 7
  );

  const recent30DaysContacts = contacts
    .filter(
      (c) =>
        Boolean(c.lastContactedAt) &&
        c.cadence.daysSinceContact >= 0 &&
        c.cadence.daysSinceContact <= 30
    )
    .sort(
      (a, b) =>
        new Date(b.lastContactedAt || 0).getTime() - new Date(a.lastContactedAt || 0).getTime()
    );

  // Incoming Birthdays in the Upcoming Week (default 7 days, respecting firstDayOfWeek)
  const firstDayOfWeek = Number(settingsState.firstDayOfWeek ?? 0); // 0 = Sunday, 1 = Monday, 6 = Saturday
  const weekDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const birthdayWindowDays = Number(settingsState.birthdayDaysAdvance || 7);
  const nowDate = new Date();
  const todayMidnight = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());

  const upcomingBirthdays = contacts
    .map((c) => {
      if (!c.birthday) return null;
      const parts = c.birthday.trim().split('-').map(Number);
      if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
      const hasYear = parts.length === 3 && parts[0] > 1900;
      const birthYear = hasYear ? parts[0] : null;
      const month = hasYear ? parts[1] : parts[0];
      const day = hasYear ? parts[2] : parts[1];
      if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

      let nextBday = new Date(todayMidnight.getFullYear(), month - 1, day);
      if (nextBday < todayMidnight) {
        nextBday = new Date(todayMidnight.getFullYear() + 1, month - 1, day);
      }
      const daysUntil = Math.round(
        (nextBday.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil < 0 || daysUntil > birthdayWindowDays) return null;

      const turningAge = birthYear ? nextBday.getFullYear() - birthYear : null;
      const weekdayStr = nextBday.toLocaleDateString('en-US', { weekday: 'short' });
      const formattedDate = `${weekdayStr}, ${formatDateByPattern(nextBday, settingsState.dateFormat)}`;

      return {
        contact: c,
        daysUntil,
        turningAge,
        formattedDate,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const trackedContactsSortedByDue = contacts
    .filter((c) => c.keepInTouch)
    .sort((a, b) => a.cadence.daysUntilDue - b.cadence.daysUntilDue);

  // Global Vacation / Pause Mode Calculations
  const isGlobalPaused = Boolean(
    settingsState.globalPausedUntil &&
      new Date(settingsState.globalPausedUntil).getTime() > Date.now()
  );
  const remainingPauseDays = isGlobalPaused
    ? Math.max(
        1,
        Math.ceil(
          (new Date(settingsState.globalPausedUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : 0;
  const formattedPausedUntil = isGlobalPaused
    ? `${new Date(settingsState.globalPausedUntil).toLocaleDateString('en-US', { weekday: 'short' })}, ${formatDateByPattern(settingsState.globalPausedUntil, settingsState.dateFormat)}`
    : '';

  // Quick Search & Filtered Contacts
  const filteredContacts = contacts.filter((c) => {
    if (searchFilterGroup !== null && !c.groups.some((g) => g.id === searchFilterGroup)) {
      return false;
    }
    if (searchFilterTab === 'due') {
      if (!c.keepInTouch || !['overdue', 'due_today'].includes(c.cadence.status)) return false;
    } else if (searchFilterTab === 'birthdays') {
      if (!c.birthday) return false;
    } else if (searchFilterTab === 'tracked') {
      if (!c.keepInTouch) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.fullName.toLowerCase().includes(q);
      const matchPhone = (c.phone || '').toLowerCase().includes(q);
      const matchEmail = (c.email || '').toLowerCase().includes(q);
      const matchCompany = (c.company || '').toLowerCase().includes(q);
      const matchTitle = (c.jobTitle || '').toLowerCase().includes(q);
      const matchNotes = (c.notes || '').toLowerCase().includes(q);
      const matchGroups = c.groups.some((g) => g.name.toLowerCase().includes(q));
      if (!matchName && !matchPhone && !matchEmail && !matchCompany && !matchTitle && !matchNotes && !matchGroups) {
        return false;
      }
    }
    return true;
  });

  // Pagination Calculations for Contacts Directory
  const totalContacts = filteredContacts.length;
  const totalPages = Math.max(1, Math.ceil(totalContacts / contactsPageSize));
  const safeCurrentPage = Math.min(contactsCurrentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * contactsPageSize;
  const endIndex = Math.min(startIndex + contactsPageSize, totalContacts);
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  // Render sidebar contents for both desktop rail and mobile drawer
  const renderSidebarContent = (isMobile = false) => (
    <>
      <div className="space-y-5">
        {/* Brand Header (branding.md: concise identity, defers to content) */}
        <div className="flex items-center justify-between px-2 pb-3.5 border-b border-[#262b36]">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-lg bg-[#1f2329] border border-[#323844] flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="Touchpoint Logo"
                className="w-5 h-5 object-contain"
              />
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#c92121] ring-2 ring-[#141619]"
                title="Cadence Engine Active"
              />
            </div>
            <div>
              <div className="font-bold text-[15px] tracking-tight text-[#f6f6f3] leading-tight">
                Touchpoint
              </div>
              <div className="font-mono text-[11px] font-medium text-[#a3aab8] leading-tight">
                Cadence PRM
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() =>
                handleSwitchTheme(themePreset, themeMode === 'dark' ? 'light' : 'dark')
              }
              title="Toggle Appearance"
              aria-label="Toggle Light or Dark Appearance"
              className="min-h-[28px] min-w-[28px] p-1.5 rounded-lg border border-[#2d323d] bg-[#1c2026] hover:bg-[#282d36] text-[#d6dae2] hover:text-[#f6f6f3] flex items-center justify-center transition"
            >
              {themeMode === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#f6f6f3]" />
              )}
            </button>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation drawer"
                className="min-h-[28px] min-w-[28px] p-1.5 rounded-lg border border-[#2d323d] bg-[#1c2026] hover:bg-[#282d36] text-[#d6dae2] hover:text-[#f6f6f3] flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Primary Navigation (sidebars.md: succinct Title-Style labels, <=2 levels, no fake 01-07 sequence) */}
        <div className="space-y-1">
          <div className="px-2.5 pb-1 text-[11px] font-semibold text-[#a3aab8]">
            Workspace
          </div>
          <nav className="space-y-0.5 text-[13px]" aria-label="Workspace Navigation">
            {[
              {
                id: 'dashboard',
                label: 'Dashboard',
                icon: LayoutDashboard,
                badge: attentionContacts.length,
                urgent: attentionContacts.length > 0,
              },
              {
                id: 'contacts',
                label: 'Contacts',
                icon: Users,
                badge: contacts.length,
              },
              {
                id: 'groups',
                label: 'Groups',
                icon: FolderKanban,
                badge: groups.length,
              },
              { id: 'map', label: 'Relationships', icon: Network },
              {
                id: 'calendar',
                label: 'Calendar & Schedule',
                icon: CalendarIcon,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as typeof activeTab);
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[34px] flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-[#252a34] text-[#ffffff] font-semibold border-l-[3px] border-[#c92121]'
                      : 'text-[#d6dae2] hover:text-[#ffffff] hover:bg-[#1d2129] font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#ff5c5c]' : 'text-[#a3aab8]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded-md font-semibold tabular-nums ${
                        item.urgent
                          ? 'bg-[#c92121] text-white'
                          : isActive
                          ? 'bg-[#323846] text-[#f6f6f3]'
                          : 'bg-[#1c2026] text-[#b8bfcc]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Secondary Navigation */}
        <div className="space-y-1 pt-3 border-t border-[#262b36]">
          <div className="px-2.5 pb-1 text-[11px] font-semibold text-[#a3aab8]">
            System
          </div>
          <nav className="space-y-0.5 text-[13px]" aria-label="System Navigation">
            {[
              { id: 'settings', label: 'Settings', icon: SettingsIcon },
              { id: 'help', label: 'Help & Guide', icon: BookOpen },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as typeof activeTab);
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[34px] flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-[#252a34] text-[#ffffff] font-semibold border-l-[3px] border-[#c92121]'
                      : 'text-[#d6dae2] hover:text-[#ffffff] hover:bg-[#1d2129] font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-[#ff5c5c]' : 'text-[#a3aab8]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Network Cadence Status Readout (sidebars.md: passive telemetry only; primary actions live in toolbar) */}
      <div className="space-y-2.5 pt-3 border-t border-[#262b36]">
        <div className="rounded-lg bg-[#1b1f27] border border-[#2d323e] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#d6dae2] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Network Health
            </span>
            <span className="text-[12px] font-bold font-mono text-[#ffffff] tabular-nums">
              {health.scorePercent}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#0f1115] overflow-hidden">
            <div
              className="h-full bg-[#c92121] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(4, Math.min(100, health.scorePercent))}%` }}
            />
          </div>
          <p className="font-mono text-[11px] text-[#b8bfcc] leading-snug tabular-nums">
            {health.onTrackCount} of {health.totalTrackedCount} on schedule
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background text-foreground">
      {/* Desktop Sidebar Navigation (Hidden on mobile) */}
      <aside className="hidden md:flex w-64 h-full overflow-y-auto bg-[#141619] text-[#f6f6f3] border-r border-[#262b36] flex-col justify-between p-4 shrink-0 select-none">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Off-canvas Slide-over Drawer & Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] h-full overflow-y-auto bg-[#141619] text-[#f6f6f3] border-r border-[#262b36] flex flex-col justify-between p-4 select-none shadow-2xl transition-transform duration-200 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Mobile Navigation Drawer"
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Main Content Shell */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-background">
        {statusToast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-20 md:bottom-5 right-5 z-50 bg-[#141619] border border-[#323846] text-[#f6f6f3] px-4 py-2.5 rounded-xl shadow-xl text-[13px] font-medium flex items-center gap-2.5"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {statusToast}
          </div>
        )}

        {/* Sticky Top Toolbar (liquid-glass.md: Functional Layer translucent bar) */}
        <header className="h-14 px-3 sm:px-6 border-b border-border apple-glass-bar flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-20">
          {/* Left: Mobile Menu Trigger + Global Search */}
          <div className="flex items-center gap-2 min-w-0 flex-1 sm:max-w-md">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
              className="min-h-[34px] min-w-[34px] p-2 rounded-lg border border-border bg-card hover:bg-card-hover text-foreground flex items-center justify-center md:hidden shrink-0 transition"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Desktop Global Search Field Trigger (searching.md: primary position, clear scope) */}
            <button
              type="button"
              onClick={() => setShowQuickSearchModal(true)}
              className="hidden sm:flex flex-1 min-h-[34px] bg-background/90 hover:bg-card border border-border px-3 py-1.5 rounded-lg items-center justify-between text-[13px] text-muted cursor-pointer transition min-w-0"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Search className="w-4 h-4 text-muted shrink-0" />
                <span className="truncate">
                  {searchQuery
                    ? `Filtered by "${searchQuery}"`
                    : 'Search Contacts, Companies, or Notes…'}
                </span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-card border border-border text-[11px] font-mono font-medium text-muted shrink-0 ml-2">
                ⌘K
              </kbd>
            </button>

            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setShowQuickSearchModal(true)}
              aria-label="Search contacts"
              className="sm:hidden min-h-[34px] min-w-[34px] p-2 rounded-lg border border-border bg-card hover:bg-card-hover text-muted hover:text-foreground flex items-center justify-center shrink-0 transition"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Mobile Filter Query Indicator */}
            {searchQuery && (
              <span className="sm:hidden text-xs font-semibold text-primary truncate max-w-[120px]">
                &quot;{searchQuery}&quot;
              </span>
            )}
          </div>

          {/* Right: Toolbar Actions & Operator Profile (buttons.md: comfortable >=28pt hit targets) */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[13px] shrink-0">
            {/* Vacation Mode: Full on sm+, compact on mobile */}
            <button
              type="button"
              onClick={() => setShowPauseModal(true)}
              className={`min-h-[32px] px-2.5 sm:px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition ${
                isGlobalPaused
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'bg-background border-border text-foreground hover:bg-card-hover'
              }`}
              title={isGlobalPaused ? `Paused (${remainingPauseDays}d remaining)` : 'Vacation Mode'}
            >
              <Palmtree className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="hidden sm:inline">
                {isGlobalPaused ? `Paused (${remainingPauseDays}d)` : 'Vacation Mode…'}
              </span>
              {isGlobalPaused && (
                <span className="sm:hidden font-mono text-[11px] font-bold">
                  {remainingPauseDays}d
                </span>
              )}
            </button>

            {/* Duplicate Merger: Full on sm+, compact on mobile */}
            {duplicates.length > 0 && (
              <button
                type="button"
                onClick={() => setShowMergeModal(true)}
                className="min-h-[32px] px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1.5 hover:bg-amber-500/25 transition"
                title={`Review potential duplicate contacts (${duplicates.length})`}
              >
                <GitMerge className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  Merge Duplicates ({duplicates.length})…
                </span>
                <span className="sm:hidden font-mono text-[11px] font-bold">
                  {duplicates.length}
                </span>
              </button>
            )}

            {/* New Contact: Full on sm+, compact on mobile */}
            <button
              type="button"
              onClick={() => setShowNewContactModal(true)}
              className="min-h-[32px] px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-primary hover:opacity-95 text-primary-fg font-semibold flex items-center gap-1.5 shadow-xs transition"
              title="New Contact"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">New Contact…</span>
            </button>

            {/* Operator Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2.5 border-l border-border">
              <div className="w-7 h-7 rounded-full bg-[#141619] text-[#f6f6f3] flex items-center justify-center font-mono font-semibold text-[11px] shrink-0">
                {(currentUser?.username || 'OP').slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="font-semibold text-foreground text-[12px]">
                  {currentUser?.username || 'Workspace Owner'}
                </div>
              </div>
              {!authDisabled && currentUser && (
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="min-h-[28px] min-w-[28px] p-1.5 rounded-lg hover:bg-card-hover text-muted hover:text-overdue flex items-center justify-center transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Workspace Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-6 pb-24 md:pb-8 touch-scroll">
          {/* Global Vacation / Pause Mode Banner */}
          {isGlobalPaused && (
            <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/35 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                  <Palmtree className="w-5 h-5" />
                </span>
                <div>
                  <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <span>Vacation / Cadence Pause Active</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium">
                      {remainingPauseDays} {remainingPauseDays === 1 ? 'day' : 'days'} remaining
                    </span>
                  </div>
                  <div className="text-muted mt-0.5">
                    All cadence reminders, overdue flags, and daily notification digests are paused
                    until <strong className="text-foreground">{formattedPausedUntil}</strong>.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResumeCadence}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <PlayCircle className="w-3.5 h-3.5" /> Resume Cadence Now
                </button>
                <button
                  onClick={() => setShowPauseModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-card-hover font-medium transition"
                >
                  Adjust Duration...
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: DASHBOARD (LeadFlow-AI Architecture) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* LeadFlow Welcome Hero & Top Action Bar */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <span>Welcome back, {currentUser?.username || 'there'} 👋</span>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Here&apos;s what&apos;s happening with your network today.
                  </h1>
                  <p className="text-xs text-muted">
                    Track your relationships, cadences, and touchpoints all in one place · Week starts on{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="text-primary hover:underline font-medium"
                    >
                      {weekDayNames[firstDayOfWeek] || 'Sunday'}
                    </button>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowDashboardCustomizer((prev) => !prev)}
                    className="px-3.5 py-2 rounded-xl bg-card hover:bg-card-hover border border-border font-medium flex items-center gap-2 transition shadow-sm text-muted hover:text-foreground"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                    <span>Customize Widgets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewContactModal(true)}
                    className="px-4 py-2 rounded-xl bg-primary hover:opacity-95 text-primary-fg font-semibold flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" /> Add Contact
                  </button>
                </div>
              </div>

              {/* Dashboard Customizer Drawer/Panel */}
              {showDashboardCustomizer && (
                <div className="bg-card border border-primary/40 rounded-2xl p-5 space-y-3 text-xs shadow-md animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-primary" />
                      <span>Customize Dashboard Widgets</span>
                    </div>
                    <button
                      onClick={() => setShowDashboardCustomizer(false)}
                      className="text-muted hover:text-foreground text-xs"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <p className="text-muted">
                    Choose which widgets to display on your dashboard. Preferences are saved automatically.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                    {[
                      { id: 'healthStrip', label: '1. Executive KPI Cards & Cadence Pipeline' },
                      { id: 'overdueDue', label: '2. Overdue & Due Today' },
                      { id: 'birthdays', label: '3. Incoming Birthdays' },
                      { id: 'upcomingCalls', label: '4. People to Call in Upcoming Week' },
                      { id: 'recentTalked', label: '5. People Talked to in Last 30 Days' },
                      { id: 'scheduledLater', label: '6. Scheduled Later (On Track)' },
                    ].map((w) => (
                      <label
                        key={w.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl bg-background border border-border cursor-pointer hover:border-primary/50 transition"
                      >
                        <input
                          type="checkbox"
                          checked={dashboardWidgets[w.id] !== false}
                          onChange={() => toggleDashboardWidget(w.id)}
                          className="rounded"
                        />
                        <span className="font-medium text-foreground">{w.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 1: LeadFlow 4-Card KPI Strip */}
              {dashboardWidgets.healthStrip !== false && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* KPI 1: Total & Tracked Contacts */}
                  <div
                    onClick={() => setActiveTab('contacts')}
                    className="bg-card hover:bg-card-hover border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-muted">Total Contacts</span>
                    </div>
                    <div className="text-3xl font-bold tracking-tight text-foreground mt-3">
                      {contacts.length}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs mt-2">
                      <span className="text-emerald-400 font-semibold">
                        ↑ {contacts.filter((c) => c.keepInTouch).length} tracked
                      </span>
                      <span className="text-muted">
                        ({contacts.length > 0
                          ? `${Math.round(
                              (contacts.filter((c) => c.keepInTouch).length / contacts.length) * 100
                            )}%`
                          : '0%'}{' '}
                        under cadence)
                      </span>
                    </div>
                  </div>

                  {/* KPI 2: Needs Attention Today */}
                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-muted">Due &amp; Overdue Today</span>
                    </div>
                    <div className="text-3xl font-bold tracking-tight text-foreground mt-3">
                      {attentionContacts.length}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs mt-2">
                      <span
                        className={`font-semibold ${
                          attentionContacts.length === 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {attentionContacts.length === 0 ? '✓ All caught up' : `Cap: ${settingsState.maxDailyDue || 3}/day`}
                      </span>
                      <span className="text-muted">via smart spreading</span>
                    </div>
                  </div>

                  {/* KPI 3: Talked to Recently (30d) */}
                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-muted">Connected (Last 30d)</span>
                    </div>
                    <div className="text-3xl font-bold tracking-tight text-foreground mt-3">
                      {recent30DaysContacts.length}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs mt-2">
                      <span className="text-primary font-semibold">
                        +{upcomingWeekContacts.length} due this week
                      </span>
                      <span className="text-muted">· {upcomingBirthdays.length} 🎂</span>
                    </div>
                  </div>

                  {/* KPI 4: Relationship Health Score */}
                  <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between shadow-sm transition">
                    <div className="flex flex-col justify-between h-full">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                          <Heart className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium text-muted">Relationship Health</span>
                      </div>
                      <div className="text-3xl font-bold tracking-tight text-foreground mt-3">
                        {health.scorePercent}%
                      </div>
                      <div className="flex items-center gap-1.5 text-xs mt-2">
                        <span className="text-emerald-400 font-semibold">
                          {health.onTrackCount}/{health.totalTrackedCount}
                        </span>
                        <span className="text-muted">on schedule</span>
                      </div>
                    </div>
                    <ProgressRingAvatar
                      name={`${health.scorePercent}%`}
                      progressPercent={health.scorePercent}
                      status={health.overdueCount > 0 ? 'due_soon' : 'on_track'}
                      size="lg"
                    />
                  </div>
                </div>
              )}

              {/* Row 2: LeadFlow Asymmetric Split — Cadence Pipeline Breakdown (Left) + Serendipity & Quick Actions (Right) */}
              {dashboardWidgets.healthStrip !== false && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left (7 cols): Cadence Pipeline Breakdown (LeadFlow Horizontal Progress Bars) */}
                  <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 flex flex-col justify-between gap-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-foreground">
                          Relationship Cadence Pipeline
                        </h2>
                        <p className="text-xs text-muted mt-0.5">
                          Distribution of your contacts across cadence stages
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('contacts')}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        View directory →
                      </button>
                    </div>

                    <div className="space-y-3.5">
                      {[
                        {
                          label: 'On Track',
                          count: onTrackContacts.length,
                          total: Math.max(1, contacts.filter((c) => c.keepInTouch).length),
                          barColor: 'bg-primary',
                        },
                        {
                          label: 'Upcoming (7d)',
                          count: upcomingWeekContacts.length,
                          total: Math.max(1, contacts.filter((c) => c.keepInTouch).length),
                          barColor: 'bg-sky-400',
                        },
                        {
                          label: 'Due & Overdue',
                          count: attentionContacts.length,
                          total: Math.max(1, contacts.filter((c) => c.keepInTouch).length),
                          barColor: 'bg-rose-500',
                        },
                        {
                          label: 'Talked (30d)',
                          count: recent30DaysContacts.length,
                          total: Math.max(1, contacts.length),
                          barColor: 'bg-emerald-500',
                        },
                        {
                          label: 'Birthdays',
                          count: upcomingBirthdays.length,
                          total: Math.max(1, contacts.length),
                          barColor: 'bg-amber-400',
                        },
                      ].map((stage) => {
                        const pct = Math.min(100, Math.round((stage.count / stage.total) * 100));
                        return (
                          <div key={stage.label} className="grid grid-cols-12 items-center gap-3 text-xs">
                            <span className="col-span-3 text-muted font-medium truncate">
                              {stage.label}
                            </span>
                            <div className="col-span-7 h-3 rounded-full bg-background border border-border/60 overflow-hidden p-0.5">
                              <div
                                className={`h-full rounded-full ${stage.barColor} transition-all duration-500`}
                                style={{ width: `${stage.count > 0 ? Math.max(6, pct) : 0}%` }}
                              />
                            </div>
                            <span className="col-span-2 text-right font-mono font-semibold text-foreground">
                              {stage.count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right (5 cols): Serendipity Spotlight & Quick Actions Card */}
                  <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 flex flex-col justify-between gap-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-foreground">
                          Serendipity &amp; Quick Actions
                        </h2>
                        <p className="text-xs text-muted mt-0.5">
                          Rekindle dormant ties or manage your directory
                        </p>
                      </div>
                      {serendipitySuggestion && (
                        <button
                          type="button"
                          onClick={handleShuffleSerendipity}
                          className="px-2.5 py-1 rounded-lg bg-background hover:bg-card-hover border border-border text-[11px] font-medium text-muted hover:text-foreground transition"
                        >
                          🔀 Shuffle
                        </button>
                      )}
                    </div>

                    {serendipitySuggestion ? (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/12 via-background to-background border border-primary/30 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                            ✨ Serendipity Pick
                          </span>
                          <span className="text-[11px] italic text-muted truncate">
                            &ldquo;{serendipitySuggestion.reason}&rdquo;
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/30">
                              {serendipitySuggestion.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-foreground truncate">
                                {serendipitySuggestion.fullName}
                              </div>
                              <div className="text-xs text-muted truncate">
                                {[serendipitySuggestion.jobTitle, serendipitySuggestion.company]
                                  .filter(Boolean)
                                  .join(' at ') || 'Reconnect today'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const c = contacts.find(
                                (item) => item.id === serendipitySuggestion.contactId
                              );
                              if (c) setActiveContactDrawer(c);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-primary text-primary-fg font-semibold text-xs shrink-0 hover:opacity-95 transition shadow-sm"
                          >
                            Open Profile
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-background border border-border text-xs text-muted text-center">
                        Add more contacts to unlock Serendipity reconnection suggestions.
                      </div>
                    )}

                    {/* LeadFlow Quick Actions Stack */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowNewContactModal(true)}
                        className="py-2.5 px-3 rounded-xl bg-primary hover:opacity-95 text-primary-fg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Contact
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('groups')}
                        className="py-2.5 px-3 rounded-xl bg-background hover:bg-card-hover border border-border text-foreground font-medium text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <FolderKanban className="w-3.5 h-3.5 text-primary" /> Manage Groups
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('map')}
                        className="py-2.5 px-3 rounded-xl bg-background hover:bg-card-hover border border-border text-foreground font-medium text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Network className="w-3.5 h-3.5 text-primary" /> Network Graph
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          duplicates.length > 0
                            ? setShowMergeModal(true)
                            : setActiveTab('settings')
                        }
                        className="py-2.5 px-3 rounded-xl bg-background hover:bg-card-hover border border-border text-foreground font-medium text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <GitMerge className="w-3.5 h-3.5 text-primary" />{' '}
                        {duplicates.length > 0
                          ? `Duplicates (${duplicates.length})`
                          : 'Sync & Settings'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Needs Attention (Overdue & Due Today) — LeadFlow Table/Card Container */}
              {dashboardWidgets.overdueDue !== false && (
                <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                        <span>Overdue &amp; Due Today</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono">
                          {attentionContacts.length}
                        </span>
                      </h2>
                      <p className="text-xs text-muted mt-0.5">
                        Priority touchpoints surfaced for today
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchFilterTab('due');
                        setActiveTab('contacts');
                      }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      View all →
                    </button>
                  </div>

                  {attentionContacts.length === 0 ? (
                    <div className="bg-background border border-border rounded-xl p-6 text-center text-sm text-muted">
                      All tracked contacts are currently on track for today.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {attentionContacts.map((c) => (
                        <div
                          key={c.id}
                          className="bg-background hover:bg-card-hover border border-border rounded-xl p-4 flex flex-col justify-between gap-3 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div
                              onClick={() => setActiveContactDrawer(c)}
                              className="flex items-center gap-3 cursor-pointer"
                            >
                              <ProgressRingAvatar
                                name={c.fullName}
                                progressPercent={c.cadence.progressPercent}
                                status={c.cadence.status}
                              />
                              <div>
                                <div className="font-semibold text-sm hover:text-primary transition">
                                  {c.fullName}
                                </div>
                                <div className="text-xs text-muted">
                                  {[c.jobTitle, c.company].filter(Boolean).join(' @ ') ||
                                    c.groups.map((g) => g.name).join(', ') ||
                                    'No group'}
                                </div>
                                {c.notes && (
                                  <div className="text-xs text-muted mt-0.5 line-clamp-1">
                                    {c.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
                              {c.cadence.daysSinceContact}d ago · {c.cadence.effectiveIntervalDays}d
                            </span>
                          </div>

                          {c.topics.filter((t) => !t.isCompleted).length > 0 && (
                            <div className="bg-card border border-border rounded-lg p-2.5 text-xs">
                              <span className="text-muted font-medium">To ask: </span>
                              {c.topics
                                .filter((t) => !t.isCompleted)
                                .map((t) => t.content)
                                .join(' · ')}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                onClick={() => handleLogTouchpoint(c.id, 'call')}
                                className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1 shadow-sm hover:opacity-95 transition"
                              >
                                <Phone className="w-3 h-3" /> Call
                              </button>
                              <button
                                onClick={() => handleLogTouchpoint(c.id, 'message')}
                                className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-card-hover border border-border font-medium flex items-center gap-1 transition"
                              >
                                <MessageSquare className="w-3 h-3" /> Message
                              </button>
                              <button
                                onClick={() => handleLogTouchpoint(c.id, 'in_person')}
                                className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-card-hover border border-border font-medium flex items-center gap-1 transition"
                              >
                                <UserCheck className="w-3 h-3" /> In Person
                              </button>
                            </div>
                            <button
                              onClick={() => handleSnooze(c.id, 3)}
                              className="text-muted hover:text-foreground flex items-center gap-1 font-medium"
                            >
                              <Clock className="w-3 h-3" /> Snooze 3d
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Section 2: Incoming Birthdays & People to Call in the Upcoming Week */}
              {(dashboardWidgets.birthdays !== false || dashboardWidgets.upcomingCalls !== false) && (
                <div
                  className={`grid grid-cols-1 ${
                    dashboardWidgets.birthdays !== false && dashboardWidgets.upcomingCalls !== false
                      ? 'lg:grid-cols-2'
                      : 'grid-cols-1'
                  } gap-6`}
                >
                  {/* Incoming Birthdays (Upcoming Week) */}
                  {dashboardWidgets.birthdays !== false && (
                    <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                            <Cake className="w-4 h-4 text-primary" />
                            <span>Incoming Birthdays (Next {birthdayWindowDays}d)</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono">
                              {upcomingBirthdays.length}
                            </span>
                          </h2>
                          <p className="text-xs text-muted mt-0.5">
                            Week starts: {weekDayNames[firstDayOfWeek] || 'Sunday'}
                          </p>
                        </div>
                      </div>
                      {upcomingBirthdays.length === 0 ? (
                        <div className="bg-background border border-border rounded-xl p-5 text-center text-xs text-muted">
                          No birthdays in the upcoming {birthdayWindowDays} days. Add birthdays when
                          creating or viewing a contact.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {upcomingBirthdays.map(({ contact: c, daysUntil, turningAge, formattedDate }) => (
                            <div
                              key={c.id}
                              className="bg-background hover:bg-card-hover border border-border rounded-xl p-3.5 flex items-center justify-between gap-3 transition"
                            >
                              <div
                                onClick={() => setActiveContactDrawer(c)}
                                className="flex items-center gap-3 cursor-pointer"
                              >
                                <ProgressRingAvatar
                                  name={c.fullName}
                                  progressPercent={c.cadence.progressPercent}
                                  status={c.cadence.status}
                                  size="sm"
                                />
                                <div>
                                  <div className="text-sm font-semibold hover:text-primary flex items-center gap-1.5">
                                    <span>{c.fullName}</span>
                                    {turningAge !== null && turningAge > 0 && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-medium">
                                        Turns {turningAge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted">
                                    {formattedDate} ·{' '}
                                    {daysUntil === 0 ? (
                                      <span className="text-emerald-400 font-semibold">Today! 🎉</span>
                                    ) : daysUntil === 1 ? (
                                      <span className="text-primary font-medium">Tomorrow</span>
                                    ) : (
                                      `In ${daysUntil} days`
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs">
                                <button
                                  onClick={() => handleLogTouchpoint(c.id, 'call', 'Birthday call')}
                                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1"
                                >
                                  <Phone className="w-3 h-3" /> Call
                                </button>
                                <button
                                  onClick={() => handleLogTouchpoint(c.id, 'message', 'Birthday wish')}
                                  className="px-2.5 py-1.5 rounded-lg bg-card border border-border font-medium flex items-center gap-1"
                                >
                                  <MessageSquare className="w-3 h-3" /> Wish
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* People to Call in the Upcoming Week */}
                  {dashboardWidgets.upcomingCalls !== false && (
                    <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                            <Phone className="w-4 h-4 text-primary" />
                            <span>Upcoming Calls (Next 7d)</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono">
                              {upcomingWeekContacts.length}
                            </span>
                          </h2>
                          <p className="text-xs text-muted mt-0.5">
                            Scheduled check-ins coming due this week
                          </p>
                        </div>
                      </div>
                      {upcomingWeekContacts.length === 0 ? (
                        <div className="bg-background border border-border rounded-xl p-5 text-center text-xs text-muted">
                          No additional contacts coming due in the next 7 days.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {upcomingWeekContacts.map((c) => (
                            <div
                              key={c.id}
                              className="bg-background hover:bg-card-hover border border-border rounded-xl p-3.5 flex items-center justify-between gap-3 transition"
                            >
                              <div
                                onClick={() => setActiveContactDrawer(c)}
                                className="flex items-center gap-3 cursor-pointer"
                              >
                                <ProgressRingAvatar
                                  name={c.fullName}
                                  progressPercent={c.cadence.progressPercent}
                                  status={c.cadence.status}
                                  size="sm"
                                />
                                <div>
                                  <div className="text-sm font-semibold hover:text-primary">
                                    {c.fullName}
                                  </div>
                                  <div className="text-xs text-muted">
                                    {c.cadence.daysUntilDue <= 0
                                      ? 'Deferred to tomorrow (Smart Spreading)'
                                      : c.cadence.daysUntilDue === 1
                                      ? `Tomorrow (${c.cadence.nextDueDate})`
                                      : `In ${c.cadence.daysUntilDue} days (${c.cadence.nextDueDate})`}{' '}
                                    · {c.groups.map((g) => g.name).join(', ') || `Every ${c.cadence.effectiveIntervalDays}d`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs">
                                <button
                                  onClick={() => handleLogTouchpoint(c.id, 'call')}
                                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1"
                                >
                                  <Phone className="w-3 h-3" /> Call
                                </button>
                                <button
                                  onClick={() => handleLogTouchpoint(c.id, 'message')}
                                  className="px-2.5 py-1.5 rounded-lg bg-card border border-border font-medium flex items-center gap-1"
                                >
                                  <MessageSquare className="w-3 h-3" /> Message
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )}

              {/* Section 3: People Talked to in the Last 30 Days */}
              {dashboardWidgets.recentTalked !== false && (
                <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        <span>Talked to in the Last 30 Days</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono">
                          {recent30DaysContacts.length}
                        </span>
                      </h2>
                      <p className="text-xs text-muted mt-0.5">Recent touchpoints logged across your network</p>
                    </div>
                    <span className="text-xs text-muted">Most recent first</span>
                  </div>
                  {recent30DaysContacts.length === 0 ? (
                    <div className="bg-background border border-border rounded-xl p-5 text-center text-xs text-muted">
                      No logged touchpoints in the last 30 days yet. Click &quot;Call&quot;,
                      &quot;Message&quot;, or &quot;In Person&quot; on any contact to log an interaction.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {recent30DaysContacts.map((c) => {
                        const methodLabel =
                          c.lastTouchpoint?.method === 'call'
                            ? '📞 Call'
                            : c.lastTouchpoint?.method === 'message'
                            ? '💬 Message'
                            : c.lastTouchpoint?.method === 'in_person'
                            ? '🤝 In Person'
                            : '✨ Connected';
                        const whenLabel =
                          c.cadence.daysSinceContact === 0
                            ? 'Today'
                            : c.cadence.daysSinceContact === 1
                            ? 'Yesterday'
                            : `${c.cadence.daysSinceContact}d ago`;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setActiveContactDrawer(c)}
                            className="bg-background hover:bg-card-hover border border-border rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <ProgressRingAvatar
                                name={c.fullName}
                                progressPercent={c.cadence.progressPercent}
                                status={c.cadence.status}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{c.fullName}</div>
                                <div className="text-xs text-muted truncate">
                                  {c.lastTouchpoint?.note
                                    ? `"${c.lastTouchpoint.note}"`
                                    : `Next due: ${c.cadence.nextDueDate}`}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
                                {methodLabel}
                              </span>
                              <div className="text-xs text-muted mt-1">{whenLabel}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Section 4: Scheduled Later (Beyond 7 Days) */}
              {dashboardWidgets.scheduledLater !== false && onTrackContacts.length > 0 && (
                <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                      <span>On Track · Scheduled Later</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono">
                        {onTrackContacts.length}
                      </span>
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {onTrackContacts.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setActiveContactDrawer(c)}
                        className="bg-background hover:bg-card-hover border border-border rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3">
                          <ProgressRingAvatar
                            name={c.fullName}
                            progressPercent={c.cadence.progressPercent}
                            status={c.cadence.status}
                            size="sm"
                          />
                          <div>
                            <div className="text-sm font-semibold">{c.fullName}</div>
                            <div className="text-xs text-muted">
                              Next due: {c.cadence.nextDueDate}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-muted">
                          {c.cadence.daysSinceContact}d / {c.cadence.effectiveIntervalDays}d
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

        {/* TAB 2: CONTACTS DIRECTORY, BULK OPS & MERGER (Apple HIG + SBB Chronometer Baton Signature) */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {/* View Header (layout.md & buttons.md: clear Title-Style heading, single prominent primary action) */}
            <div className="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Contacts Directory{' '}
                  <span className="font-mono text-base font-semibold text-muted tabular-nums">
                    ({contacts.length})
                  </span>
                </h1>
                <p className="text-[13px] text-muted mt-0.5">
                  Manage Google, Local, and vCard contacts, company details, notes, and cadence tracking
                </p>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                {duplicates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMergeModal(true)}
                    className="min-h-[34px] px-3.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1.5 hover:bg-amber-500/25 transition"
                  >
                    <GitMerge className="w-4 h-4" /> Merge Duplicates ({duplicates.length})…
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewContactModal(true)}
                  className="min-h-[34px] px-4 py-1.5 rounded-lg bg-primary hover:opacity-95 text-primary-fg font-semibold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Plus className="w-4 h-4" /> New Local Contact…
                </button>
              </div>
            </div>

            {/* Scope & Filter Bar (searching.md › Scope bars and tokens) */}
            <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
              <div className="flex-1 min-w-[200px] sm:min-w-[240px] min-h-[34px] flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-background border border-border focus-within:border-primary transition">
                <Search className="w-4 h-4 text-muted shrink-0" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter contacts… (⌘K)"
                  aria-label="Filter contacts"
                  className="w-full bg-transparent border-none text-[13px] text-foreground placeholder:text-muted focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear filter"
                    className="min-h-[24px] min-w-[24px] flex items-center justify-center text-muted hover:text-foreground shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full py-0.5">
                {[
                  { id: 'all', label: `All (${contacts.length})` },
                  { id: 'due', label: `Due Today (${attentionContacts.length})` },
                  { id: 'birthdays', label: `Birthdays (${upcomingBirthdays.length})` },
                  {
                    id: 'tracked',
                    label: `Tracked (${contacts.filter((c) => c.keepInTouch).length})`,
                  },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setSearchFilterTab(chip.id as typeof searchFilterTab)}
                    className={`min-h-[32px] px-3 py-1 rounded-lg border text-[12px] font-medium tabular-nums transition ${
                      searchFilterTab === chip.id
                        ? 'bg-foreground text-background border-foreground font-semibold'
                        : 'bg-background border-border text-muted hover:text-foreground hover:bg-card-hover'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}

                <select
                  value={searchFilterGroup === null ? '' : searchFilterGroup}
                  onChange={(e) =>
                    setSearchFilterGroup(e.target.value === '' ? null : Number(e.target.value))
                  }
                  aria-label="Filter by group"
                  className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border text-[12px] font-medium text-foreground"
                >
                  <option value="">All Groups</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>

                {(searchQuery || searchFilterTab !== 'all' || searchFilterGroup !== null) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchFilterTab('all');
                      setSearchFilterGroup(null);
                    }}
                    className="min-h-[32px] px-2.5 py-1 text-[12px] font-semibold text-primary hover:underline"
                  >
                    Reset
                  </button>
                )}

                {/* Columns Customizer Popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColumnsPopover((prev) => !prev)}
                    className="min-h-[32px] px-3 py-1 rounded-lg bg-background border border-border text-[12px] font-medium text-foreground hover:bg-card-hover flex items-center gap-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-muted" />
                    <span>Columns ({effectiveActiveColumns.length})</span>
                  </button>

                  {showColumnsPopover && (
                    <div className="absolute right-0 top-10 z-30 bg-card border border-border rounded-xl p-3.5 shadow-2xl w-72 space-y-2.5 text-[12px] animate-in fade-in duration-100">
                      <div className="font-semibold pb-2 border-b border-border text-foreground flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                          <span>Customize Columns</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={resetColumnSettings}
                            title="Reset to default order"
                            className="text-[11px] text-muted hover:text-foreground flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowColumnsPopover(false)}
                            aria-label="Close column customizer"
                            className="min-h-[24px] min-w-[24px] text-muted hover:text-foreground text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted leading-snug">
                        Toggle visibility, reorder with ▲/▼, or drag column dividers in the table to resize (double-click divider to reset).
                      </p>
                      <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                        {columnOrder.map((colId, index) => {
                          const meta = ALL_COLUMN_METADATA.find((m) => m.id === colId);
                          if (!meta) return null;
                          const isVisible = visibleColumns.includes(colId);
                          return (
                            <div
                              key={colId}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', colId);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const sourceColId = e.dataTransfer.getData('text/plain');
                                if (sourceColId && sourceColId !== colId) {
                                  reorderColumns(sourceColId, colId);
                                }
                              }}
                              className="flex items-center justify-between gap-1 p-1.5 rounded-lg hover:bg-background border border-transparent hover:border-border transition group"
                            >
                              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 select-none">
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={() => toggleColumn(colId)}
                                  className="rounded border-border text-primary focus:ring-0"
                                />
                                <span className={`truncate ${isVisible ? 'text-foreground font-medium' : 'text-muted'}`}>
                                  {meta.label}
                                </span>
                              </label>
                              <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => moveColumnToTop(colId)}
                                  title="Move to 1st place"
                                  className="px-1.5 py-0.5 text-[11px] rounded bg-background border border-border hover:bg-primary hover:text-primary-fg text-muted transition font-mono font-semibold"
                                >
                                  1st
                                </button>
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => moveColumn(colId, 'up')}
                                  title="Move up"
                                  aria-label={`Move ${meta.label} up`}
                                  className="p-1 rounded bg-background border border-border hover:bg-card-hover disabled:opacity-30 text-muted transition"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={index === columnOrder.length - 1}
                                  onClick={() => moveColumn(colId, 'down')}
                                  title="Move down"
                                  aria-label={`Move ${meta.label} down`}
                                  className="p-1 rounded bg-background border border-border hover:bg-card-hover disabled:opacity-30 text-muted transition"
                                >
                                  ▼
                                </button>
                                <span
                                  title="Drag to reorder"
                                  className="p-1 cursor-grab active:cursor-grabbing text-muted/60 hover:text-muted"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedContactIds.length > 0 && (
              <div className="bg-card border border-primary/50 shadow-md rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
                <div className="flex items-center gap-2.5">
                  <span className="sbb-baton sbb-baton-overdue">
                    {selectedContactIds.length} Selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedContactIds([])}
                    className="text-[12px] font-medium text-muted hover:text-foreground underline"
                  >
                    Deselect All
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Flexible Assign to Group Selector */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBulkAction('assign_group', Number(e.target.value));
                      }
                    }}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border text-foreground font-medium text-[12px] cursor-pointer hover:border-primary transition"
                  >
                    <option value="" disabled>
                      + Assign to Group…
                    </option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.intervalDays > 0 ? `${g.intervalDays}d` : 'manual'})
                      </option>
                    ))}
                  </select>

                  {/* Flexible Remove from Group Selector */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBulkAction('remove_group', Number(e.target.value));
                      }
                    }}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border text-foreground font-medium text-[12px] cursor-pointer hover:border-primary transition"
                  >
                    <option value="" disabled>
                      − Remove from Group…
                    </option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleBulkAction('enable_keep_in_touch')}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border hover:bg-card-hover text-foreground font-medium text-[12px]"
                  >
                    Enable Keep in Touch
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction('disable_keep_in_touch')}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border hover:bg-card-hover text-muted hover:text-foreground font-medium text-[12px]"
                  >
                    Disable Keep in Touch
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${selectedContactIds.length} contacts?`)) {
                        handleBulkAction('delete');
                      }
                    }}
                    className="min-h-[32px] px-3 py-1 rounded-lg bg-overdue text-white hover:opacity-90 font-semibold text-[12px] flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                  </button>
                </div>
              </div>
            )}

            {/* Multicolumn Contacts Table (lists-and-tables.md: Title-Style column headings, resizable columns, alternating row backgrounds, SBB Chronometer Cadence Baton signature) */}
            <div className="bg-card border border-border rounded-xl overflow-x-auto w-full scrollbar-thin touch-scroll">
              <table className="w-full text-left border-collapse text-[13px] whitespace-nowrap min-w-max table-fixed">
                <thead>
                  <tr className="border-b border-border bg-background/80 text-muted text-[12px] font-semibold">
                    <th
                      className="p-3 w-10 min-w-[40px] max-w-[40px] border-r border-border/50"
                      style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
                    >
                      <input
                        type="checkbox"
                        aria-label="Select all contacts on this page"
                        checked={
                          paginatedContacts.length > 0 &&
                          paginatedContacts.every((c) => selectedContactIds.includes(c.id))
                        }
                        onChange={(e) => {
                          const pageIds = paginatedContacts.map((c) => c.id);
                          if (e.target.checked) {
                            setSelectedContactIds((prev) =>
                              Array.from(new Set([...prev, ...pageIds]))
                            );
                          } else {
                            setSelectedContactIds((prev) =>
                              prev.filter((id) => !pageIds.includes(id))
                            );
                          }
                        }}
                      />
                    </th>
                    {effectiveActiveColumns.map((colId, idx) => {
                      const meta = ALL_COLUMN_METADATA.find((m) => m.id === colId);
                      const title = meta ? meta.title : colId;
                      const isActions = colId === 'actions';
                      const colWidth = columnWidths[colId] || DEFAULT_COLUMN_WIDTHS[colId] || 140;

                      return (
                        <th
                          key={colId}
                          draggable
                          onDragStart={(e) => {
                            if (resizingCol) {
                              e.preventDefault();
                              return;
                            }
                            e.dataTransfer.setData('text/plain', colId);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const sourceColId = e.dataTransfer.getData('text/plain');
                            if (sourceColId && sourceColId !== colId) {
                              reorderColumns(sourceColId, colId);
                            }
                          }}
                          style={{
                            width: `${colWidth}px`,
                            minWidth: `${colWidth}px`,
                            maxWidth: `${colWidth}px`,
                          }}
                          className={`p-3 relative group/th select-none border-r border-border/50 last:border-r-0 ${
                            isActions ? 'text-right' : ''
                          }`}
                        >
                          <div
                            className={`flex items-center gap-1.5 overflow-hidden ${
                              isActions ? 'justify-end' : ''
                            }`}
                          >
                            <span className="cursor-grab active:cursor-grabbing text-muted/60 group-hover/th:text-foreground shrink-0">
                              ⠿
                            </span>
                            <span className="truncate text-foreground" title={title}>
                              {title}
                            </span>
                            <div className="opacity-0 group-hover/th:opacity-100 flex items-center gap-0.5 ml-auto shrink-0 transition">
                              <button
                                type="button"
                                disabled={idx === 0}
                                title="Shift column left"
                                aria-label={`Shift ${title} column left`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveColumn(colId, 'left');
                                }}
                                className="p-0.5 hover:bg-background rounded text-[11px] text-muted hover:text-foreground disabled:opacity-20"
                              >
                                ◀
                              </button>
                              <button
                                type="button"
                                disabled={idx === effectiveActiveColumns.length - 1}
                                title="Shift column right"
                                aria-label={`Shift ${title} column right`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveColumn(colId, 'right');
                                }}
                                className="p-0.5 hover:bg-background rounded text-[11px] text-muted hover:text-foreground disabled:opacity-20"
                              >
                                ▶
                              </button>
                            </div>
                          </div>

                          {/* Column Resize Handle */}
                          <div
                            onMouseDown={(e) => startColumnResize(colId, e)}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              resetSingleColumnWidth(colId);
                            }}
                            title="Drag to resize column (double-click to reset width)"
                            className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-20 flex items-center justify-center transition ${
                              resizingCol?.id === colId
                                ? 'bg-primary'
                                : 'hover:bg-primary/40 group-hover/th:bg-border/60'
                            }`}
                          >
                            <div className="w-[1.5px] h-3.5 bg-muted/40 group-hover/th:bg-primary" />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {paginatedContacts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={effectiveActiveColumns.length + 1}
                        className="p-8 text-center text-[13px] text-muted"
                      >
                        No contacts match the current filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedContacts.map((c) => {
                      const statusBorder =
                        c.cadence.status === 'overdue'
                          ? 'border-l-[3px] border-l-[#c92121]'
                          : c.cadence.status === 'due_today'
                          ? 'border-l-[3px] border-l-[#b45309]'
                          : c.cadence.status === 'due_soon'
                          ? 'border-l-[3px] border-l-[#0050d8]'
                          : c.cadence.status === 'on_track'
                          ? 'border-l-[3px] border-l-[#15803d]'
                          : 'border-l-[3px] border-l-transparent';

                      const batonClass =
                        c.cadence.status === 'overdue'
                          ? 'sbb-baton sbb-baton-overdue'
                          : c.cadence.status === 'due_today'
                          ? 'sbb-baton sbb-baton-warning'
                          : c.cadence.status === 'due_soon'
                          ? 'sbb-baton sbb-baton-due'
                          : 'sbb-baton sbb-baton-ok';

                      const batonLabel = !c.keepInTouch
                        ? 'Off'
                        : c.cadence.daysUntilDue < 0
                        ? `-${String(Math.abs(c.cadence.daysUntilDue)).padStart(2, '0')}d`
                        : c.cadence.daysUntilDue === 0
                        ? 'Today'
                        : `+${String(c.cadence.daysUntilDue).padStart(2, '0')}d`;

                      return (
                        <tr
                          key={c.id}
                          className={`even:bg-background/35 hover:bg-card-hover transition-colors ${statusBorder}`}
                        >
                          <td
                            className="p-3 w-10 min-w-[40px] max-w-[40px] border-r border-border/40"
                            style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Select ${c.fullName}`}
                              checked={selectedContactIds.includes(c.id)}
                              onChange={(e) =>
                                setSelectedContactIds((prev) =>
                                  e.target.checked
                                    ? [...prev, c.id]
                                    : prev.filter((id) => id !== c.id)
                                )
                              }
                            />
                          </td>
                          {effectiveActiveColumns.map((colId) => {
                            const colWidth =
                              columnWidths[colId] || DEFAULT_COLUMN_WIDTHS[colId] || 140;
                            const cellStyle = {
                              width: `${colWidth}px`,
                              minWidth: `${colWidth}px`,
                              maxWidth: `${colWidth}px`,
                            };

                            switch (colId) {
                              case 'firstName':
                                return (
                                  <td
                                    key="firstName"
                                    style={cellStyle}
                                    onClick={() => setActiveContactDrawer(c)}
                                    className="p-3 font-semibold cursor-pointer overflow-hidden border-r border-border/30"
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      {!effectiveActiveColumns.includes('name') && (
                                        <ProgressRingAvatar
                                          name={c.fullName}
                                          progressPercent={c.cadence.progressPercent}
                                          status={c.cadence.status}
                                          size="sm"
                                        />
                                      )}
                                      <span className="text-[13px] hover:underline truncate">
                                        {c.firstName || '—'}
                                      </span>
                                    </div>
                                  </td>
                                );
                              case 'lastName':
                                return (
                                  <td
                                    key="lastName"
                                    style={cellStyle}
                                    onClick={() => setActiveContactDrawer(c)}
                                    className="p-3 font-semibold cursor-pointer overflow-hidden border-r border-border/30"
                                  >
                                    <span className="text-[13px] hover:underline truncate block">
                                      {c.lastName || '—'}
                                    </span>
                                  </td>
                                );
                              case 'name':
                                return (
                                  <td
                                    key="name"
                                    style={cellStyle}
                                    onClick={() => setActiveContactDrawer(c)}
                                    className="p-3 font-medium cursor-pointer overflow-hidden border-r border-border/30"
                                  >
                                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                                      <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                                        <ProgressRingAvatar
                                          name={c.fullName}
                                          progressPercent={c.cadence.progressPercent}
                                          status={c.cadence.status}
                                          size="sm"
                                        />
                                        <div className="overflow-hidden min-w-0">
                                          <div className="text-[13px] hover:underline font-semibold text-foreground truncate">
                                            {c.fullName}
                                          </div>
                                          {!effectiveActiveColumns.includes('phone') &&
                                            !effectiveActiveColumns.includes('email') && (
                                              <div className="text-muted font-mono text-[11px] truncate">
                                                {c.phone || c.email || '—'}
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                      {c.keepInTouch && (
                                        <span className={`${batonClass} shrink-0`} title={`Cadence status: ${c.cadence.status}`}>
                                          {batonLabel}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              case 'phone':
                                return (
                                  <td
                                    key="phone"
                                    style={cellStyle}
                                    className="p-3 font-mono text-[12px] text-muted tabular-nums truncate border-r border-border/30"
                                    title={c.phone || ''}
                                  >
                                    {c.phone || '—'}
                                  </td>
                                );
                              case 'email':
                                return (
                                  <td
                                    key="email"
                                    style={cellStyle}
                                    className="p-3 font-mono text-[12px] text-muted truncate border-r border-border/30"
                                    title={c.email || ''}
                                  >
                                    {c.email || '—'}
                                  </td>
                                );
                              case 'birthday':
                                return (
                                  <td
                                    key="birthday"
                                    style={cellStyle}
                                    className="p-3 font-mono text-[12px] text-muted tabular-nums truncate border-r border-border/30"
                                  >
                                    {c.birthday
                                      ? `🎂 ${formatDateByPattern(c.birthday, settingsState.dateFormat)}`
                                      : '—'}
                                  </td>
                                );
                              case 'significantDates': {
                                const allDates: Array<{ label: string; date: string }> = [];
                                if (c.importantDates && c.importantDates.length > 0) {
                                  allDates.push(...c.importantDates);
                                } else if (c.significantDate) {
                                  allDates.push({ label: 'Milestone', date: c.significantDate });
                                }
                                return (
                                  <td
                                    key="significantDates"
                                    style={cellStyle}
                                    className="p-2.5 overflow-hidden border-r border-border/30"
                                  >
                                    <div className="flex flex-wrap items-center gap-1 max-h-12 overflow-hidden">
                                      {allDates.length > 0 ? (
                                        allDates.map((d, idx) => (
                                          <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border text-foreground text-[11px] font-medium shrink-0"
                                            title={`${d.label}: ${formatDateByPattern(d.date, settingsState.dateFormat)}`}
                                          >
                                            <span>📅</span>
                                            <span className="font-semibold">{d.label}:</span>
                                            <span className="font-mono">
                                              {formatDateByPattern(d.date, settingsState.dateFormat)}
                                            </span>
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-muted text-[12px]">—</span>
                                      )}
                                    </div>
                                  </td>
                                );
                              }
                              case 'source':
                                return (
                                  <td
                                    key="source"
                                    style={cellStyle}
                                    className="p-3 truncate border-r border-border/30"
                                  >
                                    <span className="px-2 py-0.5 rounded-md bg-background border border-border capitalize font-medium text-[11px] text-foreground">
                                      {c.source}
                                    </span>
                                  </td>
                                );
                              case 'company':
                                return (
                                  <td
                                    key="company"
                                    style={cellStyle}
                                    className="p-3 text-muted font-medium truncate border-r border-border/30"
                                    title={[c.jobTitle, c.company].filter(Boolean).join(' @ ') || ''}
                                  >
                                    {[c.jobTitle, c.company].filter(Boolean).join(' @ ') || '—'}
                                  </td>
                                );
                              case 'notes':
                                return (
                                  <td
                                    key="notes"
                                    style={cellStyle}
                                    className="p-3 text-muted truncate border-r border-border/30"
                                    title={c.notes || ''}
                                  >
                                    {c.notes || '—'}
                                  </td>
                                );
                              case 'groups':
                                return (
                                  <td
                                    key="groups"
                                    style={cellStyle}
                                    className="p-2.5 overflow-hidden border-r border-border/30"
                                  >
                                    <div className="flex flex-wrap items-center gap-1 max-h-12 overflow-hidden">
                                      {c.groups.length > 0 ? (
                                        c.groups.map((g) => (
                                          <span
                                            key={g.id}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border shrink-0 transition"
                                            style={{
                                              backgroundColor: `${g.color}15`,
                                              borderColor: `${g.color}50`,
                                              color: g.color,
                                            }}
                                            title={`${g.name} (Every ${g.intervalDays > 0 ? `${g.intervalDays} days` : 'manual'})`}
                                          >
                                            <span
                                              className="w-1.5 h-1.5 rounded-full shrink-0"
                                              style={{ backgroundColor: g.color }}
                                            />
                                            <span className="truncate max-w-[90px]">{g.name}</span>
                                            <span className="opacity-85 text-[11px] font-mono">
                                              {g.intervalDays > 0 ? `${g.intervalDays}d` : 'man'}
                                            </span>
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-muted text-[12px]">
                                          Default ({c.cadence.effectiveIntervalDays}d)
                                        </span>
                                      )}
                                      {c.customIntervalDays && (
                                        <span
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-background border border-border text-[11px] text-foreground font-mono font-medium"
                                          title={`Custom cadence override: Every ${c.customIntervalDays} days`}
                                        >
                                          ⚡ {c.customIntervalDays}d
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              case 'lastContacted':
                                return (
                                  <td
                                    key="lastContacted"
                                    style={cellStyle}
                                    className="p-3 font-mono text-[12px] text-muted tabular-nums truncate border-r border-border/30"
                                  >
                                    {c.lastContactedAt
                                      ? formatDateByPattern(
                                          c.lastContactedAt,
                                          settingsState.dateFormat
                                        )
                                      : 'Never'}
                                  </td>
                                );
                              case 'keepInTouch':
                                return (
                                  <td
                                    key="keepInTouch"
                                    style={cellStyle}
                                    className="p-3 border-r border-border/30"
                                  >
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await fetch(`/api/contacts/${c.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ keepInTouch: !c.keepInTouch }),
                                        });
                                        loadAllData();
                                      }}
                                      className={`min-h-[28px] px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                                        c.keepInTouch
                                          ? 'bg-foreground text-background'
                                          : 'bg-background border border-border text-muted hover:text-foreground'
                                      }`}
                                    >
                                      {c.keepInTouch ? 'Tracked' : 'Off'}
                                    </button>
                                  </td>
                                );
                              case 'actions':
                                return (
                                  <td key="actions" style={cellStyle} className="p-3 text-right">
                                    <div className="inline-flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setActiveContactDrawer(c)}
                                        className="min-h-[28px] px-2.5 py-1 rounded-md bg-background border border-border text-foreground hover:bg-card-hover font-medium text-[12px] transition"
                                        title="Open Contact Inspector & Log Touchpoint"
                                      >
                                        Log…
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditContact(c)}
                                        className="min-h-[28px] px-2.5 py-1 rounded-md bg-background border border-border hover:bg-card-hover font-medium inline-flex items-center gap-1 text-[12px] text-foreground transition"
                                      >
                                        <Pencil className="w-3 h-3 text-muted" /> Edit…
                                      </button>
                                    </div>
                                  </td>
                                );
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="bg-card border border-border rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[13px]">
              <div className="flex flex-wrap items-center gap-3 text-muted">
                <span className="tabular-nums">
                  Showing{' '}
                  <span className="font-semibold text-foreground">
                    {totalContacts === 0 ? 0 : startIndex + 1}
                  </span>
                  –<span className="font-semibold text-foreground">{endIndex}</span> of{' '}
                  <span className="font-semibold text-foreground">{totalContacts}</span> contacts
                </span>
                <div className="flex items-center gap-1.5 pl-3 border-l border-border">
                  <span>Rows per page:</span>
                  <select
                    value={contactsPageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    aria-label="Rows per page"
                    className="min-h-[28px] px-2 py-0.5 rounded-md bg-background border border-border text-foreground font-semibold text-[12px] cursor-pointer"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setContactsCurrentPage(1)}
                  aria-label="First Page"
                  className="min-h-[28px] px-2 py-1 rounded-md border border-border bg-background hover:bg-card-hover disabled:opacity-30 disabled:pointer-events-none font-medium transition"
                  title="First Page"
                >
                  ««
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setContactsCurrentPage((p) => Math.max(1, p - 1))}
                  className="min-h-[28px] px-2.5 py-1 rounded-md border border-border bg-background hover:bg-card-hover disabled:opacity-30 disabled:pointer-events-none font-medium transition"
                  title="Previous Page"
                >
                  Previous
                </button>

                <span className="px-2 font-medium text-muted tabular-nums">
                  Page <span className="font-semibold text-foreground">{safeCurrentPage}</span> of{' '}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setContactsCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-[28px] px-2.5 py-1 rounded-md border border-border bg-background hover:bg-card-hover disabled:opacity-30 disabled:pointer-events-none font-medium transition"
                  title="Next Page"
                >
                  Next
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setContactsCurrentPage(totalPages)}
                  aria-label="Last Page"
                  className="min-h-[28px] px-2 py-1 rounded-md border border-border bg-background hover:bg-card-hover disabled:opacity-30 disabled:pointer-events-none font-medium transition"
                  title="Last Page"
                >
                  »»
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GROUPS */}
        {activeTab === 'groups' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold">Groups & Cadence Intervals</h1>
              <p className="text-xs text-muted">
                Organize contacts into circles (Family, Workplace 1, Workplace 2) with custom
                intervals
              </p>
            </div>

            <form
              onSubmit={handleCreateGroup}
              className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-3 text-xs"
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-muted mb-1">Group Name</label>
                <input
                  required
                  value={newGroupForm.name}
                  onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
                  placeholder="e.g., Friends - Workplace 1"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground"
                />
              </div>
              <div className="w-56">
                <label className="block text-muted mb-1">Cadence Interval</label>
                <select
                  value={newGroupForm.intervalDays}
                  onChange={(e) =>
                    setNewGroupForm({ ...newGroupForm, intervalDays: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground"
                >
                  <option value={0}>Manual (Contact-level only)</option>
                  <option value={7}>Every Week (7 days)</option>
                  <option value={14}>Every 2 Weeks (14 days)</option>
                  <option value={30}>Every Month (30 days)</option>
                  <option value={60}>Every 2 Months (60 days)</option>
                  <option value={90}>Quarterly (90 days)</option>
                </select>
              </div>
              <div className="w-auto">
                <label className="block text-muted mb-1">Color</label>
                <div className="flex items-center gap-1.5 h-[34px]">
                  {PRESET_GROUP_COLORS.slice(0, 5).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewGroupForm({ ...newGroupForm, color })}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        newGroupForm.color === color
                          ? 'scale-110 ring-2 ring-primary ring-offset-1 ring-offset-card'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={newGroupForm.color}
                    onChange={(e) => setNewGroupForm({ ...newGroupForm, color: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    title="Custom Color"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold hover:opacity-90 transition"
              >
                Create Group
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((g) => {
                const groupContacts = contacts.filter((c) =>
                  c.groups.some((cg) => cg.id === g.id)
                );
                return (
                  <div
                    key={g.id}
                    onClick={() => handleOpenGroupDetails(g)}
                    className="bg-card border border-border hover:border-primary/60 rounded-xl p-5 pt-6 flex flex-col justify-between transition cursor-pointer shadow-xs hover:shadow-md group relative overflow-hidden"
                  >
                    {/* Top colored accent stripe */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: g.color || '#e85d3a' }}
                    />

                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-xs ring-2 ring-background"
                            style={{ backgroundColor: g.color || '#e85d3a' }}
                          />
                          <span className="font-semibold text-sm group-hover:text-primary transition truncate text-foreground">
                            {g.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(g.id, g.name);
                          }}
                          className="text-muted hover:text-overdue p-1 rounded hover:bg-card-hover transition"
                          title="Delete Group"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-xs text-muted mt-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span>⏱️</span>
                          <span>
                            {g.intervalDays > 0
                              ? `Cadence: Every ${g.intervalDays} days`
                              : 'Manual cadence (Contact level)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>👥</span>
                          <span>
                            {groupContacts.length}{' '}
                            {groupContacts.length === 1 ? 'contact' : 'contacts'} linked
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Member Avatars pile & Click prompt */}
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {groupContacts.slice(0, 4).map((c) => (
                          <div
                            key={c.id}
                            className="w-6 h-6 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[10px] font-bold text-foreground"
                            title={c.fullName}
                          >
                            {c.fullName.slice(0, 1)}
                          </div>
                        ))}
                        {groupContacts.length > 4 && (
                          <div className="w-6 h-6 rounded-full bg-muted/20 border-2 border-card flex items-center justify-center text-[9px] font-bold text-muted">
                            +{groupContacts.length - 4}
                          </div>
                        )}
                        {groupContacts.length === 0 && (
                          <span className="text-[11px] text-muted italic">No contacts yet</span>
                        )}
                      </div>

                      <span className="text-[11px] font-medium text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Manage & Edit →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: RELATIONSHIP MAP */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">Relationship Map</h1>
              <p className="text-xs text-muted">
                Link spouses, parents/children, siblings, and coworkers to enrich reminders and
                visualize your network
              </p>
            </div>

            {(() => {
              const filteredContactsForA = contacts.filter((c) => {
                if (newRelForm.contactAId && Number(newRelForm.contactAId) === c.id) return true;
                if (!personASearch.trim()) return true;
                const q = personASearch.toLowerCase();
                return (
                  c.fullName.toLowerCase().includes(q) ||
                  (c.company && c.company.toLowerCase().includes(q)) ||
                  (c.email && c.email.toLowerCase().includes(q)) ||
                  (c.phone && c.phone.includes(q))
                );
              });

              const filteredContactsForB = contacts.filter((c) => {
                if (newRelForm.contactBId && Number(newRelForm.contactBId) === c.id) return true;
                if (!personBSearch.trim()) return true;
                const q = personBSearch.toLowerCase();
                return (
                  c.fullName.toLowerCase().includes(q) ||
                  (c.company && c.company.toLowerCase().includes(q)) ||
                  (c.email && c.email.toLowerCase().includes(q)) ||
                  (c.phone && c.phone.includes(q))
                );
              });

              return (
                <form
                  onSubmit={handleCreateRelationship}
                  className="bg-card border border-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-muted font-medium">Person A</label>
                      <input
                        type="text"
                        placeholder="Search A..."
                        value={personASearch}
                        onChange={(e) => setPersonASearch(e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-[11px] rounded bg-background border border-border text-foreground"
                      />
                    </div>
                    <select
                      value={newRelForm.contactAId}
                      onChange={(e) => setNewRelForm({ ...newRelForm, contactAId: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                    >
                      <option value="">Select contact ({filteredContactsForA.length})...</option>
                      {filteredContactsForA.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}{c.company ? ` (${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-muted font-medium mb-1">Relationship</label>
                    <select
                      value={newRelForm.type}
                      onChange={(e) => setNewRelForm({ ...newRelForm, type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                    >
                      <option value="spouse">Spouse / Partner</option>
                      <option value="parent_child">Parent of → Child</option>
                      <option value="child_of">Child of → Parent</option>
                      <option value="family">Family / Relative</option>
                      <option value="sibling">Sibling</option>
                      <option value="friend">Friend</option>
                      <option value="coworker">Coworker</option>
                      <option value="introduced_by">Introduced By</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-muted font-medium">Person B</label>
                      <input
                        type="text"
                        placeholder="Search B..."
                        value={personBSearch}
                        onChange={(e) => setPersonBSearch(e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-[11px] rounded bg-background border border-border text-foreground"
                      />
                    </div>
                    <select
                      value={newRelForm.contactBId}
                      onChange={(e) => setNewRelForm({ ...newRelForm, contactBId: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                    >
                      <option value="">Select contact ({filteredContactsForB.length})...</option>
                      {filteredContactsForB.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}{c.company ? ` (${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Link Contacts
                  </button>
                </form>
              );
            })()}

            {/* 2D SVG Relationship Graph */}
            <div className="bg-card border border-border rounded-xl p-4 h-[420px] flex items-center justify-center">
              {graph.nodes.length === 0 ? (
                <span className="text-xs text-muted">
                  Add contacts and link relationships above to visualize your network graph.
                </span>
              ) : (
                <svg className="w-full h-full" viewBox="0 0 700 380">
                  {graph.edges.map((edge) => {
                    const idxA = graph.nodes.findIndex((n) => n.id === edge.source);
                    const idxB = graph.nodes.findIndex((n) => n.id === edge.target);
                    if (idxA === -1 || idxB === -1) return null;
                    const angleA = (idxA / graph.nodes.length) * Math.PI * 2;
                    const angleB = (idxB / graph.nodes.length) * Math.PI * 2;
                    const x1 = 350 + Math.cos(angleA) * 140;
                    const y1 = 190 + Math.sin(angleA) * 120;
                    const x2 = 350 + Math.cos(angleB) * 140;
                    const y2 = 190 + Math.sin(angleB) * 120;
                    return (
                      <g key={edge.id}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="var(--tp-border)"
                          strokeWidth="2"
                        />
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 - 6}
                          fill="var(--tp-muted)"
                          fontSize="11"
                          textAnchor="middle"
                        >
                          {edge.type.replace('_', ' ')}
                        </text>
                      </g>
                    );
                  })}
                  {graph.nodes.map((node, idx) => {
                    const angle = (idx / graph.nodes.length) * Math.PI * 2;
                    const x = 350 + Math.cos(angle) * 140;
                    const y = 190 + Math.sin(angle) * 120;
                    const stroke =
                      node.status === 'overdue'
                        ? 'var(--tp-overdue)'
                        : node.status === 'due_soon'
                        ? 'var(--tp-warning)'
                        : 'var(--tp-success)';
                    return (
                      <g key={node.id} transform={`translate(${x},${y})`}>
                        <circle r="24" fill="var(--tp-card)" stroke={stroke} strokeWidth="3" />
                        <text
                          dy="4"
                          fill="var(--tp-text)"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {node.fullName.slice(0, 2).toUpperCase()}
                        </text>
                        <text
                          dy="38"
                          fill="var(--tp-text)"
                          fontSize="12"
                          textAnchor="middle"
                        >
                          {node.fullName}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: OUTBOUND GOOGLE CALENDAR PUSH & BUILT-IN SCHEDULE */}
        {activeTab === 'calendar' && (
          <div className="space-y-6 max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">Calendar & Outbound Google Calendar Push</h1>
                <p className="text-xs text-muted">
                  Push your upcoming touchpoints outward to Google Calendar, or download a local
                  .ics snapshot file.
                </p>
              </div>
              <a
                href={`/api/calendar/${settingsState.icalSecretToken || 'token'}.ics`}
                download="touchpoint-schedule.ics"
                className="px-3.5 py-2 rounded-lg bg-card border border-border text-xs font-medium flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download .ics File
              </a>
            </div>

            {/* Option 3: Outbound Google Calendar Push (Disabled by Default) */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3.5 text-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">
                    Outbound Google Calendar Push (Disabled by Default)
                  </h2>
                  <p className="text-muted mt-0.5">
                    Instead of exposing a localhost URL, Touchpoint can push your upcoming contact
                    due dates outward to your Google Calendar.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(settingsState.googleCalendarPushEnabled)}
                  onClick={async () => {
                    const nextVal = !settingsState.googleCalendarPushEnabled;
                    setSettingsState({ ...settingsState, googleCalendarPushEnabled: nextVal });
                    await fetch('/api/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ googleCalendarPushEnabled: nextVal }),
                    });
                    notify(
                      nextVal
                        ? 'Outbound Google Calendar Push enabled.'
                        : 'Outbound Google Calendar Push disabled.'
                    );
                  }}
                  className={`px-3 py-1.5 rounded-full font-semibold shrink-0 border flex items-center gap-2.5 transition ${
                    settingsState.googleCalendarPushEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:border-rose-500/50'
                  }`}
                >
                  <span
                    className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                      settingsState.googleCalendarPushEnabled ? 'bg-emerald-500' : 'bg-rose-500/60'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${
                        settingsState.googleCalendarPushEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span>
                    {settingsState.googleCalendarPushEnabled ? 'Enabled ✓' : 'Disabled (Default)'}
                  </span>
                </button>
              </div>

              <div className="p-3 rounded-lg bg-background border border-warning/40 text-muted leading-relaxed space-y-1.5">
                <div>
                  <strong className="text-warning">Privacy &amp; OAuth Scope Notice:</strong> Enabling
                  Outbound Google Calendar Push requires the container to make outbound HTTPS
                  connections to Google API URLs (<code className="font-mono">googleapis.com/calendar/v3</code>)
                  using the <code className="font-mono">https://www.googleapis.com/auth/calendar.events</code> OAuth scope. When
                  disabled, zero requests are made to Google Calendar.
                </div>
                <div className="text-[11px] text-foreground/90 pt-1 border-t border-border/60">
                  <strong>Important (Avoid &ldquo;Insufficient Permission&rdquo;):</strong>{' '}
                  If you connected Google Contacts <em>before</em> enabling this toggle, your existing Refresh Token only has the <code className="font-mono">contacts.readonly</code> permission. After enabling this toggle, make sure <strong>Google Calendar API</strong> is enabled in your Google Cloud project and click <strong>Re-Authorize Google (Grant Calendar Scope)</strong> below so Google issues a token with <code className="font-mono">calendar.events</code> permission.
                </div>
              </div>

              {settingsState.googleCalendarPushEnabled && (
                <div className="flex flex-wrap items-end gap-3 pt-1">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-muted mb-1">
                      Target Google Calendar ID (default: primary)
                    </label>
                    <input
                      value={settingsState.googleCalendarId || 'primary'}
                      onChange={(e) =>
                        setSettingsState({ ...settingsState, googleCalendarId: e.target.value })
                      }
                      placeholder="primary"
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch('/api/settings', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          googleCalendarPushEnabled: true,
                          googleCalendarId: settingsState.googleCalendarId || 'primary',
                        }),
                      });
                      const currentRedirect = `${window.location.origin}/api/google`.replace(
                        '0.0.0.0',
                        'localhost'
                      );
                      const res = await fetch(
                        `/api/google?redirect_uri=${encodeURIComponent(currentRedirect)}`
                      );
                      const data = await res.json();
                      if (res.ok && data.authUrl) {
                        window.location.href = data.authUrl;
                      } else {
                        notify(
                          data.error ||
                            'Configure Google Client ID & Secret in Settings → 3. Google Contacts Integration first'
                        );
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg bg-background hover:bg-card-hover border border-primary/50 text-primary font-semibold flex items-center gap-1.5 transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Re-Authorize Google (Grant Calendar Scope)
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch('/api/settings', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          googleCalendarId: settingsState.googleCalendarId || 'primary',
                        }),
                      });
                      const res = await fetch('/api/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'push_calendar' }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        notify(`Pushed ${data.pushed} touchpoint events to Google Calendar.`);
                      } else {
                        notify(data.error || 'Calendar push failed');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Push Upcoming Dates to Google Calendar
                  </button>
                </div>
              )}
            </div>

            {/* Built-In Schedule Agenda */}
            <div className="bg-card border border-border rounded-xl divide-y divide-border text-xs">
              {trackedContactsSortedByDue.length === 0 ? (
                <div className="p-6 text-center text-muted">
                  No tracked contacts scheduled yet. Enable &quot;Keep in Touch&quot; on contacts to
                  see their upcoming dates here.
                </div>
              ) : (
                trackedContactsSortedByDue.map((c) => (
                  <div key={c.id} className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ProgressRingAvatar
                        name={c.fullName}
                        progressPercent={c.cadence.progressPercent}
                        status={c.cadence.status}
                        size="sm"
                      />
                      <div>
                        <div className="font-semibold text-sm">{c.fullName}</div>
                        <div className="text-muted">
                          Every {c.cadence.effectiveIntervalDays} days ·{' '}
                          {c.groups.map((g) => g.name).join(', ') || 'Personal'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{c.cadence.nextDueDate}</div>
                      <div className="text-muted">
                        {c.cadence.daysUntilDue < 0
                          ? `${Math.abs(c.cadence.daysUntilDue)}d overdue`
                          : c.cadence.daysUntilDue === 0
                          ? 'Due today'
                          : `In ${c.cadence.daysUntilDue} days`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: SETTINGS (Single-Expand Accordion with Module & Global Save) */}
        {activeTab === 'settings' && (
          <div className="space-y-4 max-w-3xl text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
              <div>
                <h1 className="text-xl font-bold">Settings</h1>
                <p className="text-xs text-muted">
                  Click any module below to expand and edit (expanding one collapses the others)
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveAllSettings}
                className="px-3.5 py-2 rounded-xl bg-primary text-primary-fg font-semibold flex items-center gap-1.5 shadow-xs text-xs hover:opacity-90 transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Save All Settings
              </button>
            </div>

            {/* Section 1: Appearance, Regional Preferences & Cadence Limits */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSettingsSection((prev) => (prev === 1 ? null : 1))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <span className="text-sm font-bold text-foreground">
                  1. Appearance, Regional Preferences &amp; Cadence Limits
                </span>
                <span className="text-muted text-sm font-mono">
                  {openSettingsSection === 1 ? '▾' : '▸'}
                </span>
              </button>

              {openSettingsSection === 1 && (
                <div className="px-5 pb-5 pt-1 space-y-4 border-t border-border">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2">
                    {[
                      { id: 'sbb', label: 'SBB Dispatch', color: '#d92b2b' },
                      { id: 'leadflow', label: 'Electric Cobalt', color: '#2b7fff' },
                      { id: 'studio', label: 'Warm Studio', color: '#e85d3a' },
                      { id: 'nordic', label: 'Nordic Pine', color: '#10b981' },
                      { id: 'midnight', label: 'Midnight Indigo', color: '#6366f1' },
                      { id: 'kyoto', label: 'Kyoto Ink', color: '#d97706' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          handleSwitchTheme(t.id as typeof themePreset, themeMode)
                        }
                        className={`p-3 rounded-lg border text-left flex items-center gap-2 transition ${
                          themePreset === t.id
                            ? 'border-primary bg-primary/10 font-semibold text-foreground'
                            : 'border-border hover:border-border/80'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: t.color }}
                        />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                    <TimezoneSelect
                      id="settings-timezone"
                      label="Timezone"
                      value={settingsState.timezone || 'UTC'}
                      onChange={(tz) => setSettingsState({ ...settingsState, timezone: tz })}
                    />
                    <CountryCodeSelect
                      id="settings-country-code"
                      label="Default Country Code"
                      value={settingsState.defaultCountryCode || '+1'}
                      onChange={(code) =>
                        setSettingsState({ ...settingsState, defaultCountryCode: code })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border">
                    <div>
                      <label className="block text-muted mb-1 font-medium">
                        Date Display Format
                      </label>
                      <select
                        value={settingsState.dateFormat || 'YYYY-MM-DD'}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            dateFormat: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground font-medium"
                      >
                        <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-17)</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 17/10/2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/17/2026)</option>
                        <option value="DD-MM-YYYY">DD-MM-YYYY (e.g. 17-10-2026)</option>
                        <option value="YYYY/MM/DD">YYYY/MM/DD (e.g. 2026/10/17)</option>
                        <option value="DD.MM.YYYY">DD.MM.YYYY (e.g. 17.10.2026)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-muted mb-1">
                        First Day of the Week (Default: Sunday)
                      </label>
                      <select
                        value={Number(settingsState.firstDayOfWeek ?? 0)}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            firstDayOfWeek: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                      >
                        <option value={0}>Sunday (Default)</option>
                        <option value={1}>Monday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-muted mb-1">
                        Incoming Birthdays Window (Days)
                      </label>
                      <select
                        value={Number(settingsState.birthdayDaysAdvance || 7)}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            birthdayDaysAdvance: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                      >
                        <option value={7}>Upcoming Week (7 days)</option>
                        <option value={14}>Next 2 Weeks (14 days)</option>
                        <option value={30}>Next Month (30 days)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-muted mb-1">
                        Daily Due Cap (Smart Spreading)
                      </label>
                      <select
                        value={Number(settingsState.maxDailyDue || 3)}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            maxDailyDue: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                      >
                        <option value={2}>Max 2 per day</option>
                        <option value={3}>Max 3 per day (Default)</option>
                        <option value={5}>Max 5 per day</option>
                        <option value={10}>Max 10 per day</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 lg:col-span-4 p-3 rounded-lg bg-card/60 border border-border flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5 max-w-lg">
                        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <span>Interval Fuzziness (Natural Variance)</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            Anti-Rigid
                          </span>
                        </div>
                        <p className="text-[11px] text-muted">
                          Vary reminder intervals naturally (e.g. ±15% variance: 14 days becomes 11–17 days) so touchpoints don&apos;t feel robotic.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {Boolean(settingsState.cadenceFuzzinessEnabled) && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted text-[11px]">Variance:</span>
                            <select
                              value={Number(settingsState.cadenceFuzzinessPercent || 15)}
                              onChange={(e) =>
                                setSettingsState({
                                  ...settingsState,
                                  cadenceFuzzinessPercent: Number(e.target.value),
                                })
                              }
                              className="px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                            >
                              <option value={10}>±10%</option>
                              <option value={15}>±15% (Recommended)</option>
                              <option value={20}>±20%</option>
                              <option value={25}>±25%</option>
                            </select>
                          </div>
                        )}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(settingsState.cadenceFuzzinessEnabled)}
                          onClick={() =>
                            setSettingsState({
                              ...settingsState,
                              cadenceFuzzinessEnabled: !settingsState.cadenceFuzzinessEnabled,
                            })
                          }
                          className={`w-10 h-6 flex items-center rounded-full p-1 transition duration-200 cursor-pointer ${
                            settingsState.cadenceFuzzinessEnabled
                              ? 'bg-primary justify-end'
                              : 'bg-muted/30 justify-start'
                          }`}
                        >
                          <div className="bg-white w-4 h-4 rounded-full shadow-md transform" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/settings', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            timezone: settingsState.timezone || 'UTC',
                            defaultCountryCode: settingsState.defaultCountryCode || '+1',
                            dateFormat: settingsState.dateFormat || 'YYYY-MM-DD',
                            firstDayOfWeek: Number(settingsState.firstDayOfWeek ?? 0),
                            birthdayDaysAdvance: Number(settingsState.birthdayDaysAdvance || 7),
                            maxDailyDue: Number(settingsState.maxDailyDue || 3),
                            cadenceFuzzinessEnabled: Boolean(settingsState.cadenceFuzzinessEnabled),
                            cadenceFuzzinessPercent: Number(settingsState.cadenceFuzzinessPercent || 15),
                          }),
                        });
                        await loadAllData();
                        notify('Saved Appearance, Regional & Cadence Settings.');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-primary text-primary-fg font-semibold"
                    >
                      Save Appearance &amp; Cadence Settings
                    </button>
                  </div>

                  {/* Two-Factor Authentication (2FA) */}
                  <div className="pt-3 border-t border-border">
                    <div className="p-4 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">Two-Factor Authentication (2FA / TOTP)</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              currentUser?.totpEnabled
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                : 'bg-background border-border text-muted'
                            }`}
                          >
                            {currentUser?.totpEnabled ? 'Enabled ✓' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-muted text-xs mt-0.5">
                          Protect your Touchpoint account with an authenticator app (Google Authenticator, 1Password, Bitwarden).
                        </p>
                      </div>

                      <div>
                        {currentUser?.totpEnabled ? (
                          <button
                            type="button"
                            onClick={() => setShow2faDisableModal(true)}
                            className="px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 font-medium transition"
                          >
                            Disable 2FA
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStart2faSetup}
                            className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold hover:opacity-95 transition shadow-xs"
                          >
                            Enable 2FA...
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Notification Channels: Telegram Bot & Outgoing Webhook */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSettingsSection((prev) => (prev === 2 ? null : 2))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    2. Notification Channels: Telegram Bot &amp; Outgoing Webhook
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      settingsState.telegramBotToken || settingsState.webhookEnabled
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                        : 'bg-background border-border text-muted'
                    }`}
                  >
                    {settingsState.telegramBotToken && settingsState.webhookEnabled
                      ? 'Telegram & Webhook Active'
                      : settingsState.telegramBotToken
                      ? 'Telegram Active'
                      : settingsState.webhookEnabled
                      ? 'Webhook Active'
                      : 'Optional'}
                  </span>
                </div>
                <span className="text-muted text-sm font-mono">
                  {openSettingsSection === 2 ? '▾' : '▸'}
                </span>
              </button>

              {openSettingsSection === 2 && (
                <div className="px-5 pb-5 pt-2 space-y-4 border-t border-border">
                  <p className="text-muted">
                    Configure Telegram, an Outgoing Webhook (n8n, Home Assistant, Slack, Discord,
                    ntfy, or custom endpoint), or both simultaneously.
                  </p>

                  {/* Channel A: Telegram Bot */}
                  <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-foreground">
                        Channel A: Telegram Bot (Outbound Long-Polling)
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                          settingsState.telegramBotToken && settingsState.telegramChatId
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                            : 'bg-card border-border text-muted'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            settingsState.telegramBotToken && settingsState.telegramChatId
                              ? 'bg-emerald-400'
                              : 'bg-zinc-500'
                          }`}
                        />
                        {settingsState.telegramBotToken && settingsState.telegramChatId
                          ? 'Configured ✓'
                          : 'Optional'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-muted mb-1">Bot Token (from @BotFather)</label>
                        <input
                          type="password"
                          value={settingsState.telegramBotToken || ''}
                          onChange={(e) =>
                            setSettingsState({ ...settingsState, telegramBotToken: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-card border border-border"
                        />
                      </div>
                      <div>
                        <label className="block text-muted mb-1">Owner Chat ID</label>
                        <input
                          value={settingsState.telegramChatId || ''}
                          onChange={(e) =>
                            setSettingsState({ ...settingsState, telegramChatId: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-card border border-border"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch('/api/settings', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              telegramBotToken: settingsState.telegramBotToken,
                              telegramChatId: settingsState.telegramChatId,
                            }),
                          });
                          const res = await fetch('/api/telegram', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'start_poller',
                              botToken: settingsState.telegramBotToken,
                              chatId: settingsState.telegramChatId,
                            }),
                          });
                          const data = await res.json().catch(() => ({}));
                          notify(
                            res.ok
                              ? 'Saved & started Telegram Long-Polling.'
                              : data.error || 'Failed to start Telegram Long-Polling'
                          );
                        }}
                        className="px-3 py-2 rounded-lg bg-primary text-primary-fg font-semibold"
                      >
                        Save &amp; Start Telegram Poller
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch('/api/telegram', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'test_message',
                              botToken: settingsState.telegramBotToken,
                              chatId: settingsState.telegramChatId,
                            }),
                          });
                          const data = await res.json().catch(() => ({}));
                          notify(
                            res.ok
                              ? 'Test Telegram message sent!'
                              : data.error || 'Failed to send test message'
                          );
                        }}
                        className="px-3 py-2 rounded-lg bg-card border border-border flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Send Test Telegram Message
                      </button>
                    </div>

                    {settingsState.telegramBindingToken && (
                      <div className="p-3 rounded-xl bg-card border border-primary/30 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                            <span>🔗 1-Click Telegram Deep Link Binding</span>
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-primary/20 text-primary border border-primary/30 font-medium">
                              Multi-User
                            </span>
                          </span>
                          <span className="text-[10px] text-muted">Auto-binds your Chat ID</span>
                        </div>
                        <p className="text-[11px] text-muted">
                          Open or share this personal deep link to link your Telegram account to Touchpoint automatically without manually finding your Chat ID:
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            type="text"
                            value={`https://t.me/Touchpoint_Bot?start=bind_${settingsState.telegramBindingToken}`}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-mono text-muted select-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`https://t.me/Touchpoint_Bot?start=bind_${settingsState.telegramBindingToken}`);
                              notify('Telegram binding link copied to clipboard!');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-card-hover border border-border text-foreground font-medium text-xs shrink-0"
                          >
                            Copy Link
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Channel B: Outgoing Webhook */}
                  <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-foreground">
                          Channel B: Outgoing Webhook (HTTP POST JSON)
                        </div>
                        <p className="text-muted mt-0.5">
                          Sends structured JSON payloads of due/overdue contacts to your custom URL.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(settingsState.webhookEnabled)}
                        onClick={async () => {
                          const nextVal = !settingsState.webhookEnabled;
                          setSettingsState({ ...settingsState, webhookEnabled: nextVal });
                          await fetch('/api/settings', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ webhookEnabled: nextVal }),
                          });
                          notify(
                            nextVal ? 'Outgoing Webhook enabled.' : 'Outgoing Webhook disabled.'
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full font-semibold border flex items-center gap-2.5 transition ${
                          settingsState.webhookEnabled
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:border-rose-500/50'
                        }`}
                      >
                        <span
                          className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                            settingsState.webhookEnabled ? 'bg-emerald-500' : 'bg-rose-500/60'
                          }`}
                        >
                          <span
                            className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${
                              settingsState.webhookEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </span>
                        <span>
                          {settingsState.webhookEnabled ? 'Enabled ✓' : 'Disabled (Default)'}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-muted mb-1">
                          Webhook Target URL (POST endpoint)
                        </label>
                        <input
                          value={settingsState.webhookUrl || ''}
                          onChange={(e) =>
                            setSettingsState({ ...settingsState, webhookUrl: e.target.value })
                          }
                          placeholder="https://your-webhook.example.com/hook"
                          className="w-full px-3 py-2 rounded-lg bg-card border border-border font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-muted mb-1">
                          Signing Secret (Optional HMAC-SHA256 in X-Touchpoint-Signature)
                        </label>
                        <input
                          type="password"
                          value={settingsState.webhookSecret || ''}
                          onChange={(e) =>
                            setSettingsState({ ...settingsState, webhookSecret: e.target.value })
                          }
                          placeholder="Optional secret for verifying webhook authenticity"
                          className="w-full px-3 py-2 rounded-lg bg-card border border-border"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch('/api/settings', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              webhookEnabled: Boolean(settingsState.webhookEnabled),
                              webhookUrl: settingsState.webhookUrl || null,
                              webhookSecret: settingsState.webhookSecret || null,
                            }),
                          });
                          notify('Saved Outgoing Webhook settings.');
                        }}
                        className="px-3 py-2 rounded-lg bg-primary text-primary-fg font-semibold"
                      >
                        Save Webhook Settings
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch('/api/settings', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              webhookUrl: settingsState.webhookUrl || null,
                              webhookSecret: settingsState.webhookSecret || null,
                            }),
                          });
                          const res = await fetch('/api/webhook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'test_webhook' }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            notify(
                              `Test Webhook delivered (HTTP ${data.status}, ${data.contactsCount} due/overdue contacts included).`
                            );
                          } else {
                            notify(data.error || 'Failed to send test webhook');
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-card border border-border flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Send Test Webhook
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Google Contacts Integration & Calendar Push */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSettingsSection((prev) => (prev === 3 ? null : 3))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    3. Google Contacts Integration (Strict Additive-Only Sync)
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-semibold border text-[11px] flex items-center gap-1.5 ${
                      settingsState.googleRefreshToken
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                        : 'bg-background border-border text-muted'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        settingsState.googleRefreshToken ? 'bg-emerald-400' : 'bg-zinc-500'
                      }`}
                    />
                    {settingsState.googleRefreshToken ? 'Connected ✓' : 'Not Connected'}
                  </span>
                </div>
                <span className="text-muted text-sm font-mono">
                  {openSettingsSection === 3 ? '▾' : '▸'}
                </span>
              </button>

              {openSettingsSection === 3 && (
                <div className="px-5 pb-5 pt-2 space-y-3 border-t border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-muted">
                      Pulls only NEW contacts from Google. Never overwrites existing contacts or deletes
                      local Touchpoint contacts.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenHelpSection(1);
                        setActiveTab('help');
                      }}
                      className="text-primary hover:underline font-medium flex items-center gap-1"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> See Step-by-Step Guide →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-muted mb-1">Google OAuth Client ID</label>
                      <input
                        value={settingsState.googleClientId || ''}
                        onChange={(e) =>
                          setSettingsState({ ...settingsState, googleClientId: e.target.value })
                        }
                        placeholder="xxx.apps.googleusercontent.com"
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                      />
                    </div>
                    <div>
                      <label className="block text-muted mb-1">Google OAuth Client Secret</label>
                      <input
                        type="password"
                        value={settingsState.googleClientSecret || ''}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            googleClientSecret: e.target.value,
                          })
                        }
                        placeholder="GOCSPX-..."
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-muted mb-1">
                      Google OAuth Refresh Token (Auto-filled on Authorize, or paste from OAuth Playground)
                    </label>
                    <input
                      type="password"
                      value={settingsState.googleRefreshToken || ''}
                      onChange={(e) =>
                        setSettingsState({
                          ...settingsState,
                          googleRefreshToken: e.target.value,
                        })
                      }
                      placeholder="1//04..."
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-muted">
                        Auto-Sync Cron Expression (or pick a quick preset below)
                      </label>
                      <a
                        href="https://crontab.guru/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        Need help? Open crontab.guru ↗
                      </a>
                    </div>
                    <input
                      value={settingsState.googleSyncInterval || 'manual'}
                      onChange={(e) =>
                        setSettingsState({
                          ...settingsState,
                          googleSyncInterval: e.target.value,
                        })
                      }
                      placeholder="e.g. 0 3 * * * (Daily 03:00) or manual"
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {CRON_PRESETS.map((preset) => (
                        <button
                          key={preset.expr}
                          type="button"
                          onClick={() =>
                            setSettingsState({ ...settingsState, googleSyncInterval: preset.expr })
                          }
                          className={`px-2.5 py-1 rounded border text-xs ${
                            settingsState.googleSyncInterval === preset.expr
                              ? 'border-primary bg-primary text-primary-fg font-medium'
                              : 'border-border bg-background text-muted hover:text-foreground'
                          }`}
                        >
                          {preset.label} ({preset.expr})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-muted">Authorized Redirect URI to paste in Google Cloud: </span>
                      <code className="font-mono text-foreground font-semibold">
                        {typeof window !== 'undefined'
                          ? `${window.location.origin}/api/google`.replace('0.0.0.0', 'localhost')
                          : 'http://localhost:3000/api/google'}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          const uri = `${window.location.origin}/api/google`.replace(
                            '0.0.0.0',
                            'localhost'
                          );
                          navigator.clipboard.writeText(uri);
                          notify('Copied redirect URI to clipboard!');
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-card border border-border hover:bg-card-hover text-muted hover:text-foreground text-[11px] font-medium"
                    >
                      Copy URI
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/settings', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            googleClientId: settingsState.googleClientId,
                            googleClientSecret: settingsState.googleClientSecret,
                            googleRefreshToken: settingsState.googleRefreshToken,
                            googleSyncInterval: settingsState.googleSyncInterval,
                          }),
                        });
                        notify('Saved Google credentials & cron settings.');
                      }}
                      className="px-3 py-2 rounded-lg bg-primary text-primary-fg font-semibold"
                    >
                      Save Google Settings
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/settings', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            googleClientId: settingsState.googleClientId,
                            googleClientSecret: settingsState.googleClientSecret,
                          }),
                        });
                        const currentRedirect = `${window.location.origin}/api/google`.replace(
                          '0.0.0.0',
                          'localhost'
                        );
                        const res = await fetch(
                          `/api/google?redirect_uri=${encodeURIComponent(currentRedirect)}`
                        );
                        const data = await res.json();
                        if (res.ok && data.authUrl) {
                          window.location.href = data.authUrl;
                        } else {
                          notify(data.error || 'Save Client ID & Secret first before authorizing');
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-background border border-border font-medium"
                    >
                      Authorize with Google (OAuth)
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const currentRedirect = `${window.location.origin}/api/google`.replace(
                          '0.0.0.0',
                          'localhost'
                        );
                        const res = await fetch('/api/google', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'test_connection',
                            redirect_uri: currentRedirect,
                          }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          notify(
                            `Google Connection Verified ✓ (People API accessible, ${data.totalGoogleContactsSampled} contacts found)`
                          );
                        } else {
                          notify(data.error || 'Google connection test failed');
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-background border border-border flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Test Connection
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const currentRedirect = `${window.location.origin}/api/google`.replace(
                          '0.0.0.0',
                          'localhost'
                        );
                        const res = await fetch('/api/google', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ redirect_uri: currentRedirect }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          loadAllData();
                          notify(
                            `Synced: ${data.imported} new imported, ${data.skippedExisting} existing untouched.`
                          );
                        } else {
                          notify(data.error || 'Sync failed');
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-background border border-border flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Sync New Contacts Now
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Container Logging, vCard (.vcf) & Full Backup */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSettingsSection((prev) => (prev === 4 ? null : 4))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <span className="text-sm font-bold text-foreground">
                  4. Container Logging, vCard (.vcf) &amp; Full Backup
                </span>
                <span className="text-muted text-sm font-mono">
                  {openSettingsSection === 4 ? '▾' : '▸'}
                </span>
              </button>

              {openSettingsSection === 4 && (
                <div className="px-5 pb-5 pt-3 space-y-4 border-t border-border">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-muted">Container Log Level:</span>
                      <select
                        value={settingsState.logLevel || 'info'}
                        onChange={async (e) => {
                          const level = e.target.value;
                          setSettingsState({ ...settingsState, logLevel: level });
                          await fetch('/api/settings', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ logLevel: level }),
                          });
                          notify(`Container log level set to ${level}.`);
                        }}
                        className="px-3 py-1.5 rounded bg-background border border-border"
                      >
                        <option value="debug">debug</option>
                        <option value="info">info</option>
                        <option value="warn">warn</option>
                        <option value="error">error</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="/api/backup?format=json"
                        download="touchpoint-backup.json"
                        className="px-3 py-2 rounded-lg bg-background border border-border flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Export JSON Backup
                      </a>
                      <a
                        href="/api/backup?format=vcf"
                        download="touchpoint-contacts.vcf"
                        className="px-3 py-2 rounded-lg bg-background border border-border flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Export .vcf
                      </a>
                    </div>
                  </div>

                  {/* Automated Database Snapshots (Rolling Retention) */}
                  <div className="pt-3 border-t border-border space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-foreground">
                          Point-in-Time SQLite Database Snapshots
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          Atomic, zero-downtime snapshots created using SQLite native VACUUM INTO. Retains 7 daily, 4 weekly, 3 monthly.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateSnapshot}
                        className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1.5 shadow-xs hover:opacity-95 transition text-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Create Snapshot Now
                      </button>
                    </div>

                    <div className="border border-border rounded-lg overflow-hidden bg-background">
                      {snapshots.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted">
                          No snapshot files created yet. Click &quot;Create Snapshot Now&quot; to generate an instant point-in-time backup.
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-card/60 text-muted uppercase text-[10px]">
                              <th className="p-2.5">Snapshot File</th>
                              <th className="p-2.5">Type</th>
                              <th className="p-2.5">Size</th>
                              <th className="p-2.5">Created At</th>
                              <th className="p-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {snapshots.map((snap) => (
                              <tr key={snap.filename} className="hover:bg-card-hover transition">
                                <td className="p-2.5 font-mono text-foreground font-medium">{snap.filename}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                                    snap.type === 'daily'
                                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                      : snap.type === 'weekly'
                                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                      : snap.type === 'monthly'
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                      : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
                                  }`}>
                                    {snap.type}
                                  </span>
                                </td>
                                <td className="p-2.5 text-muted">
                                  {Math.round(snap.sizeBytes / 1024)} KB
                                </td>
                                <td className="p-2.5 text-muted font-mono">
                                  {new Date(snap.createdAt).toLocaleString()}
                                </td>
                                <td className="p-2.5 text-right">
                                  <a
                                    href={`/api/backup/snapshots/${encodeURIComponent(snap.filename)}`}
                                    download={snap.filename}
                                    className="px-2.5 py-1 rounded bg-card border border-border hover:bg-card-hover text-primary font-medium text-[11px] inline-flex items-center gap-1 transition"
                                  >
                                    <Download className="w-3 h-3" /> Download
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Danger Zone: Factory Reset / Delete All Data */}
            <div className="bg-card border border-rose-500/40 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSettingsSection((prev) => (prev === 5 ? null : 5))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-rose-500/5 transition"
              >
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span className="text-sm font-bold">
                    5. Danger Zone: Factory Reset / Delete All Data
                  </span>
                </div>
                <span className="text-muted text-sm font-mono">
                  {openSettingsSection === 5 ? '▾' : '▸'}
                </span>
              </button>

              {openSettingsSection === 5 && (
                <div className="px-5 pb-5 pt-3 space-y-4 border-t border-rose-500/20 text-xs">
                  <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-2">
                    <div className="font-semibold text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" /> Permanent Data Destruction Warning
                    </div>
                    <p>
                      This action will permanently delete all contacts, touchpoint interaction histories, conversation topics, group circles, and relationship links from SQLite. This action cannot be undone.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-muted">
                      To proceed, type <strong className="text-rose-400 font-mono">DELETE</strong> in the box below to re-authorize:
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Type DELETE to confirm"
                        className="px-3 py-2 rounded-lg bg-background border border-rose-500/40 text-foreground font-mono uppercase text-xs w-64 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        type="button"
                        disabled={deleteConfirmText !== 'DELETE'}
                        onClick={handleWipeAllData}
                        className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                          deleteConfirmText === 'DELETE'
                            ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-md'
                            : 'bg-background border border-border text-muted cursor-not-allowed opacity-50'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Permanently Delete All Data
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: HELP & GUIDE (Single-Expand Accordion) */}
        {activeTab === 'help' && (
          <div className="space-y-3 max-w-4xl text-xs leading-relaxed">
            <div className="mb-4">
              <h1 className="text-xl font-bold">Help &amp; Reference Guide</h1>
              <p className="text-xs text-muted">
                Click any topic below to expand its guide (opening a new section automatically
                collapses the previous one)
              </p>
            </div>

            {/* Guide 1: Google Contacts & Calendar OAuth Setup & Testing */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenHelpSection((prev) => (prev === 1 ? null : 1))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <span className="text-sm font-bold">
                  1. Google Contacts &amp; Calendar Integration - How to Create a Token &amp; Test It
                </span>
                <span className="text-muted text-sm font-mono">
                  {openHelpSection === 1 ? '▾' : '▸'}
                </span>
              </button>
              {openHelpSection === 1 && (
                <div className="px-5 pb-5 pt-1 space-y-3 border-t border-border">
                  <p className="text-muted pt-2">
                    Touchpoint uses <strong>Strict Additive-Only Sync</strong> for Google Contacts:
                    it only imports <em>new</em> contacts and <strong>never</strong> overwrites your
                    local edits or deletes contacts removed from Google.
                  </p>

                  <div className="space-y-2 bg-background border border-border rounded-lg p-3.5">
                    <div className="font-semibold text-foreground">
                      Step 1: Create OAuth Credentials in Google Cloud Console
                    </div>
                    <ol className="list-decimal list-inside space-y-2 text-muted">
                      <li>
                        Open{' '}
                        <a
                          href="https://console.cloud.google.com/apis/library"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Google Cloud Console API Library ↗
                        </a>{' '}
                        and enable <strong>Google People API</strong> (and{' '}
                        <strong>Google Calendar API</strong> if you plan to use Outbound Google
                        Calendar Push).
                      </li>
                      <li>
                        <strong>Configure Consent Screen / Audience:</strong> In the left menu, click{' '}
                        <strong>APIs &amp; Services → OAuth consent screen</strong> (or{' '}
                        <em>Audience / Branding</em> in the newest UI). If prompted, choose User Type{' '}
                        <strong>External</strong> (Testing mode is fine for personal use), set App Name{' '}
                        to <em>Touchpoint</em>, and add your own Gmail address under{' '}
                        <strong>Test users</strong>.
                      </li>
                      <li>
                        <strong>Create Web Client ID:</strong> Go to{' '}
                        <strong>APIs &amp; Services → Credentials</strong> (or <em>Clients</em>), click{' '}
                        <strong>+ Create Credentials → OAuth client ID</strong>, and select{' '}
                        <strong>Web application</strong>.
                      </li>
                      <li>
                        <strong>Authorized Redirect URIs (Crucial):</strong> Under{' '}
                        <em>Authorized redirect URIs</em>, click <strong>+ Add URI</strong> and enter the
                        exact URL you use to open Touchpoint followed by{' '}
                        <code className="text-foreground font-mono">/api/google</code>. You can add
                        both your local URL and your public domain:
                        <div className="mt-1.5 space-y-1 font-mono bg-card border border-border p-2 rounded text-foreground text-[11px]">
                          <div>
                            {typeof window !== 'undefined'
                              ? `${window.location.origin}/api/google`
                              : 'http://localhost:3000/api/google'}{' '}
                            <span className="text-muted font-sans font-normal">
                              (← Detected current browser URL)
                            </span>
                          </div>
                          <div>
                            https://martibun.com/api/google{' '}
                            <span className="text-muted font-sans font-normal">
                              (← Example if using your custom domain)
                            </span>
                          </div>
                          <div>https://developers.google.com/oauthplayground</div>
                        </div>
                      </li>
                      <li>
                        Copy the generated <strong>Client ID</strong> (ends in{' '}
                        <code>.apps.googleusercontent.com</code>) and <strong>Client Secret</strong> (starts{' '}
                        with <code>GOCSPX-...</code>) into{' '}
                        <strong>Settings → 3. Google Contacts Integration</strong> and click{' '}
                        <strong>Save Google Settings</strong>.
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-3 bg-background border border-border rounded-lg p-3.5">
                    <div className="font-semibold text-foreground">
                      Step 2: Generate Your Refresh Token (Two Easy Options)
                    </div>
                    <div className="space-y-3 text-muted">
                      <div className="p-2.5 rounded-lg bg-card border border-border space-y-1">
                        <div className="font-semibold text-foreground">
                          Option A - 1-Click Authorize in Touchpoint
                        </div>
                        <p>
                          In <strong>Settings → 3. Google Contacts Integration</strong>, click{' '}
                          <strong>Authorize with Google (OAuth)</strong>. Sign in with your Google
                          account, grant permission, and Touchpoint will automatically save your{' '}
                          <code>googleRefreshToken</code> in SQLite.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-card border border-border space-y-1.5">
                        <div className="font-semibold text-foreground">
                          Option B - Manual Token via Google OAuth Playground
                        </div>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>
                            Open{' '}
                            <a
                              href="https://developers.google.com/oauthplayground"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              developers.google.com/oauthplayground ↗
                            </a>
                            .
                          </li>
                          <li>
                            Click the top-right gear icon ⚙️, check{' '}
                            <em>&quot;Use your own OAuth credentials&quot;</em>, and paste your{' '}
                            <strong>OAuth Client ID</strong> and <strong>OAuth Client Secret</strong>.
                          </li>
                          <li>
                            In <em>Step 1 (Select &amp; authorize APIs)</em> on the left, enter and
                            authorize scope:{' '}
                            <code className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground">
                              https://www.googleapis.com/auth/contacts.readonly
                            </code>{' '}
                            (plus{' '}
                            <code className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground">
                              https://www.googleapis.com/auth/calendar.events
                            </code>{' '}
                            if using Outbound Calendar Push).
                          </li>
                          <li>
                            In <em>Step 2</em>, click{' '}
                            <strong>Exchange authorization code for tokens</strong> and copy the{' '}
                            <strong>Refresh token</strong> (starts with <code>1//...</code>).
                          </li>
                          <li>
                            Paste the <strong>Refresh token</strong> into{' '}
                            <strong>Settings → 3. Google Contacts Integration</strong> and click{' '}
                            <strong>Save Google Settings</strong>.
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-background border border-border rounded-lg p-3.5">
                    <div className="font-semibold text-foreground">
                      Step 3: How to Test the Connection Safely
                    </div>
                    <p className="text-muted">
                      In <strong>Settings → 3. Google Contacts Integration</strong>, click{' '}
                      <strong>Test Connection</strong>. Touchpoint will verify your OAuth token
                      against the Google People API and report how many contacts are reachable
                      without importing or modifying anything. Once verified, click{' '}
                      <strong>Sync New Contacts Now</strong> or configure an automatic Cron schedule
                      (e.g. <code>0 3 * * *</code>).
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Guide 2: Notification Channels (Telegram Bot & Outgoing Webhook) */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenHelpSection((prev) => (prev === 2 ? null : 2))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <span className="text-sm font-bold">
                  2. Notification Channels: Telegram Bot &amp; Outgoing Webhook (Use Either or Both)
                </span>
                <span className="text-muted text-sm font-mono">
                  {openHelpSection === 2 ? '▾' : '▸'}
                </span>
              </button>
              {openHelpSection === 2 && (
                <div className="px-5 pb-5 pt-1 space-y-3 border-t border-border">
                  <p className="text-muted pt-2">
                    You can configure <strong>Telegram</strong>, an{' '}
                    <strong>Outgoing Webhook</strong>, or <strong>both simultaneously</strong> in
                    Settings. Both channels operate purely via outbound HTTPS requests (zero open
                    inbound ports required).
                  </p>
                  <div className="space-y-2 bg-background border border-border rounded-lg p-3.5">
                    <div className="font-semibold text-foreground">
                      Channel A: Two-Step Interactive Telegram Bot (Long-Polling)
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-muted">
                      <li>
                        Message <strong>@BotFather</strong> on Telegram and send{' '}
                        <code>/newbot</code> to receive your <strong>Bot Token</strong>.
                      </li>
                      <li>
                        Send any message to your new bot, then message <strong>@userinfobot</strong>{' '}
                        to get your numeric <strong>Owner Chat ID</strong>.
                      </li>
                      <li>
                        Paste both into <strong>Settings → 2. Notification Channels</strong>, click{' '}
                        <strong>Save &amp; Start Long-Polling</strong>, and click{' '}
                        <strong>Send Test Telegram Message</strong>.
                      </li>
                      <li>
                        <strong>Two-Step Inline Buttons:</strong> Tap{' '}
                        <code>[✅ Mark Contacted]</code> on any reminder to reveal{' '}
                        <code>[📞 Call]</code>, <code>[💬 Message]</code>,{' '}
                        <code>[🤝 In Person]</code>, or <code>[✨ Other]</code> and log the
                        touchpoint directly from Telegram.
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-2 bg-background border border-border rounded-lg p-3.5">
                    <div className="font-semibold text-foreground">
                      Channel B: Signed Outgoing Webhook (n8n, Home Assistant, Slack, Discord, ntfy,
                      Custom)
                    </div>
                    <p className="text-muted">
                      When enabled, Touchpoint sends an HTTP <code>POST</code> with a JSON payload
                      of your due/overdue contacts (including <code>text</code>,{' '}
                      <code>content</code>, and <code>message</code> fields for out-of-the-box
                      compatibility with Slack, Discord, and ntfy, plus the full{' '}
                      <code>contacts</code> array with relationships, topics, and{' '}
                      <code>whatsappUrl</code>). If you configure a <strong>Signing Secret</strong>,
                      every request includes an{' '}
                      <code>X-Touchpoint-Signature: sha256=&lt;hex&gt;</code> HMAC header so your
                      receiver can verify authenticity.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Guide 3: Cadence Engine, Groups & Smart Spreading */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenHelpSection((prev) => (prev === 3 ? null : 3))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <span className="text-sm font-bold">
                  3. Cadence Engine, Groups &amp; Smart Spreading
                </span>
                <span className="text-muted text-sm font-mono">
                  {openHelpSection === 3 ? '▾' : '▸'}
                </span>
              </button>
              {openHelpSection === 3 && (
                <div className="px-5 pb-5 pt-3 border-t border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-muted">
                    <div className="bg-background border border-border rounded-lg p-3.5 space-y-1">
                      <div className="font-semibold text-foreground">
                        Group Cadence vs. Per-Person Override
                      </div>
                      <p>
                        Each Group (e.g., <em>Family - 7d</em>, <em>Workplace 1 - 30d</em>) sets a
                        default interval. If a contact belongs to multiple groups, the shortest
                        active interval applies unless you set a{' '}
                        <strong>Per-Person Cadence Override</strong> (from 1 to 365 days).
                      </p>
                    </div>
                    <div className="bg-background border border-border rounded-lg p-3.5 space-y-1">
                      <div className="font-semibold text-foreground">
                        Smart Spreading (Anti-Fatigue Daily Cap)
                      </div>
                      <p>
                        To prevent reminder fatigue when many contacts fall on the same date,
                        Touchpoint caps <em>Due Today</em> reminders at your daily limit (default:
                        3/day) and spreads excess contacts to tomorrow - while{' '}
                        <strong>always</strong> showing genuinely overdue contacts.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Guide 4: Relationship Map, Duplicates & Backups */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenHelpSection((prev) => (prev === 4 ? null : 4))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <span className="text-sm font-bold">
                  4. Relationship Map, Duplicate Merger &amp; Offline Portability
                </span>
                <span className="text-muted text-sm font-mono">
                  {openHelpSection === 4 ? '▾' : '▸'}
                </span>
              </button>
              {openHelpSection === 4 && (
                <div className="px-5 pb-5 pt-3 border-t border-border">
                  <ul className="list-disc list-inside space-y-1.5 text-muted bg-background border border-border rounded-lg p-3.5">
                    <li>
                      <strong className="text-foreground">Interactive Relationship Map:</strong>{' '}
                      Link contacts as <em>Spouse/Partner</em>, <em>Parent → Child</em>,{' '}
                      <em>Sibling</em>, <em>Friend</em>, <em>Coworker</em>, or{' '}
                      <em>Introduced By</em>. Linked relatives appear as context inside your
                      Telegram and Webhook reminders.
                    </li>
                    <li>
                      <strong className="text-foreground">
                        Duplicate Detection &amp; Safe Merge:
                      </strong>{' '}
                      Automatically flags contacts sharing the same normalized phone, email, or
                      name. Merging combines all touchpoint logs, conversation topics, group
                      memberships, and notes into the primary contact without losing history.
                    </li>
                    <li>
                      <strong className="text-foreground">100% Offline Backups:</strong> Export or
                      import standard <code>.vcf</code> (vCard 3.0) files or full SQLite{' '}
                      <code>.json</code> snapshots anytime in Settings.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Guide 5: Privacy & Outbound Network Summary */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenHelpSection((prev) => (prev === 5 ? null : 5))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <span className="text-sm font-bold">
                  5. Strict Privacy &amp; Network Activity Summary
                </span>
                <span className="text-muted text-sm font-mono">
                  {openHelpSection === 5 ? '▾' : '▸'}
                </span>
              </button>
              {openHelpSection === 5 && (
                <div className="px-5 pb-5 pt-3 border-t border-border overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-border rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-background border-b border-border text-muted">
                        <th className="p-2.5">Feature</th>
                        <th className="p-2.5">Default State</th>
                        <th className="p-2.5">Network Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-muted">
                      <tr>
                        <td className="p-2.5 font-medium text-foreground">
                          Web UI, Fonts, SQLite DB, vCard &amp; JSON Backups
                        </td>
                        <td className="p-2.5">Always Active</td>
                        <td className="p-2.5">100% Local / Zero external requests</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-foreground">
                          Local iCal Feed (<code>.ics</code>)
                        </td>
                        <td className="p-2.5">Local / LAN Only</td>
                        <td className="p-2.5">
                          Served locally by your container; zero outbound calls
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-foreground">
                          Google Contacts Additive Sync
                        </td>
                        <td className="p-2.5">Off until configured</td>
                        <td className="p-2.5">
                          Outbound HTTPS to <code>people.googleapis.com</code> (`contacts.readonly`)
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-foreground">
                          Outbound Google Calendar Push
                        </td>
                        <td className="p-2.5">Disabled by default</td>
                        <td className="p-2.5">
                          Opt-in outbound HTTPS to <code>googleapis.com/calendar/v3</code>{' '}
                          (`calendar.events`)
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-foreground">
                          Telegram Long-Polling Bot
                        </td>
                        <td className="p-2.5">Off until configured</td>
                        <td className="p-2.5">
                          Outbound HTTPS to <code>api.telegram.org</code> (0 open inbound ports)
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-foreground">
                          Outgoing Webhook (JSON POST)
                        </td>
                        <td className="p-2.5">Disabled by default</td>
                        <td className="p-2.5">
                          Opt-in outbound HTTP/HTTPS POST to your configured <code>webhookUrl</code>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Guide 6: Troubleshooting & Common Google OAuth Errors */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenHelpSection((prev) => (prev === 6 ? null : 6))}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-card-hover transition"
              >
                <span className="text-sm font-bold text-foreground">
                  6. Troubleshooting &amp; Common OAuth Errors
                </span>
                <span className="text-muted text-sm font-mono">
                  {openHelpSection === 6 ? '▾' : '▸'}
                </span>
              </button>
              {openHelpSection === 6 && (
                <div className="px-5 pb-5 pt-3 border-t border-border space-y-3">
                  <div className="p-3 rounded-lg bg-background border border-border space-y-1.5">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-mono text-[11px]">Error 400</span>
                      <span>invalid_request (redirect_uri mismatch or 0.0.0.0 blocked)</span>
                    </div>
                    <p className="text-muted">
                      <strong>Why this happens:</strong> Google OAuth 2.0 policy strictly disallows <code className="font-mono">0.0.0.0</code> in Authorized Redirect URIs (only <code className="font-mono">localhost</code> or registered domain names are permitted).
                    </p>
                    <p className="text-muted">
                      <strong>Solution:</strong> Touchpoint automatically normalizes local container addresses to <code className="font-mono">http://localhost:3000/api/google</code>. In your browser, always open Touchpoint using <code className="font-mono">http://localhost:3000</code> (never 0.0.0.0). In Google Cloud Console → Credentials, ensure <code className="font-mono">http://localhost:3000/api/google</code> (and/or your custom domain like <code className="font-mono">https://martibun.com/api/google</code>) is listed under <strong>Authorized redirect URIs</strong>.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-background border border-border space-y-1.5">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono text-[11px]">Access Blocked</span>
                      <span>App has not completed verification / Error 403: access_denied</span>
                    </div>
                    <p className="text-muted">
                      <strong>Why this happens:</strong> When your OAuth Consent Screen in Google Cloud is in <em>Testing</em> status, Google restricts sign-in exclusively to explicitly listed Test Users.
                    </p>
                    <p className="text-muted">
                      <strong>Solution:</strong> In Google Cloud Console, navigate to <strong>APIs &amp; Services → OAuth consent screen</strong> (or <em>Audience</em>), scroll down to <strong>Test users</strong>, click <strong>+ Add users</strong>, and add your Gmail address. You will then be able to authorize without restriction.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-background border border-border space-y-1.5">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[11px]">Safe Verification</span>
                      <span>How to test connectivity without modifying contacts</span>
                    </div>
                    <p className="text-muted">
                      Go to <strong>Settings → 3. Google Contacts Integration</strong> and click <strong>Test Connection</strong>. Touchpoint will make a read-only request to the Google People API to verify your credentials and report the contact count without creating, modifying, or deleting anything in your database.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* iOS Floating Bottom Tab Bar (Apple HIG tab-bars.md › Mobile persistent navigation) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-30 apple-glass-bar border-t border-border flex items-center justify-around px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {[
          {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            badge: attentionContacts.length,
            urgent: attentionContacts.length > 0,
          },
          {
            id: 'contacts',
            label: 'Contacts',
            icon: Users,
            badge: contacts.length,
          },
          {
            id: 'groups',
            label: 'Groups',
            icon: FolderKanban,
            badge: groups.length,
          },
          {
            id: 'calendar',
            label: 'Calendar',
            icon: CalendarIcon,
          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id as typeof activeTab);
                setMobileMenuOpen(false);
              }}
              className={`relative flex flex-col items-center justify-center min-w-[54px] py-1 px-1 rounded-lg transition-colors ${
                isActive ? 'text-primary font-semibold' : 'text-muted hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted'}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`absolute -top-1 -right-2.5 font-mono text-[9px] px-1 py-0.2 rounded-full font-bold tabular-nums ${
                      item.urgent ? 'bg-primary text-white' : 'bg-muted/40 text-foreground'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center min-w-[54px] py-1 px-1 rounded-lg text-muted hover:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5 text-muted" />
          <span className="text-[10px] mt-0.5 tracking-tight">More</span>
        </button>
      </nav>

      {/* Centered Contact Detail Modal / iOS Mobile Bottom Sheet (All Fields, Actions, Significant Dates, History & Relationships) */}
      {activeContactDrawer && (
        <div
          onClick={() => setActiveContactDrawer(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 overflow-y-auto space-y-4 sm:space-y-5 text-[13px] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 touch-scroll"
          >
            {/* Header: Avatar, Name, Job/Company & Actions */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
              <div className="flex items-center gap-3.5">
                <ProgressRingAvatar
                  name={activeContactDrawer.fullName}
                  progressPercent={activeContactDrawer.cadence.progressPercent}
                  status={activeContactDrawer.cadence.status}
                  size="lg"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[17px] font-bold tracking-tight text-foreground">
                      {activeContactDrawer.fullName}
                    </h2>
                    {activeContactDrawer.keepInTouch &&
                      activeContactDrawer.cadence.daysUntilDue !== undefined && (
                        <span
                          className={`sbb-baton ${
                            activeContactDrawer.cadence.daysUntilDue < 0
                              ? 'sbb-baton-overdue'
                              : activeContactDrawer.cadence.daysUntilDue === 0
                              ? 'sbb-baton-due'
                              : activeContactDrawer.cadence.daysUntilDue <= 5
                              ? 'sbb-baton-warning'
                              : 'sbb-baton-ok'
                          }`}
                        >
                          {activeContactDrawer.cadence.daysUntilDue < 0
                            ? `-${String(Math.abs(activeContactDrawer.cadence.daysUntilDue)).padStart(2, '0')}d`
                            : activeContactDrawer.cadence.daysUntilDue === 0
                            ? 'Today'
                            : `+${String(activeContactDrawer.cadence.daysUntilDue).padStart(2, '0')}d`}
                        </span>
                      )}
                  </div>
                  <div className="text-muted flex items-center gap-1.5 mt-0.5 text-[12px]">
                    <Briefcase className="w-3.5 h-3.5 text-muted" />
                    <span>
                      {[activeContactDrawer.jobTitle, activeContactDrawer.company]
                        .filter(Boolean)
                        .join(' · ') || 'No company or job title'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        activeContactDrawer.source === 'google'
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/35'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35'
                      }`}
                    >
                      {activeContactDrawer.source === 'google' ? 'Google Contact' : 'Local Contact'}
                    </span>
                    {(activeContactDrawer.firstName || activeContactDrawer.lastName) && (
                      <span className="text-[11px] text-muted">
                        First: <strong>{activeContactDrawer.firstName || '—'}</strong> · Last:{' '}
                        <strong>{activeContactDrawer.lastName || '—'}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditContact(activeContactDrawer)}
                  className="px-3 py-1.5 min-h-[30px] rounded-lg bg-background border border-border hover:bg-card-hover font-medium flex items-center gap-1.5 text-[12px] text-foreground transition-colors"
                  title="Edit Contact Details"
                >
                  <Pencil className="w-3.5 h-3.5 text-primary" />
                  <span>Edit…</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveContactDrawer(null)}
                  aria-label="Close contact inspector"
                  className="text-muted hover:text-foreground text-[13px] px-2.5 py-1.5 min-h-[30px] min-w-[30px] rounded-lg border border-border hover:bg-card-hover font-semibold transition-colors"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Communication Actions (Phone & Email) */}
            <div className="space-y-2">
              <div className="text-[12px] font-semibold text-foreground">
                Contact Channels &amp; Quick Dispatch
              </div>
              <div className="space-y-2">
                {activeContactDrawer.phone ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      <span className="font-mono font-semibold text-foreground">
                        {activeContactDrawer.phone}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${cleanPhoneForDial(activeContactDrawer.phone)}`}
                        className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium flex items-center gap-1.5 text-foreground transition-colors"
                        title="Voice Call"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Call
                      </a>
                      <a
                        href={`https://wa.me/${cleanPhoneForDial(activeContactDrawer.phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium flex items-center gap-1.5 text-foreground transition-colors"
                        title="WhatsApp Chat"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> WhatsApp
                      </a>
                      <a
                        href={`sms:${cleanPhoneForDial(activeContactDrawer.phone)}`}
                        className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium flex items-center gap-1.5 text-foreground transition-colors"
                        title="SMS Message"
                      >
                        SMS
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-background/60 border border-border text-muted flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[12px]">
                      <Phone className="w-3.5 h-3.5 opacity-60" /> No phone number recorded
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenEditContact(activeContactDrawer)}
                      className="text-[12px] font-semibold text-primary hover:underline"
                    >
                      Add Phone…
                    </button>
                  </div>
                )}

                {activeContactDrawer.email ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-foreground truncate font-mono font-medium">
                        {activeContactDrawer.email}
                      </span>
                    </div>
                    <a
                      href={`mailto:${activeContactDrawer.email}`}
                      className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium flex items-center gap-1.5 text-foreground shrink-0 transition-colors"
                      title="Send Email"
                    >
                      <Send className="w-3.5 h-3.5 text-primary" /> Email
                    </a>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-background/60 border border-border text-muted flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[12px]">
                      <Mail className="w-3.5 h-3.5 opacity-60" /> No email address recorded
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenEditContact(activeContactDrawer)}
                      className="text-[12px] font-semibold text-primary hover:underline"
                    >
                      Add Email…
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Cadence & Follow-Up Tracking Card */}
            <div className="p-4 rounded-xl bg-background border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-semibold text-foreground">
                    Cadence &amp; Follow-Up Status
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold capitalize ${
                      activeContactDrawer.cadence.status === 'overdue'
                        ? 'sbb-baton-overdue'
                        : activeContactDrawer.cadence.status === 'due_today'
                        ? 'sbb-baton-due'
                        : activeContactDrawer.cadence.status === 'due_soon'
                        ? 'sbb-baton-warning'
                        : activeContactDrawer.cadence.status === 'paused'
                        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/35'
                        : activeContactDrawer.cadence.status === 'untracked'
                        ? 'bg-muted/15 text-muted border border-border'
                        : 'sbb-baton-ok'
                    }`}
                  >
                    {activeContactDrawer.cadence.status.replace('_', ' ')}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleDrawerPatch({ keepInTouch: !activeContactDrawer.keepInTouch })
                    }
                    className={`px-2.5 py-1 min-h-[28px] rounded-lg text-[11px] font-semibold border transition ${
                      activeContactDrawer.keepInTouch
                        ? 'bg-primary text-primary-fg border-primary'
                        : 'bg-card text-muted border-border hover:text-foreground'
                    }`}
                  >
                    {activeContactDrawer.keepInTouch ? '✓ Tracked' : 'Untracked'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <div className="text-[11px] font-medium text-muted">Effective Interval</div>
                  <div className="font-mono font-semibold text-foreground mt-0.5">
                    Every {activeContactDrawer.cadence.effectiveIntervalDays} days
                    {activeContactDrawer.customIntervalDays
                      ? ' (Custom)'
                      : ' (Group)'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <div className="text-[11px] font-medium text-muted">Next Due Date</div>
                  <div className="font-mono font-semibold text-foreground mt-0.5">
                    {activeContactDrawer.cadence.nextDueDate
                      ? formatDateByPattern(
                          activeContactDrawer.cadence.nextDueDate,
                          settingsState.dateFormat
                        )
                      : '—'}
                    {activeContactDrawer.cadence.daysUntilDue !== undefined && (
                      <span
                        className={`ml-1 text-[11px] ${
                          activeContactDrawer.cadence.daysUntilDue < 0
                            ? 'text-overdue font-bold'
                            : activeContactDrawer.cadence.daysUntilDue === 0
                            ? 'text-due-soon font-bold'
                            : 'text-muted'
                        }`}
                      >
                        {activeContactDrawer.cadence.daysUntilDue < 0
                          ? `(${Math.abs(activeContactDrawer.cadence.daysUntilDue)}d overdue)`
                          : activeContactDrawer.cadence.daysUntilDue === 0
                          ? '(Due today)'
                          : `(in ${activeContactDrawer.cadence.daysUntilDue}d)`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 p-2.5 rounded-lg bg-card border border-border flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium text-muted">Last Contacted</div>
                    <div className="font-mono font-semibold text-foreground mt-0.5">
                      {activeContactDrawer.lastContactedAt
                        ? `${formatDateByPattern(
                            activeContactDrawer.lastContactedAt,
                            settingsState.dateFormat
                          )} (${activeContactDrawer.cadence.daysSinceContact} days ago)`
                        : 'Never contacted yet'}
                    </div>
                  </div>
                  {activeContactDrawer.lastTouchpoint && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-background border border-border text-muted">
                      via {activeContactDrawer.lastTouchpoint.method}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Log Touchpoint buttons */}
              <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-muted">Quick Log Touchpoint</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDrawerLogTouchpoint('call')}
                    className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium flex items-center gap-1.5 text-foreground transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Call
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDrawerLogTouchpoint('message')}
                    className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium flex items-center gap-1.5 text-foreground transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDrawerLogTouchpoint('in_person')}
                    className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium flex items-center gap-1.5 text-foreground transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-primary" /> Met
                  </button>
                </div>
              </div>

              {/* Schedule Follow-up / Snooze */}
              <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[12px] font-medium text-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Schedule Follow-up
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSnooze(activeContactDrawer.id, 1)}
                    className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium text-foreground transition-colors"
                    title="Remind me tomorrow"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSnooze(activeContactDrawer.id, 3)}
                    className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium text-foreground transition-colors"
                    title="Remind me in 3 days"
                  >
                    In 3d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSnooze(activeContactDrawer.id, 7)}
                    className="px-2.5 py-1 min-h-[28px] rounded-lg bg-card hover:bg-card-hover border border-border text-[12px] font-medium text-foreground transition-colors"
                    title="Remind me in 1 week"
                  >
                    Next Week
                  </button>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleSnooze(activeContactDrawer.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-card border border-border text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    title="Pick specific follow-up date"
                  />
                </div>
              </div>
            </div>

            {/* Important Dates: Birthday & Significant Dates / Events */}
            <div className="p-4 rounded-xl bg-background border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  <span>Important Dates &amp; Milestones</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddMilestone((prev) => !prev)}
                  className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddMilestone ? 'Cancel' : 'Add Date or Event…'}</span>
                </button>
              </div>

              {/* Birthday Row */}
              <div className="p-3 rounded-lg bg-card border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-foreground font-medium text-[12px] flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-primary" />
                    <span>Birthday</span>
                  </label>
                  <span className="text-[11px] text-muted font-mono">
                    {settingsState.dateFormat || 'YYYY-MM-DD'}
                  </span>
                </div>
                <BirthdayDatePicker
                  value={activeContactDrawer.birthday || ''}
                  onChange={(newBday) =>
                    handleDrawerPatch({ birthday: newBday || null })
                  }
                  placeholder={`${settingsState.dateFormat || 'YYYY-MM-DD'} (type or pick)`}
                  displayFormat={settingsState.dateFormat}
                />
              </div>

              {/* Significant Dates & Events (Multiple) */}
              <div className="p-3 rounded-lg bg-card border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-foreground font-medium text-[12px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Significant Dates &amp; Events</span>
                  </label>
                  <span className="text-[11px] text-muted">Anniversaries, milestones, etc.</span>
                </div>

                {/* List of all Significant Dates & Events */}
                {(() => {
                  const allSigDates: Array<{ id?: number; label: string; date: string }> = [
                    ...(activeContactDrawer.significantDate
                      ? [
                          {
                            label: activeContactDrawer.significantDateLabel || 'Anniversary',
                            date: activeContactDrawer.significantDate,
                          },
                        ]
                      : []),
                    ...(activeContactDrawer.importantDates || []).map((d) => ({
                      id: d.id,
                      label: d.label,
                      date: d.date,
                    })),
                  ];
                  // Deduplicate by date + label
                  const uniqueSigDates = allSigDates.filter(
                    (d, i, arr) =>
                      arr.findIndex((x) => x.date === d.date && x.label === d.label) === i
                  );

                  if (uniqueSigDates.length === 0 && !showAddMilestone) {
                    return (
                      <p className="text-[12px] text-muted">
                        No significant dates added yet. Click &ldquo;Add Date or Event…&rdquo; to add anniversaries, weddings, etc.
                      </p>
                    );
                  }

                  return (
                    <div className="flex flex-wrap gap-2">
                      {uniqueSigDates.map((d, idx) => (
                        <div
                          key={d.id ?? `sig-${idx}`}
                          className="px-2.5 py-1.5 rounded-lg bg-background border border-border flex items-center gap-2 text-[12px]"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-semibold text-foreground">{d.label}:</span>
                          <span className="font-mono text-muted">
                            {formatDateByPattern(d.date, settingsState.dateFormat)}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              if (d.id) {
                                await handleDrawerDeleteMilestone(d.id);
                              } else {
                                await handleDrawerPatch({
                                  significantDate: null,
                                  significantDateLabel: null,
                                });
                              }
                            }}
                            aria-label={`Remove ${d.label}`}
                            className="text-muted hover:text-overdue ml-1 p-0.5 rounded-md transition"
                            title="Remove Date"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Add Milestone Inline Mini-Form */}
                {showAddMilestone && (
                  <div className="p-3 rounded-lg bg-background border border-primary/40 space-y-2.5 mt-2">
                    <div className="font-semibold text-foreground text-[12px] flex items-center justify-between">
                      <span>Add New Date or Event</span>
                      <span className="text-[11px] text-muted font-mono">{settingsState.dateFormat || 'YYYY-MM-DD'}</span>
                    </div>

                    {/* Quick suggestion pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {['Anniversary', 'Wedding', 'Spouse Birthday', 'Child Birthday', 'Met Date', 'Graduation', 'Promotion'].map(
                        (sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setNewMilestoneLabel(sug)}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary border border-border text-foreground hover:border-primary transition"
                          >
                            {sug}
                          </button>
                        )
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <input
                        value={newMilestoneLabel}
                        onChange={(e) => setNewMilestoneLabel(e.target.value)}
                        placeholder="Label (e.g., Anniversary)"
                        className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-[12px] text-foreground"
                      />
                      <BirthdayDatePicker
                        value={newMilestoneDate}
                        onChange={(val) => setNewMilestoneDate(val)}
                        placeholder={`${settingsState.dateFormat || 'YYYY-MM-DD'} (type or pick)`}
                        displayFormat={settingsState.dateFormat}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddMilestone(false);
                          setNewMilestoneLabel('');
                          setNewMilestoneDate('');
                        }}
                        className="px-3 py-1.5 min-h-[28px] rounded-lg bg-card border border-border text-muted hover:text-foreground text-[12px] font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!newMilestoneLabel.trim() || !newMilestoneDate}
                        onClick={handleDrawerAddMilestone}
                        className="px-3 py-1.5 min-h-[28px] rounded-lg bg-primary text-primary-fg font-semibold text-[12px] disabled:opacity-50"
                      >
                        Save Date
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Group Memberships */}
            <div className="p-3.5 rounded-xl bg-background border border-border space-y-1.5">
              <div className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" /> Group Memberships
              </div>
              {activeContactDrawer.groups && activeContactDrawer.groups.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeContactDrawer.groups.map((g) => (
                    <span
                      key={g.id}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold border flex items-center gap-1.5"
                      style={{
                        backgroundColor: `${g.color}18`,
                        borderColor: `${g.color}55`,
                        color: g.color,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: g.color }}
                      />
                      {g.name}
                      <span className="opacity-75 font-mono text-[11px]">({g.intervalDays}d)</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-muted text-[12px]">
                  Not assigned to any groups yet.{' '}
                  <button
                    type="button"
                    onClick={() => handleOpenEditContact(activeContactDrawer)}
                    className="text-primary font-semibold hover:underline"
                  >
                    Assign Group…
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
              <div className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" /> Notes
              </div>
              {activeContactDrawer.notes ? (
                <p className="text-foreground whitespace-pre-wrap leading-relaxed pt-0.5">
                  {activeContactDrawer.notes}
                </p>
              ) : (
                <div className="text-muted text-[12px]">
                  No notes recorded yet.{' '}
                  <button
                    type="button"
                    onClick={() => handleOpenEditContact(activeContactDrawer)}
                    className="text-primary font-semibold hover:underline"
                  >
                    Add Note…
                  </button>
                </div>
              )}
            </div>

            {/* Pets */}
            <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
              <div className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                <span>🐾 Pets</span>
              </div>
              {activeContactDrawer.pets && activeContactDrawer.pets.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {activeContactDrawer.pets.map((pet, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-md bg-card border border-border text-foreground font-medium text-[12px] flex items-center gap-1"
                    >
                      <span>🐾</span> {pet}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-muted text-[12px]">No pets recorded.</div>
              )}
            </div>

            {/* Custom Fields */}
            {activeContactDrawer.customFields &&
              Object.keys(activeContactDrawer.customFields).length > 0 && (
                <div className="p-3.5 rounded-xl bg-background border border-border space-y-1.5">
                  <div className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Custom Fields
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    {Object.entries(activeContactDrawer.customFields).map(([key, val]) => (
                      <div key={key} className="p-2 rounded-lg bg-card border border-border">
                        <div className="text-[11px] text-muted">Field #{key}</div>
                        <div className="font-medium text-foreground truncate">{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Relationships on Network Map */}
            <div className="p-3.5 rounded-xl bg-background border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-primary" /> Relationships &amp; Family Links
                </div>
                <span className="text-[11px] font-mono text-muted">
                  {drawerRelationships.length} linked
                </span>
              </div>
              {drawerRelationships.length > 0 ? (
                <div className="space-y-1.5 pt-0.5">
                  {drawerRelationships.map((rel) => (
                    <div
                      key={rel.id}
                      className="p-2.5 rounded-lg bg-card border border-border flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold capitalize text-[11px]">
                          {rel.type.replace('_', ' ')}
                        </span>
                        <span className="font-semibold text-foreground">{rel.otherName}</span>
                      </div>
                      {rel.otherContact && (
                        <button
                          type="button"
                          onClick={() => setActiveContactDrawer(rel.otherContact!)}
                          className="px-2.5 py-1 min-h-[28px] rounded-md bg-background border border-border text-[11px] font-medium text-muted hover:text-foreground hover:bg-card-hover"
                          title="View Contact"
                        >
                          Open &rarr;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted text-[12px]">
                  No relationships linked on map yet.{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('map')}
                    className="text-primary font-semibold hover:underline"
                  >
                    Open Relationship Map…
                  </button>
                </div>
              )}
            </div>

            {/* Recent Touchpoints History */}
            <div className="space-y-2.5 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Recent Touchpoints Log</span>
                </h3>
                <span className="text-[11px] font-mono text-muted">
                  {drawerTouchpoints.length} recorded
                </span>
              </div>
              {drawerTouchpoints.length > 0 ? (
                <div className="space-y-2">
                  {drawerTouchpoints.slice(0, 8).map((tp) => (
                    editingTouchpointId === tp.id ? (
                      <div
                        key={tp.id}
                        className="p-3 rounded-xl bg-card border border-primary/50 space-y-2 text-[12px]"
                      >
                        <div className="flex items-center gap-2">
                          <select
                            value={editTpMethod}
                            onChange={(e) => setEditTpMethod(e.target.value)}
                            className="px-2.5 py-1.5 text-[12px] rounded-lg bg-background border border-border"
                          >
                            <option value="call">Call</option>
                            <option value="message">Message</option>
                            <option value="in_person">In Person</option>
                            <option value="email">Email</option>
                          </select>
                          <input
                            type="date"
                            value={editTpDate}
                            onChange={(e) => setEditTpDate(e.target.value)}
                            className="px-2.5 py-1.5 text-[12px] rounded-lg bg-background border border-border font-mono"
                          />
                        </div>
                        <input
                          type="text"
                          value={editTpNote}
                          onChange={(e) => setEditTpNote(e.target.value)}
                          placeholder="Note (optional)"
                          className="w-full px-2.5 py-1.5 text-[12px] rounded-lg bg-background border border-border"
                        />
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingTouchpointId(null)}
                            className="px-3 py-1 min-h-[28px] text-[12px] font-medium rounded-lg bg-muted/15 hover:bg-muted/25 text-muted hover:text-foreground transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditTouchpoint(tp.id)}
                            className="px-3 py-1 min-h-[28px] text-[12px] font-semibold rounded-lg bg-primary text-primary-fg hover:opacity-95 transition"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={tp.id}
                        className="p-3 rounded-xl bg-background border border-border flex items-start justify-between gap-2 group hover:border-foreground/30 transition"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tp.method === 'call' ? (
                              <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : tp.method === 'message' ? (
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Users className="w-3.5 h-3.5 text-primary" />
                            )}
                            <span className="font-semibold capitalize text-[12px] text-foreground">
                              {tp.method.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] text-muted font-mono">
                              {formatDateByPattern(tp.contactedAt, settingsState.dateFormat)}
                            </span>
                          </div>
                          {tp.note && (
                            <div className="text-[12px] text-muted pl-5 truncate">{tp.note}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => handleStartEditTouchpoint(tp)}
                            aria-label="Edit touchpoint record"
                            className="p-1.5 min-h-[28px] min-w-[28px] rounded-md hover:bg-card-hover text-muted hover:text-foreground transition flex items-center justify-center"
                            title="Edit Touchpoint"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTouchpoint(tp.id)}
                            aria-label="Delete touchpoint record"
                            className="p-1.5 min-h-[28px] min-w-[28px] rounded-md hover:bg-rose-500/10 text-muted hover:text-rose-500 transition flex items-center justify-center"
                            title="Delete Touchpoint"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-background/60 border border-border text-muted text-[12px] text-center">
                  No touchpoints logged yet. Use the quick buttons above to log one.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Local Contact */}
      {showNewContactModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateLocalContact}
            className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 space-y-4 text-[13px] shadow-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto touch-scroll animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-[16px] font-bold tracking-tight text-foreground">New Local Contact</h3>
                <p className="text-[12px] text-muted">Add a person to your relationship cadence directory</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewContactModal(false)}
                aria-label="Close new contact modal"
                className="text-muted hover:text-foreground px-2.5 py-1.5 min-h-[30px] min-w-[30px] rounded-lg border border-border hover:bg-card-hover font-semibold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">First Name *</label>
                <input
                  required
                  value={newContactForm.firstName}
                  onChange={(e) =>
                    setNewContactForm({ ...newContactForm, firstName: e.target.value })
                  }
                  placeholder="Dan"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Last Name</label>
                <input
                  value={newContactForm.lastName}
                  onChange={(e) =>
                    setNewContactForm({ ...newContactForm, lastName: e.target.value })
                  }
                  placeholder="Cohen"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Phone</label>
                <input
                  value={newContactForm.phone}
                  onChange={(e) =>
                    setNewContactForm({ ...newContactForm, phone: e.target.value })
                  }
                  placeholder="+972-54-1234567"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Email</label>
                <input
                  value={newContactForm.email}
                  onChange={(e) =>
                    setNewContactForm({ ...newContactForm, email: e.target.value })
                  }
                  placeholder="dan@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Company (Optional)</label>
                <input
                  value={newContactForm.company}
                  onChange={(e) =>
                    setNewContactForm({ ...newContactForm, company: e.target.value })
                  }
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Job Title (Optional)</label>
                <input
                  value={newContactForm.jobTitle}
                  onChange={(e) =>
                    setNewContactForm({ ...newContactForm, jobTitle: e.target.value })
                  }
                  placeholder="Product Manager"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-foreground mb-1 flex items-center justify-between font-medium text-[12px]">
                  <span className="flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-primary" />
                    <span>Birthday (Optional)</span>
                  </span>
                  <span className="text-[11px] text-muted font-mono">{settingsState.dateFormat || 'YYYY-MM-DD'}</span>
                </label>
                <BirthdayDatePicker
                  value={newContactForm.birthday}
                  onChange={(val) => setNewContactForm({ ...newContactForm, birthday: val })}
                  placeholder={`${settingsState.dateFormat || 'YYYY-MM-DD'} (type or pick)`}
                  displayFormat={settingsState.dateFormat}
                />
              </div>

              <div className="p-3 rounded-xl bg-background border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Significant Dates &amp; Events (Optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewContactForm({
                        ...newContactForm,
                        significantDates: [
                          ...newContactForm.significantDates,
                          { label: '', date: '' },
                        ],
                      })
                    }
                    className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Date
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {newContactForm.significantDates.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={item.label}
                        onChange={(e) => {
                          const updated = [...newContactForm.significantDates];
                          updated[idx].label = e.target.value;
                          setNewContactForm({ ...newContactForm, significantDates: updated });
                        }}
                        placeholder="Label (e.g., Anniversary)"
                        className="w-1/2 px-2.5 py-1.5 rounded-lg bg-card border border-border text-[12px] text-foreground"
                      />
                      <div className="flex-1">
                        <BirthdayDatePicker
                          value={item.date}
                          onChange={(val) => {
                            const updated = [...newContactForm.significantDates];
                            updated[idx].date = val;
                            setNewContactForm({ ...newContactForm, significantDates: updated });
                          }}
                          placeholder={settingsState.dateFormat || 'YYYY-MM-DD'}
                          displayFormat={settingsState.dateFormat}
                        />
                      </div>
                      {newContactForm.significantDates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = newContactForm.significantDates.filter((_, i) => i !== idx);
                            setNewContactForm({ ...newContactForm, significantDates: updated });
                          }}
                          aria-label="Remove significant date"
                          className="text-muted hover:text-overdue p-1"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Cadence Interval Selector */}
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-foreground">Stay-in-Touch Cadence</label>
              <div className="flex flex-wrap gap-1.5">
                {INTERVAL_PRESETS.map((preset) => {
                  const active =
                    newContactForm.intervalMode === 'preset' &&
                    newContactForm.selectedPresetDays === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setNewContactForm({
                          ...newContactForm,
                          intervalMode: 'preset',
                          selectedPresetDays: preset.value,
                        })
                      }
                      className={`px-2.5 py-1.5 min-h-[28px] rounded-lg border text-[12px] font-medium transition ${
                        active
                          ? 'bg-primary text-primary-fg border-primary'
                          : 'bg-background border-border text-muted hover:text-foreground'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setNewContactForm({
                      ...newContactForm,
                      intervalMode: 'custom',
                    })
                  }
                  className={`px-2.5 py-1.5 min-h-[28px] rounded-lg border text-[12px] font-medium transition ${
                    newContactForm.intervalMode === 'custom'
                      ? 'bg-primary text-primary-fg border-primary'
                      : 'bg-background border-border text-muted hover:text-foreground'
                  }`}
                >
                  Custom Days…
                </button>
              </div>

              {newContactForm.intervalMode === 'custom' && (
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="range"
                    min={1}
                    max={180}
                    value={newContactForm.customDaysValue}
                    onChange={(e) =>
                      setNewContactForm({
                        ...newContactForm,
                        customDaysValue: Number(e.target.value),
                      })
                    }
                    className="flex-1 accent-primary h-2 bg-muted/20 border border-border rounded-lg cursor-pointer"
                  />
                  <span className="font-mono font-semibold w-28 text-right text-[12px]">
                    Every {newContactForm.customDaysValue} days
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-foreground mb-1">Notes</label>
              <textarea
                rows={2}
                value={newContactForm.notes}
                onChange={(e) =>
                  setNewContactForm({ ...newContactForm, notes: e.target.value })
                }
                placeholder="Context, how you met, family details, or topics to remember…"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-foreground select-none text-[12px]">
                <input
                  type="checkbox"
                  checked={addMoreContact}
                  onChange={(e) => setAddMoreContact(e.target.checked)}
                  className="rounded-sm border-border text-primary focus:ring-0"
                />
                <span>Create Another After Saving</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewContactModal(false)}
                  className="px-3.5 py-1.5 min-h-[32px] rounded-lg border border-border font-medium text-[12px] text-foreground hover:bg-card-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 min-h-[32px] rounded-lg bg-primary text-primary-fg font-semibold text-[12px] hover:opacity-95"
                >
                  Save Contact
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Duplicate Merger (Interactive Queue) */}
      {showMergeModal && duplicates.length > 0 && (() => {
        const currentPair = duplicates[currentDuplicateIndex] || duplicates[0];
        if (!currentPair) return null;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 space-y-4 text-[13px] shadow-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto touch-scroll animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="text-[16px] font-bold tracking-tight text-foreground">Merge Duplicate Contacts</h3>
                  <div className="text-muted font-mono text-[12px] mt-0.5">
                    Duplicate {Math.min(currentDuplicateIndex + 1, duplicates.length)} of {duplicates.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowMergeModal(false);
                    setCurrentDuplicateIndex(0);
                  }}
                  aria-label="Close duplicate merger modal"
                  className="text-muted hover:text-foreground text-[13px] px-2.5 py-1.5 min-h-[30px] min-w-[30px] rounded-lg border border-border hover:bg-card-hover font-semibold"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 rounded-xl bg-background border border-border text-muted text-[12px]">
                <span className="font-semibold text-foreground">Flagged Reason: </span>
                {currentPair.reasons.join(', ')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-background border border-border space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-card border border-border text-muted font-mono font-semibold inline-block">
                      Contact A ({currentPair.contactA.source})
                    </span>
                    <div className="font-bold text-foreground text-[14px] pt-0.5">{currentPair.contactA.fullName}</div>
                    <div className="text-muted font-mono text-[12px]">{currentPair.contactA.phone || 'No phone'}</div>
                    <div className="text-muted font-mono text-[12px] truncate">{currentPair.contactA.email || 'No email'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleMergeDuplicate(currentPair.contactA.id, currentPair.contactB.id)
                    }
                    className="w-full mt-2 px-3 py-1.5 min-h-[32px] rounded-lg bg-primary text-primary-fg font-semibold text-[12px] hover:opacity-95"
                  >
                    Keep A (Merge B into A)
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-background border border-border space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-card border border-border text-muted font-mono font-semibold inline-block">
                      Contact B ({currentPair.contactB.source})
                    </span>
                    <div className="font-bold text-foreground text-[14px] pt-0.5">{currentPair.contactB.fullName}</div>
                    <div className="text-muted font-mono text-[12px]">{currentPair.contactB.phone || 'No phone'}</div>
                    <div className="text-muted font-mono text-[12px] truncate">{currentPair.contactB.email || 'No email'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleMergeDuplicate(currentPair.contactB.id, currentPair.contactA.id)
                    }
                    className="w-full mt-2 px-3 py-1.5 min-h-[32px] rounded-lg bg-card border border-primary text-primary font-semibold text-[12px] hover:bg-card-hover"
                  >
                    Keep B (Merge A into B)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                {duplicates.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentDuplicateIndex((idx) => (idx + 1) % duplicates.length)
                    }
                    className="text-primary hover:underline font-semibold text-[12px]"
                  >
                    Skip to Next Duplicate →
                  </button>
                ) : <span />}
                <button
                  type="button"
                  onClick={() => {
                    setShowMergeModal(false);
                    setCurrentDuplicateIndex(0);
                  }}
                  className="px-3.5 py-1.5 min-h-[32px] rounded-lg border border-border text-muted hover:text-foreground font-medium text-[12px]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Full Contact Editor */}
      {editingContact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveEditContact}
            className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 space-y-4 text-[13px] shadow-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto touch-scroll animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Pencil className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="text-[16px] font-bold tracking-tight text-foreground">
                    Edit Contact: {editingContact.fullName}
                  </h3>
                  <p className="text-[12px] text-muted">Update identity, cadence rules, and group memberships</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                aria-label="Close contact editor"
                className="text-muted hover:text-foreground text-[13px] px-2.5 py-1.5 min-h-[30px] min-w-[30px] rounded-lg border border-border hover:bg-card-hover font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">First Name</label>
                <input
                  value={editContactForm.firstName}
                  onChange={(e) => {
                    const newFn = e.target.value;
                    const combined = [newFn.trim(), editContactForm.lastName.trim()].filter(Boolean).join(' ');
                    setEditContactForm({
                      ...editContactForm,
                      firstName: newFn,
                      fullName: combined,
                    });
                  }}
                  placeholder="First name"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Last Name</label>
                <input
                  value={editContactForm.lastName}
                  onChange={(e) => {
                    const newLn = e.target.value;
                    const combined = [editContactForm.firstName.trim(), newLn.trim()].filter(Boolean).join(' ');
                    setEditContactForm({
                      ...editContactForm,
                      lastName: newLn,
                      fullName: combined,
                    });
                  }}
                  placeholder="Last name"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Full Name (Combined) *</label>
                <input
                  required
                  value={editContactForm.fullName}
                  onChange={(e) => {
                    const newFull = e.target.value;
                    const parts = newFull.trim().split(/\s+/);
                    const fn = parts[0] || '';
                    const ln = parts.length > 1 ? parts.slice(1).join(' ') : '';
                    setEditContactForm({
                      ...editContactForm,
                      fullName: newFull,
                      firstName: fn,
                      lastName: ln,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Phone Number</label>
                <input
                  value={editContactForm.phone}
                  onChange={(e) =>
                    setEditContactForm({ ...editContactForm, phone: e.target.value })
                  }
                  placeholder="+1..."
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-[13px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-foreground mb-1">Email Address</label>
              <input
                type="email"
                value={editContactForm.email}
                onChange={(e) =>
                  setEditContactForm({ ...editContactForm, email: e.target.value })
                }
                placeholder="name@example.com"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-[13px]"
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-foreground mb-1 font-medium text-[12px] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-primary" /> Birthday
                  </span>
                  <span className="text-[11px] text-muted font-mono">{settingsState.dateFormat || 'YYYY-MM-DD'}</span>
                </label>
                <BirthdayDatePicker
                  value={editContactForm.birthday}
                  onChange={(val) => setEditContactForm({ ...editContactForm, birthday: val })}
                  placeholder={`${settingsState.dateFormat || 'YYYY-MM-DD'} (type or pick)`}
                  displayFormat={settingsState.dateFormat}
                />
              </div>

              <div className="p-3 rounded-xl bg-background border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Significant Dates &amp; Events</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditContactForm({
                        ...editContactForm,
                        importantDates: [
                          ...editContactForm.importantDates,
                          { label: '', date: '' },
                        ],
                      })
                    }
                    className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Date
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {editContactForm.importantDates.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={item.label}
                        onChange={(e) => {
                          const updated = [...editContactForm.importantDates];
                          updated[idx].label = e.target.value;
                          setEditContactForm({ ...editContactForm, importantDates: updated });
                        }}
                        placeholder="Label (e.g., Anniversary)"
                        className="w-1/2 px-2.5 py-1.5 rounded-lg bg-card border border-border text-[12px] text-foreground"
                      />
                      <div className="flex-1">
                        <BirthdayDatePicker
                          value={item.date}
                          onChange={(val) => {
                            const updated = [...editContactForm.importantDates];
                            updated[idx].date = val;
                            setEditContactForm({ ...editContactForm, importantDates: updated });
                          }}
                          placeholder={settingsState.dateFormat || 'YYYY-MM-DD'}
                          displayFormat={settingsState.dateFormat}
                        />
                      </div>
                      {editContactForm.importantDates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = editContactForm.importantDates.filter((_, i) => i !== idx);
                            setEditContactForm({ ...editContactForm, importantDates: updated });
                          }}
                          aria-label="Remove significant date"
                          className="text-muted hover:text-overdue p-1"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Company</label>
                <input
                  value={editContactForm.company}
                  onChange={(e) =>
                    setEditContactForm({ ...editContactForm, company: e.target.value })
                  }
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Job Title</label>
                <input
                  value={editContactForm.jobTitle}
                  onChange={(e) =>
                    setEditContactForm({ ...editContactForm, jobTitle: e.target.value })
                  }
                  placeholder="Software Engineer"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-semibold text-foreground">Keep in Touch (Cadence Tracking)</div>
                  <div className="text-muted text-[11px]">Track regular touchpoints with this person</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditContactForm({
                      ...editContactForm,
                      keepInTouch: !editContactForm.keepInTouch,
                    })
                  }
                  className={`px-3 py-1 min-h-[28px] rounded-lg font-semibold text-[11px] border ${
                    editContactForm.keepInTouch
                      ? 'bg-primary text-primary-fg border-primary'
                      : 'bg-card border-border text-muted'
                  }`}
                >
                  {editContactForm.keepInTouch ? 'Tracking Active ✓' : 'Disabled'}
                </button>
              </div>

              {editContactForm.keepInTouch && (
                <div className="space-y-2.5 pt-2.5 border-t border-border">
                  <div className="flex items-center gap-4 text-[12px]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="intervalMode"
                        checked={editContactForm.intervalMode === 'inherit'}
                        onChange={() =>
                          setEditContactForm({ ...editContactForm, intervalMode: 'inherit' })
                        }
                      />
                      <span>Inherit Group Interval</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="intervalMode"
                        checked={editContactForm.intervalMode === 'custom'}
                        onChange={() =>
                          setEditContactForm({ ...editContactForm, intervalMode: 'custom' })
                        }
                      />
                      <span>Custom Interval (Days)</span>
                    </label>
                  </div>

                  {editContactForm.intervalMode === 'custom' && (
                    <div className="space-y-2.5 pt-2 bg-card border border-border p-3 rounded-lg">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-muted">Custom Cadence Interval</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-primary text-[13px]">
                            Every {editContactForm.customIntervalDays} days
                          </span>
                          <span className="text-muted text-[11px]">
                            ({Math.round(editContactForm.customIntervalDays / 7)}w /{' '}
                            {Math.round(editContactForm.customIntervalDays / 30)}mo)
                          </span>
                        </div>
                      </div>

                      {/* Moveable Slider Range Bar */}
                      <div className="relative pt-1">
                        <input
                          type="range"
                          min={1}
                          max={365}
                          step={1}
                          value={editContactForm.customIntervalDays}
                          onChange={(e) =>
                            setEditContactForm({
                              ...editContactForm,
                              customIntervalDays: Number(e.target.value),
                            })
                          }
                          className="w-full accent-primary h-2 bg-muted/20 border border-border rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[11px] font-mono text-muted pt-1">
                          <span>1d (Daily)</span>
                          <span>30d (Monthly)</span>
                          <span>90d (Quarterly)</span>
                          <span>180d</span>
                          <span>365d (Yearly)</span>
                        </div>
                      </div>

                      {/* Quick Jump Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {[
                          { label: 'Weekly', days: 7 },
                          { label: '2 Weeks', days: 14 },
                          { label: 'Monthly', days: 30 },
                          { label: '2 Months', days: 60 },
                          { label: 'Quarterly', days: 90 },
                          { label: 'Half-Year', days: 180 },
                          { label: 'Yearly', days: 365 },
                        ].map((preset) => (
                          <button
                            key={preset.days}
                            type="button"
                            onClick={() =>
                              setEditContactForm({
                                ...editContactForm,
                                customIntervalDays: preset.days,
                              })
                            }
                            className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border transition ${
                              editContactForm.customIntervalDays === preset.days
                                ? 'bg-primary text-primary-fg border-primary'
                                : 'bg-background border-border text-muted hover:text-foreground'
                            }`}
                          >
                            {preset.label} ({preset.days}d)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[12px] font-medium text-foreground">Group Memberships</label>
                {!showInlineNewGroup && (
                  <button
                    type="button"
                    onClick={() => setShowInlineNewGroup(true)}
                    className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create New Group…
                  </button>
                )}
              </div>

              {/* Existing Groups Badges */}
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const isSelected = editContactForm.groupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() =>
                        setEditContactForm({
                          ...editContactForm,
                          groupIds: isSelected
                            ? editContactForm.groupIds.filter((id) => id !== g.id)
                            : [...editContactForm.groupIds, g.id],
                        })
                      }
                      className={`px-2.5 py-1 min-h-[28px] rounded-lg border text-[12px] font-medium transition ${
                        isSelected
                          ? 'bg-primary/15 border-primary text-primary font-semibold'
                          : 'bg-background border-border text-muted hover:text-foreground'
                      }`}
                    >
                      {g.name} (Every {g.intervalDays}d) {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
                {groups.length === 0 && !showInlineNewGroup && (
                  <span className="text-[12px] text-muted">
                    No groups yet. Click &ldquo;Create New Group…&rdquo; to make one.
                  </span>
                )}
              </div>

              {/* Inline Create Group Form */}
              {showInlineNewGroup && (
                <div className="p-3.5 rounded-xl bg-card border border-primary/40 space-y-2.5 text-[12px] animate-in fade-in">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>Create &amp; Assign New Group</span>
                    <button
                      type="button"
                      onClick={() => setShowInlineNewGroup(false)}
                      aria-label="Cancel inline group creation"
                      className="text-muted hover:text-foreground text-[12px] px-1.5 py-0.5 rounded-md"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-muted block mb-1">Group Name</label>
                      <input
                        type="text"
                        placeholder="e.g., VIP Clients, Tennis Club"
                        value={inlineGroupName}
                        onChange={(e) => setInlineGroupName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted block mb-1">Cadence Interval</label>
                      <select
                        value={inlineGroupInterval}
                        onChange={(e) => setInlineGroupInterval(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-[12px] font-mono"
                      >
                        <option value={7}>Every 7 days (Weekly)</option>
                        <option value={14}>Every 14 days (2 Weeks)</option>
                        <option value={30}>Every 30 days (Monthly)</option>
                        <option value={60}>Every 60 days (2 Months)</option>
                        <option value={90}>Every 90 days (Quarterly)</option>
                        <option value={180}>Every 180 days (Half-Year)</option>
                        <option value={365}>Every 365 days (Yearly)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowInlineNewGroup(false)}
                      className="px-3 py-1 min-h-[28px] rounded-lg bg-background border border-border text-muted hover:text-foreground font-medium text-[12px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!inlineGroupName.trim() || inlineGroupLoading}
                      onClick={handleCreateInlineGroupForContact}
                      className="px-3 py-1 min-h-[28px] rounded-lg bg-primary text-primary-fg font-semibold text-[12px] disabled:opacity-50 flex items-center gap-1"
                    >
                      {inlineGroupLoading ? 'Creating…' : 'Create & Assign'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-foreground mb-1">Notes &amp; Talking Points</label>
              <textarea
                rows={3}
                value={editContactForm.notes}
                onChange={(e) =>
                  setEditContactForm({ ...editContactForm, notes: e.target.value })
                }
                placeholder="Background notes, family info, mutual hobbies…"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border resize-none text-[13px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-3.5 py-2 min-h-[32px] rounded-lg border border-border text-foreground hover:bg-card-hover font-medium text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 min-h-[32px] rounded-lg bg-primary text-primary-fg font-semibold text-[12px] hover:opacity-95"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Quick Search & Command Palette (⌘K) */}
      {showQuickSearchModal && (
        <div
          onClick={() => setShowQuickSearchModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-start justify-center pt-6 sm:pt-14 p-2 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl max-w-2xl w-full p-3.5 sm:p-4 space-y-3.5 shadow-2xl text-xs overflow-hidden max-h-[88vh] flex flex-col"
          >
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
              <div className="flex items-center gap-2.5 flex-1">
                <Search className="w-4 h-4 text-primary shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts by name, phone, email, company, notes... (Esc to close)"
                  className="w-full bg-transparent border-none text-sm text-foreground focus:outline-none placeholder:text-muted"
                />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded text-muted hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="px-2 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-muted">
                ESC
              </kbd>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              {[
                { id: 'all', label: `All (${contacts.length})` },
                { id: 'due', label: `Due (${attentionContacts.length})` },
                { id: 'birthdays', label: `Birthdays (${upcomingBirthdays.length})` },
                {
                  id: 'tracked',
                  label: `Tracked (${contacts.filter((c) => c.keepInTouch).length})`,
                },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setSearchFilterTab(chip.id as typeof searchFilterTab)}
                  className={`px-2.5 py-1 rounded-lg border transition ${
                    searchFilterTab === chip.id
                      ? 'bg-primary text-primary-fg border-primary font-medium'
                      : 'bg-background border-border text-muted hover:text-foreground'
                  }`}
                >
                  {chip.label}
                </button>
              ))}

              <select
                value={searchFilterGroup === null ? '' : searchFilterGroup}
                onChange={(e) =>
                  setSearchFilterGroup(e.target.value === '' ? null : Number(e.target.value))
                }
                className="px-2.5 py-1 rounded-lg bg-background border border-border"
              >
                <option value="">All Groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>

              {(searchQuery || searchFilterTab !== 'all' || searchFilterGroup !== null) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchFilterTab('all');
                    setSearchFilterGroup(null);
                  }}
                  className="px-2 py-1 text-muted hover:text-foreground underline"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Quick Navigation / Tab Switcher */}
            {(() => {
              const q = searchQuery.toLowerCase().trim();
              const navItems = [
                { id: 'dashboard', label: 'Dashboard', desc: 'Overdue reminders, birthdays, and metrics', icon: LayoutDashboard, keywords: 'dashboard home overview due urgent' },
                { id: 'contacts', label: 'Contacts Directory', desc: 'Browse, filter, and edit all contacts', icon: Users, keywords: 'contacts directory people address book' },
                { id: 'groups', label: 'Groups & Circles', desc: 'Manage circles and cadence intervals', icon: FolderKanban, keywords: 'groups categories cadence circles' },
                { id: 'map', label: 'Relationship Map', desc: 'Visualize spouses, families, and coworker links', icon: Network, keywords: 'relationship map network graph family spouse child' },
                { id: 'calendar', label: 'Calendar Sync', desc: 'Live iCal feeds and Google Calendar integration', icon: CalendarIcon, keywords: 'calendar sync ical google agenda feed' },
                { id: 'settings', label: 'Settings', desc: 'Configure sync, Telegram, webhooks, or wipe data', icon: SettingsIcon, keywords: 'settings config preferences wipe google telegram webhook danger zone' },
                { id: 'help', label: 'Help & Guide', desc: 'Read guides and OAuth troubleshooting tips', icon: BookOpen, keywords: 'help guide reference manual faq troubleshooting oauth' },
              ] as const;

              const matchingNavs = navItems.filter((item) => {
                if (!q) return true;
                return (
                  item.label.toLowerCase().includes(q) ||
                  item.desc.toLowerCase().includes(q) ||
                  item.keywords.includes(q)
                );
              });

              if (matchingNavs.length === 0) return null;

              return (
                <div className="space-y-1 pb-2 border-b border-border">
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-wider px-1">
                    Go to Page / Tab
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {matchingNavs.map((nav) => {
                      const Icon = nav.icon;
                      return (
                        <button
                          key={nav.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(nav.id as typeof activeTab);
                            setShowQuickSearchModal(false);
                            setSearchQuery('');
                          }}
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-background hover:bg-card-hover border border-border text-left transition group"
                        >
                          <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-fg transition">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-foreground truncate">
                              Go to {nav.label}
                            </div>
                            <div className="text-[10px] text-muted truncate">
                              {nav.desc}
                            </div>
                          </div>
                          <span className="text-[10px] text-muted group-hover:text-foreground">
                            →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border pr-1">
              {filteredContacts.length === 0 ? (
                <div className="py-8 text-center text-muted space-y-2">
                  <p>No contacts found matching &quot;{searchQuery}&quot;</p>
                  <button
                    onClick={() => {
                      setShowQuickSearchModal(false);
                      setShowNewContactModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold"
                  >
                    Add New Contact
                  </button>
                </div>
              ) : (
                filteredContacts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setShowQuickSearchModal(false);
                      setActiveContactDrawer(c);
                    }}
                    className="py-2.5 px-2 hover:bg-card-hover rounded-lg flex items-center justify-between gap-3 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProgressRingAvatar
                        name={c.fullName}
                        progressPercent={c.cadence.progressPercent}
                        status={c.cadence.status}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{c.fullName}</div>
                        <div className="text-muted truncate">
                          {[c.jobTitle, c.company].filter(Boolean).join(' @ ') ||
                            c.phone ||
                            c.email ||
                            'No details'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {c.birthday && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium flex items-center gap-1">
                          <Cake className="w-3 h-3" /> {c.birthday}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-background border border-border text-muted">
                        {c.cadence.nextDueDate}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLogTouchpoint(c.id, 'call');
                        }}
                        className="p-1.5 rounded bg-primary text-primary-fg"
                        title="Log Call"
                      >
                        <Phone className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLogTouchpoint(c.id, 'message');
                        }}
                        className="p-1.5 rounded bg-background border border-border"
                        title="Log Message"
                      >
                        <MessageSquare className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted">
              <span>{filteredContacts.length} contacts found</span>
              <span>Tip: Press ⌘K anywhere to toggle this search palette</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Global Vacation / Pause Mode */}
      {showPauseModal && (
        <div
          onClick={() => setShowPauseModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 space-y-4 shadow-xl text-xs max-h-[92vh] overflow-y-auto touch-scroll animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <Palmtree className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Global Vacation / Pause Mode
                  </h3>
                  <p className="text-muted mt-0.5">
                    Pause all cadence due alerts &amp; digests while away
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPauseModal(false)} className="text-muted">
                ✕
              </button>
            </div>

            {isGlobalPaused && (
              <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 space-y-1">
                <div className="font-semibold text-amber-300">Currently Active:</div>
                <div>
                  Cadence alerts paused until <strong>{formattedPausedUntil}</strong> (
                  {remainingPauseDays} days remaining).
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-muted font-medium">Quick Pause Presets</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '1 Week (7d)', days: 7 },
                  { label: '2 Weeks (14d)', days: 14 },
                  { label: '1 Month (30d)', days: 30 },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => handleSetGlobalPause(preset.days)}
                    className="p-2.5 rounded-lg border border-border bg-background hover:bg-card-hover font-semibold transition text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-border">
              <label className="block text-muted font-medium">Or Pick a Custom Resume Date</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={pauseCustomDate}
                  onChange={(e) => setPauseCustomDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border"
                />
                <button
                  disabled={!pauseCustomDate}
                  onClick={() => pauseCustomDate && handleSetGlobalPause(pauseCustomDate)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold disabled:opacity-50"
                >
                  Set Date
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              {isGlobalPaused ? (
                <button
                  onClick={() => {
                    handleResumeCadence();
                    setShowPauseModal(false);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5"
                >
                  <PlayCircle className="w-3.5 h-3.5" /> Resume Cadence Now
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => setShowPauseModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Group Details & Edit Settings */}
      {selectedGroupDetails && (
        <div
          onClick={() => setSelectedGroupDetails(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs"
          >
            {/* Header with Group Accent Bar & Color */}
            <div className="relative border-b border-border p-5 pb-4">
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{
                  backgroundColor:
                    editGroupForm.color || selectedGroupDetails.color || '#e85d3a',
                }}
              />
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 shadow-xs"
                    style={{
                      backgroundColor:
                        editGroupForm.color || selectedGroupDetails.color || '#e85d3a',
                    }}
                  />
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      {selectedGroupDetails.name}
                      <span className="text-xs font-normal text-muted">
                        (
                        {
                          contacts.filter((c) =>
                            c.groups.some((cg) => cg.id === selectedGroupDetails.id)
                          ).length
                        }{' '}
                        contacts)
                      </span>
                    </h3>
                    <p className="text-muted mt-0.5">
                      Configure group cadence interval, color theme, and manage linked contacts
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGroupDetails(null)}
                  className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-card-hover transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body: Settings & Contacts */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
              {/* SECTION 1: Group Settings Form */}
              <form
                onSubmit={handleSaveGroupSettings}
                className="space-y-4 bg-background/50 border border-border/80 rounded-xl p-4"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <SettingsIcon className="w-3.5 h-3.5 text-primary" /> Group Settings
                  </div>
                  <span className="text-[11px] text-muted">ID: {selectedGroupDetails.id}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-muted font-medium mb-1">Group Name</label>
                    <input
                      required
                      value={editGroupForm.name}
                      onChange={(e) =>
                        setEditGroupForm({ ...editGroupForm, name: e.target.value })
                      }
                      placeholder="e.g., Friends, Workplace 1"
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground font-medium focus:border-primary focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-muted font-medium mb-1">Cadence Interval</label>
                    <select
                      value={editGroupForm.intervalDays}
                      onChange={(e) =>
                        setEditGroupForm({
                          ...editGroupForm,
                          intervalDays: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground focus:border-primary focus:outline-none transition"
                    >
                      <option value={0}>Manual (Contact-level only)</option>
                      <option value={7}>Every Week (7 days)</option>
                      <option value={14}>Every 2 Weeks (14 days)</option>
                      <option value={30}>Every Month (30 days)</option>
                      <option value={60}>Every 2 Months (60 days)</option>
                      <option value={90}>Quarterly (90 days)</option>
                      <option value={180}>Semi-annually (180 days)</option>
                      <option value={365}>Annually (365 days)</option>
                    </select>
                  </div>
                </div>

                {/* Color Palette Selector */}
                <div>
                  <label className="block text-muted font-medium mb-1.5">Group Color Theme</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_GROUP_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditGroupForm({ ...editGroupForm, color: c })}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          editGroupForm.color === c
                            ? 'scale-125 ring-2 ring-primary ring-offset-2 ring-offset-card'
                            : 'hover:scale-110 opacity-80 hover:opacity-100'
                        }`}
                        title={c}
                      />
                    ))}
                    <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-2">
                      <span className="text-[11px] text-muted">Custom:</span>
                      <input
                        type="color"
                        value={editGroupForm.color}
                        onChange={(e) =>
                          setEditGroupForm({ ...editGroupForm, color: e.target.value })
                        }
                        className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteGroup(selectedGroupDetails.id, selectedGroupDetails.name)
                    }
                    className="text-overdue hover:bg-overdue/10 px-2.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Group
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold hover:opacity-90 transition shadow-sm"
                  >
                    Save Group Settings
                  </button>
                </div>
              </form>

              {/* SECTION 2: Linked Contacts Management */}
              {(() => {
                const linkedContacts = contacts.filter((c) =>
                  c.groups.some((cg) => cg.id === selectedGroupDetails.id)
                );
                const unlinkedContacts = contacts.filter(
                  (c) => !c.groups.some((cg) => cg.id === selectedGroupDetails.id)
                );
                const filteredMembers = linkedContacts.filter((c) => {
                  if (!groupSearchQuery.trim()) return true;
                  const q = groupSearchQuery.toLowerCase();
                  return (
                    c.fullName.toLowerCase().includes(q) ||
                    (c.company && c.company.toLowerCase().includes(q)) ||
                    (c.email && c.email.toLowerCase().includes(q)) ||
                    (c.phone && c.phone.includes(q))
                  );
                });

                return (
                  <div className="space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span>Linked Contacts ({linkedContacts.length})</span>
                      </div>

                      {/* Add Contact to Group Control */}
                      {unlinkedContacts.length > 0 && (
                        <div className="flex items-center gap-2">
                          <select
                            value={addContactIdToGroup}
                            onChange={(e) => setAddContactIdToGroup(Number(e.target.value) || '')}
                            className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-medium text-xs focus:border-primary focus:outline-none"
                          >
                            <option value="">+ Select Contact to Add...</option>
                            {unlinkedContacts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.fullName} {c.company ? `(${c.company})` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!addContactIdToGroup}
                            onClick={() =>
                              addContactIdToGroup &&
                              handleAddContactToGroup(
                                Number(addContactIdToGroup),
                                selectedGroupDetails.id
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold hover:opacity-90 disabled:opacity-50 transition"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Member Search Bar */}
                    {linkedContacts.length > 3 && (
                      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-background border border-border focus-within:border-primary transition">
                        <Search className="w-3.5 h-3.5 text-muted shrink-0" />
                        <input
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                          placeholder="Filter members by name, company, email..."
                          className="w-full bg-transparent border-none text-foreground placeholder:text-muted focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Member List */}
                    <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                      {filteredMembers.map((c) => (
                        <div
                          key={c.id}
                          className="bg-card hover:bg-card-hover border border-border rounded-xl p-3 flex items-center justify-between gap-3 transition"
                        >
                          <div
                            onClick={() => setActiveContactDrawer(c)}
                            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                          >
                            <ProgressRingAvatar
                              name={c.fullName}
                              progressPercent={c.cadence.progressPercent}
                              status={c.cadence.status}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground hover:text-primary transition flex items-center gap-1.5 truncate">
                                <span>{c.fullName}</span>
                                <ExternalLink className="w-3 h-3 text-muted" />
                              </div>
                              <div className="text-[11px] text-muted truncate">
                                {c.company || c.email || c.phone || 'No extra info'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Cadence status badge */}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                c.cadence.status === 'overdue'
                                  ? 'text-overdue bg-overdue/10 border-overdue/30'
                                  : c.cadence.status === 'due_today' ||
                                    c.cadence.status === 'due_soon'
                                  ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
                                  : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                              }`}
                            >
                              {c.cadence.daysUntilDue <= 0
                                ? 'Due now'
                                : `Due in ${c.cadence.daysUntilDue}d`}
                            </span>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveContactFromGroup(c.id, selectedGroupDetails.id)
                              }
                              className="text-muted hover:text-overdue p-1.5 rounded-lg hover:bg-overdue/10 transition"
                              title="Remove contact from this group"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {linkedContacts.length === 0 && (
                        <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted space-y-1.5">
                          <Users className="w-6 h-6 mx-auto opacity-40 mb-1" />
                          <div className="font-medium text-foreground">
                            No contacts in this group yet
                          </div>
                          <p className="text-[11px]">
                            Use the dropdown above or select contacts in the Contacts directory to
                            assign them.
                          </p>
                        </div>
                      )}

                      {linkedContacts.length > 0 && filteredMembers.length === 0 && (
                        <div className="p-6 text-center text-muted">
                          No members matched &ldquo;{groupSearchQuery}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-card flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedGroupDetails(null)}
                className="px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground hover:bg-card-hover transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      {show2faSetupModal && totpSetupData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Set Up Two-Factor Authentication</h3>
                  <p className="text-xs text-muted">Scan QR code with your authenticator app</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShow2faSetupModal(false);
                  setTotpSetupData(null);
                  setTotpBackupCodes(null);
                }}
                className="text-muted hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {totpBackupCodes ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-1 text-center">
                    <div className="font-bold text-sm">✓ Two-Factor Authentication Enabled!</div>
                    <p className="text-xs">Save your one-time backup recovery codes in a safe place. You can use these if you lose access to your device.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-background border border-border space-y-2">
                    <div className="text-[10px] uppercase font-bold text-muted tracking-wider">One-Time Backup Recovery Codes</div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-center">
                      {totpBackupCodes.map((code, idx) => (
                        <div key={idx} className="p-1.5 rounded bg-card border border-border text-foreground font-semibold">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(totpBackupCodes.join('\n'));
                        notify('Backup recovery codes copied to clipboard!');
                      }}
                      className="px-3 py-2 rounded-lg bg-card border border-border hover:bg-card-hover text-foreground font-semibold flex-1 text-center"
                    >
                      Copy All Codes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShow2faSetupModal(false);
                        setTotpSetupData(null);
                        setTotpBackupCodes(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold flex-1 text-center"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-muted">
                      Open Google Authenticator, 1Password, or Bitwarden, and scan this QR code:
                    </p>
                    <div className="p-3 bg-white rounded-xl inline-block shadow-sm">
                      <img
                        src={totpSetupData.qrDataUrl}
                        alt="2FA QR Code"
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted">Or enter secret key manually:</div>
                      <code className="text-xs font-mono font-bold tracking-wider text-primary select-all px-2 py-1 rounded bg-background border border-border inline-block mt-1">
                        {totpSetupData.secret}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <label className="block text-muted font-medium">Enter 6-digit confirmation code:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={totpVerifyCode}
                        onChange={(e) => setTotpVerifyCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="w-full text-center tracking-widest text-base font-mono px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleConfirm2faEnable}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold shrink-0"
                      >
                        Verify &amp; Activate
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2FA Disable Modal */}
      {show2faDisableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground">Disable Two-Factor Authentication</h3>
              <button
                type="button"
                onClick={() => setShow2faDisableModal(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-muted">
                Please enter your account password and current 2FA code to confirm disabling Two-Factor Authentication.
              </p>
              <div>
                <label className="block text-muted mb-1">Account Password</label>
                <input
                  type="password"
                  value={disable2faPassword}
                  onChange={(e) => setDisable2faPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-muted mb-1">2FA Code or Recovery Code</label>
                <input
                  type="text"
                  value={disable2faCode}
                  onChange={(e) => setDisable2faCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-center tracking-wider"
                  placeholder="123456"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShow2faDisableModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm2faDisable}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-xs"
                >
                  Confirm Disable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
