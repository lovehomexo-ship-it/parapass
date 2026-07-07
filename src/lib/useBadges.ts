import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Saut, Badge } from './types';
import { BADGES } from './types';

// ─── Text helpers for programme/observations matching ─────────────────────────

function matchProgramme(sauts: Saut[], ...patterns: RegExp[]): boolean {
  return sauts.some((s) => {
    const text = `${s.programme ?? ''} ${s.observations ?? ''} ${s.observations_moniteur ?? ''}`.toLowerCase();
    return patterns.some((p) => p.test(text));
  });
}

function countProgramme(sauts: Saut[], ...patterns: RegExp[]): number {
  return sauts.filter((s) => {
    const text = `${s.programme ?? ''} ${s.observations ?? ''} ${s.observations_moniteur ?? ''}`.toLowerCase();
    return patterns.some((p) => p.test(text));
  }).length;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBadges(userId: string | undefined, sauts: Saut[]) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [newBadge, setNewBadge] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('badges').select('*').eq('parachutiste_id', userId);
    const rows = data ?? [];
    setBadges(rows);

    // Surface first unnotified badge as notification
    const unnotified = rows.filter((b) => !b.notifie);
    if (unnotified.length > 0) {
      const def = BADGES.find((b) => b.type === unnotified[0].type_badge);
      if (def) setNewBadge(def.nom);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const checkAndAward = useCallback(async () => {
    if (!userId || sauts.length === 0) return;

    // Fetch FRESH from DB to avoid stale-state race condition
    const { data: freshData } = await supabase
      .from('badges')
      .select('type_badge')
      .eq('parachutiste_id', userId);
    const existingTypes = new Set((freshData ?? []).map((b) => b.type_badge));

    const toAward: string[] = [];
    // Seuls les sauts validés comptent pour les badges de volume
    const validSauts = sauts.filter((s) => s.statut === 'valide' || s.statut === 'historique');
    const total = validSauts.length;
    const lieux = [...new Set(sauts.map((s) => s.lieu))];
    const sorted = [...sauts].sort((a, b) => a.date_saut.localeCompare(b.date_saut));
    const firstDate = sorted[0]?.date_saut ? new Date(sorted[0].date_saut) : null;
    const now = new Date();

    const award = (type: string) => { if (!existingTypes.has(type)) toAward.push(type); };

    // ── Volume ────────────────────────────────────────────────────────────────
    const volumeThresholds: [number, string][] = [
      [1, 'premier_saut'], [10, 'decollage'], [25, 'en_route'], [50, 'confirme'],
      [100, 'centenaire'], [200, 'veteran'], [300, 'expert'], [500, 'maitre'],
      [1000, 'legende'], [2000, 'icone'], [5000, 'mythe'], [10000, 'immortel'],
    ];
    for (const [threshold, type] of volumeThresholds) {
      if (total >= threshold) award(type);
    }

    // ── Discipline générale ───────────────────────────────────────────────────
    if (sauts.some((s) => s.nature_saut === 'nuit')) award('noctambule');
    if (sauts.some((s) => s.nature_saut === 'wingsuit' || matchProgramme([s], /\bwingsuit\b/))) award('aile');
    if (sauts.some((s) => s.fonction === 'instructeur')) award('instructeur_badge');
    if (sauts.some((s) => s.nature_saut === 'tandem')) award('tandem_badge');
    if (sauts.some((s) => s.nature_saut === 'competition')) award('competiteur');
    if (lieux.length >= 3) award('globetrotter');
    if (lieux.length >= 10) award('explorateur');
    const lieuCounts = sauts.reduce<Record<string, number>>((acc, s) => { acc[s.lieu] = (acc[s.lieu] ?? 0) + 1; return acc; }, {});
    if (Object.values(lieuCounts).some((c) => c >= 50)) award('fidele');
    if (sauts.some((s) => s.hauteur_m >= 5000)) award('altitude_max');

    // ── Temporel ──────────────────────────────────────────────────────────────
    if (firstDate) {
      const years = (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (years >= 1) award('anniversaire_1an');
      if (years >= 5) award('anniversaire_5ans');
    }
    const byMonth = sauts.reduce<Record<string, number>>((acc, s) => {
      const key = s.date_saut.substring(0, 7);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    if (Object.values(byMonth).some((c) => c >= 20)) award('saison_active');
    const months = Object.keys(byMonth).sort();
    let streak = 1;
    for (let i = 1; i < months.length; i++) {
      const prev = new Date(months[i - 1] + '-01');
      const curr = new Date(months[i] + '-01');
      const diff = (curr.getFullYear() - prev.getFullYear()) * 12 + curr.getMonth() - prev.getMonth();
      if (diff === 1) { streak++; if (streak >= 6) break; } else streak = 1;
    }
    if (streak >= 6) award('regulier');

    // ── Figures VR ────────────────────────────────────────────────────────────
    const vrPatterns = [/\b(vr|voile.relative|formation.skydiving|fs|rw)\b/];
    const vr2way = [/\b(2.?way|duo)\b/];
    const vr4way = [/\b(4.?way|carré)\b/];
    const vr8way = [/\b(8.?way|octopus)\b/];
    const vrSeq = [/\b(séquentiel|sequential|sequence|séquence)\b/];

    if (matchProgramme(sauts, ...vrPatterns)) award('vr_first_formation');
    if (matchProgramme(sauts, ...vr2way)) award('vr_2way');
    if (matchProgramme(sauts, ...vr4way)) award('vr_4way');
    if (matchProgramme(sauts, ...vr8way)) award('vr_8way');
    if (countProgramme(sauts, ...vr4way) >= 10) award('vr_4way_10x');
    if (matchProgramme(sauts, ...vrSeq)) award('vr_sequential');
    if (countProgramme(sauts, ...vrPatterns) >= 50) award('vr_rw_specialist');

    // ── Figures Freefly ───────────────────────────────────────────────────────
    const ffPatterns = [/\b(freefly|free.fly)\b/];
    const sitPatterns = [/\b(sit.?fly|sit)\b/];
    const hdPatterns = [/\b(head.?down|tête.en.bas)\b/];
    const huPatterns = [/\b(head.?up)\b/];
    const tubePatterns = [/\b(tube|puck)\b/];
    const dynPatterns = [/\b(dynamic|dynamique)\b/];

    if (matchProgramme(sauts, ...sitPatterns)) award('ff_first_sit');
    if (matchProgramme(sauts, ...hdPatterns)) award('ff_first_head_down');
    if (matchProgramme(sauts, ...huPatterns)) award('ff_head_up_stable');
    if (matchProgramme(sauts, ...tubePatterns)) award('ff_tube');
    if (matchProgramme(sauts, ...dynPatterns)) award('ff_dynamic');
    if (countProgramme(sauts, ...ffPatterns, ...sitPatterns, ...hdPatterns) >= 50) award('ff_specialist');

    // ── Figures Tracking / Angle ──────────────────────────────────────────────
    const trackPatterns = [/\b(tracking|track)\b/];
    const anglePatterns = [/\b(angle)\b/];
    const trackGroupPatterns = [/\b(tracking.groupe|group.track|meute)\b/];
    const angleDivePatterns = [/\b(angle.dive|dive)\b/];

    if (matchProgramme(sauts, ...trackPatterns, ...anglePatterns)) award('track_first');
    if (matchProgramme(sauts, ...trackGroupPatterns)) award('track_group');
    if (matchProgramme(sauts, ...angleDivePatterns)) award('track_angle_dive');

    // ── Figures Belly / Solo ──────────────────────────────────────────────────
    const bellyPatterns = [/\b(belly|ventre|chute.libre)\b/];
    const backPatterns = [/\b(dos|backfly|back.fly)\b/];
    const flipPatterns = [/\b(tonneau|tonneaux|flip)\b/];
    const deltaPatterns = [/\b(delta)\b/];
    const trackSoloPatterns = [/\b(tracking.solo|track.solo)\b/];

    if (matchProgramme(sauts, ...bellyPatterns)) award('belly_first_stable');
    if (matchProgramme(sauts, ...backPatterns)) award('belly_backfly');
    if (matchProgramme(sauts, ...flipPatterns)) award('belly_flip');
    if (matchProgramme(sauts, ...deltaPatterns)) award('belly_delta');
    if (countProgramme(sauts, ...trackSoloPatterns) >= 10) award('belly_track_solo');

    // ── Disciplines spéciales ─────────────────────────────────────────────────
    const hookPatterns = [/\b(virage.serré|hook.turn|hook)\b/];
    const swoopPatterns = [/\b(swoop)\b/];
    const wingsuitFormPatterns = [/\b(wingsuit.formation|formation.wingsuit)\b/];
    const speedPatterns = [/\b(speed.skydiving|speed)\b/];

    if (matchProgramme(sauts, ...hookPatterns)) award('canopy_first_hook');
    if (matchProgramme(sauts, ...swoopPatterns)) award('canopy_swoop');
    if (sauts.some((s) => s.nature_saut === 'wingsuit' || matchProgramme([s], /\bwingsuit\b/))) award('wingsuit_first');
    if (matchProgramme(sauts, ...wingsuitFormPatterns)) award('wingsuit_formation');
    if (matchProgramme(sauts, ...speedPatterns)) award('speed_first');

    // ── Caméra & Équipement ───────────────────────────────────────────────────
    const camPatterns = [/\b(cam(era|éra)|gopro|vid(eo|éo))\b/];
    const headCamPatterns = [/\b(casque|head.?cam)\b/];
    const doubleCamPatterns = [/\b(double.cam|2.cam|deux.cam)\b/];
    const tandemCamPatterns = [/\b(tandem.vid|cam(era|éra).tandem)\b/];

    const camCount = countProgramme(sauts, ...camPatterns);
    if (camCount >= 1) award('camera_first_jump');
    if (camCount >= 10) award('camera_10_jumps');
    if (camCount >= 50) award('camera_50_jumps');
    if (countProgramme(sauts, ...tandemCamPatterns) >= 20) award('camera_tandem_pro');
    if (matchProgramme(sauts, ...headCamPatterns)) award('gopro_head');
    if (matchProgramme(sauts, ...doubleCamPatterns)) award('two_cameras');

    if (toAward.length === 0) return;

    // Insert new badges with notifie: false
    for (const type_badge of toAward) {
      await supabase.from('badges').upsert(
        { parachutiste_id: userId, type_badge, date_obtention: new Date().toISOString(), notifie: false },
        { onConflict: 'parachutiste_id,type_badge', ignoreDuplicates: true }
      );
    }

    await load();
  }, [userId, sauts, load]);

  useEffect(() => {
    if (sauts.length > 0) checkAndAward();
  }, [sauts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss notification AND persist to DB so it doesn't reappear on next load
  const dismissBadgeNotif = useCallback(async () => {
    setNewBadge(null);
    if (!userId) return;
    await supabase
      .from('badges')
      .update({ notifie: true })
      .eq('parachutiste_id', userId)
      .eq('notifie', false);
  }, [userId]);

  // Mark all unnotified badges as seen
  const dismissAllBadgeNotifs = useCallback(async () => {
    setNewBadge(null);
    if (!userId) return;
    await supabase
      .from('badges')
      .update({ notifie: true })
      .eq('parachutiste_id', userId)
      .eq('notifie', false);
  }, [userId]);

  return { badges, newBadge, dismissBadgeNotif, dismissAllBadgeNotifs, refresh: load };
}
