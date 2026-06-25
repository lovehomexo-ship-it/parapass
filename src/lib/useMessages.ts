import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export interface Message {
  id: string;
  conversation_id: string;
  expediteur_id: string;
  destinataire_id: string;
  contenu: string;
  lu: boolean;
  lu_le: string | null;
  created_at: string;
  expediteur?: { nom: string; prenom: string; avatar_url: string | null };
}

export interface ParticipantDisplay {
  nom: string;
  initiales: string;
  couleur: string;
  avatar_url: string | null;
}

export interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  dernier_message: string;
  dernier_message_at: string;
  created_at: string;
  non_lus?: number;
  nomAffiche: string;
  avatarInitiales: string;
  avatarCouleur: string;
  avatarUrl: string | null;
}

// Module-level cache: avoids re-fetching the same profile within a session
const displayCache = new Map<string, ParticipantDisplay>();

async function resolveParticipantDisplay(userId: string): Promise<ParticipantDisplay> {
  if (displayCache.has(userId)) return displayCache.get(userId)!;

  try {
    // Single query: fetch profile + linked admin_centres + centre name
    const { data } = await supabase
      .from('profiles')
      .select(`
        id, nom, prenom, avatar_url, role,
        admin_centres(centre:centres(id, nom, logo_url))
      `)
      .eq('id', userId)
      .maybeSingle();

    let result: ParticipantDisplay;

    if (!data) {
      result = { nom: 'Utilisateur', initiales: '?', couleur: '#64748B', avatar_url: null };
    } else if (data.role === 'admin_centre' || data.role === 'directeur_technique') {
      // Resolve centre name from the admin_centres join
      type CentreRow = { centre: { id: string; nom: string; logo_url?: string | null } | null } | null;
      const rows = data.admin_centres as CentreRow[] | null;
      const centre = rows?.[0]?.centre;

      if (centre?.nom) {
        const words = centre.nom.trim().split(/\s+/);
        const initiales = words.length >= 2
          ? (words[0][0] + words[1][0]).toUpperCase()
          : centre.nom.substring(0, 2).toUpperCase();
        result = { nom: centre.nom, initiales, couleur: '#F59E0B', avatar_url: centre.logo_url ?? null };
      } else {
        // Fallback: use personal name if centre join returned nothing
        const nom = `${data.prenom ?? ''} ${data.nom ?? ''}`.trim() || 'Centre';
        result = { nom, initiales: nom.substring(0, 2).toUpperCase(), couleur: '#F59E0B', avatar_url: data.avatar_url ?? null };
      }
    } else if (data.role === 'moniteur') {
      const prenom = data.prenom?.trim() ?? '';
      const nom = data.nom?.trim() ?? '';
      const nomComplet = `${prenom} ${nom}`.trim() || 'Moniteur';
      const initiales = ((prenom[0] ?? '') + (nom[0] ?? '')).toUpperCase() || 'MO';
      result = { nom: nomComplet, initiales, couleur: '#10B981', avatar_url: data.avatar_url ?? null };
    } else {
      const prenom = data.prenom?.trim() ?? '';
      const nom = data.nom?.trim() ?? '';
      const nomComplet = `${prenom} ${nom}`.trim() || 'Parachutiste';
      const initiales = ((prenom[0] ?? '') + (nom[0] ?? '')).toUpperCase() || 'PA';
      result = { nom: nomComplet, initiales, couleur: '#2563EB', avatar_url: data.avatar_url ?? null };
    }

    displayCache.set(userId, result);
    return result;
  } catch (err) {
    console.warn('resolveParticipantDisplay error:', err);
    return { nom: 'Utilisateur', initiales: '?', couleur: '#64748B', avatar_url: null };
  }
}

export async function getOrCreateConversation(userId1: string, userId2: string): Promise<Conversation> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, participant_1_id, participant_2_id, dernier_message, dernier_message_at, created_at')
    .or(
      `and(participant_1_id.eq.${userId1},participant_2_id.eq.${userId2}),and(participant_1_id.eq.${userId2},participant_2_id.eq.${userId1})`
    )
    .maybeSingle();

  const raw = existing ?? await (async () => {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ participant_1_id: userId1, participant_2_id: userId2 })
      .select('id, participant_1_id, participant_2_id, dernier_message, dernier_message_at, created_at')
      .single();
    if (error) throw error;
    return created;
  })();

  const otherId = raw.participant_1_id === userId1 ? raw.participant_2_id : raw.participant_1_id;
  const display = await resolveParticipantDisplay(otherId);
  return {
    ...raw,
    nomAffiche: display.nom,
    avatarInitiales: display.initiales,
    avatarCouleur: display.couleur,
    avatarUrl: display.avatar_url,
  } as Conversation;
}

export async function sendMessage(
  currentUserId: string,
  destinataireId: string,
  contenu: string
): Promise<Message> {
  const conv = await getOrCreateConversation(currentUserId, destinataireId);

  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conv.id,
      expediteur_id: currentUserId,
      destinataire_id: destinataireId,
      contenu: contenu.trim(),
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('conversations')
    .update({ dernier_message: contenu.trim(), dernier_message_at: new Date().toISOString() })
    .eq('id', conv.id);

  return msg as Message;
}

// Hook: messages for a single conversation
export function useConversationMessages(conversationId: string | null, currentUserId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*, expediteur:profiles!expediteur_id(nom, prenom, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data as Message[]) ?? []);
    setLoading(false);

    if (currentUserId) {
      await supabase
        .from('messages')
        .update({ lu: true, lu_le: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('destinataire_id', currentUserId)
        .eq('lu', false);
    }
  }, [conversationId, currentUserId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.destinataire_id === currentUserId) {
            await supabase
              .from('messages')
              .update({ lu: true, lu_le: new Date().toISOString() })
              .eq('id', newMsg.id);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, currentUserId]);

  return { messages, loading, reload: load };
}

// Hook: all conversations for a user
export function useConversations(currentUserId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);

    const { data: convs } = await supabase
      .from('conversations')
      .select('id, participant_1_id, participant_2_id, dernier_message, dernier_message_at, created_at')
      .or(`participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId}`)
      .order('dernier_message_at', { ascending: false });

    if (!convs) { setLoading(false); return; }

    const enriched: Conversation[] = await Promise.all(
      convs.map(async (c) => {
        const otherId = c.participant_1_id === currentUserId ? c.participant_2_id : c.participant_1_id;
        const [display, { count }] = await Promise.all([
          resolveParticipantDisplay(otherId),
          supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', c.id)
            .eq('destinataire_id', currentUserId)
            .eq('lu', false),
        ]);

        return {
          ...c,
          non_lus: count ?? 0,
          nomAffiche: display.nom,
          avatarInitiales: display.initiales,
          avatarCouleur: display.couleur,
          avatarUrl: display.avatar_url,
        } as Conversation;
      })
    );

    setConversations(enriched);
    setTotalUnread(enriched.reduce((sum, c) => sum + (c.non_lus ?? 0), 0));
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!currentUserId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`my-messages-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `destinataire_id=eq.${currentUserId}` },
        () => { load(); }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUserId, load]);

  return { conversations, loading, totalUnread, reload: load };
}
