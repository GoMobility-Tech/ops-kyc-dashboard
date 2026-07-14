import {
  UserCheck, Users, UserPlus, Home, FileText, ListChecks, Shield,
  Search, Settings, LayoutDashboard, ClipboardList, Landmark, Car, IdCard,
  AlertTriangle, CheckCircle2, LogOut,
} from 'lucide-react';

// Maps backend-provided icon string keys to lucide-react components.
// Add entries as backend introduces new module keys.
const map = {
  'user-check':      UserCheck,
  'users':           Users,
  'user-plus':       UserPlus,
  'home':            Home,
  'file-text':       FileText,
  'list-checks':     ListChecks,
  'shield':          Shield,
  'search':          Search,
  'settings':        Settings,
  'layout-dashboard':LayoutDashboard,
  'clipboard-list':  ClipboardList,
  'landmark':        Landmark,
  'car':             Car,
  'id-card':         IdCard,
  'alert-triangle':  AlertTriangle,
  'check-circle':    CheckCircle2,
};

export const getIcon = (key) => map[key] || LayoutDashboard;
