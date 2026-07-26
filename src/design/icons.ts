// ═══════════════════════════════════════════════════════════════════════════
// ParaPass — Famille d'icônes UNIQUE (Lucide) pour toute l'application
// ═══════════════════════════════════════════════════════════════════════════
// Un seul jeu vectoriel, monochrome (currentColor), teinté par son contexte.
// AUCUN emoji système comme icône. Les écrans référencent `icons.<usage>` pour
// garantir la cohérence et faciliter un futur changement de famille.

import {
  // navigation / actions
  Plus, Share2, Download, QrCode, ScanLine, ChevronRight, ChevronDown, ChevronUp,
  Pencil, Trash2, Settings, LogOut, Search, Filter, Send, Bell, MessageSquare,
  // parachutisme / activité
  Backpack, Target, GraduationCap, Award, Activity, BarChart3, TrendingUp, MapPin,
  // validation / conformité / statuts
  CheckCircle2, AlertTriangle, XOctagon, ShieldCheck, BookCheck, Lock, Clock, CalendarOff,
  // météo
  Wind, Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudSnow, CloudDrizzle, CloudLightning,
  type LucideIcon,
} from 'lucide-react';

export const icons = {
  // Actions
  ajouterSaut: Plus,
  partager: Share2,
  exporter: Download,
  qr: QrCode,
  scanner: ScanLine,
  editer: Pencil,
  supprimer: Trash2,
  parametres: Settings,
  deconnexion: LogOut,
  rechercher: Search,
  filtrer: Filter,
  envoyer: Send,
  notifications: Bell,
  messages: MessageSquare,
  chevronDroite: ChevronRight,
  chevronBas: ChevronDown,
  chevronHaut: ChevronUp,

  // Parachutisme / activité
  sac: Backpack,
  reflexe: Target,
  academie: GraduationCap,
  badges: Award,
  activite: Activity,
  progression: BarChart3,
  tendance: TrendingUp,
  lieu: MapPin,
  presence: MapPin,

  // Validation / conformité
  valide: CheckCircle2,
  attention: AlertTriangle,
  danger: XOctagon,
  conformite: ShieldCheck,
  carnet: BookCheck,
  verrou: Lock,
  reprise: Clock,
  aucuneSeance: CalendarOff,

  // Météo (générique)
  vent: Wind,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

/** Icône météo à partir d'un code WMO (Open-Meteo) — famille vectorielle unique. */
export function iconeMeteo(code: number): LucideIcon {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudDrizzle;
  return CloudLightning;
}
