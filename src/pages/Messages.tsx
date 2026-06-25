import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Layout } from '../components/Layout';
import { sendMessage, useConversationMessages, useConversations, getOrCreateConversation } from '../lib/useMessages';
import type { Message, Conversation } from '../lib/useMessages';
import { MessageSquare, Send, ChevronLeft } from 'lucide-react';

const MESSAGES_RAPIDES = [
  { label: 'Salut !', text: 'Salut ! Comment tu vas ?' },
  { label: 'Ce week-end ?', text: 'Tu sautes ce week-end ?' },
  { label: 'Super saut !', text: 'Super saut, bien joué !' },
  { label: 'À la DZ ?', text: 'On se retrouve à la DZ ?' },
];

function fmt(d: string) {
  const dt = new Date(d);
  const today = new Date();
  if (dt.toDateString() === today.toDateString()) {
    return dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function Avatar({ initiales, couleur, size = 'md' }: { initiales: string; couleur: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ background: couleur }}
    >
      {initiales}
    </div>
  );
}

function ChatArea({
  conversation,
  currentUserId,
  onBack,
}: {
  conversation: Conversation;
  currentUserId: string;
  onBack: () => void;
}) {
  const { messages, loading } = useConversationMessages(conversation.id, currentUserId);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const destinataireId = conversation.participant_1_id === currentUserId
    ? conversation.participant_2_id
    : conversation.participant_1_id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setSending(true);
    try {
      await sendMessage(currentUserId, destinataireId, input.trim());
      setInput('');
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#001A4D' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b sticky top-0" style={{ borderColor: 'rgba(255,255,255,0.1)', background: '#001A4D' }}>
        <button onClick={onBack} className="md:hidden p-1.5 rounded-lg transition" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Avatar initiales={conversation.avatarInitiales} couleur={conversation.avatarCouleur} />
        <div>
          <p className="font-semibold text-sm" style={{ color: '#FFFFFF' }}>{conversation.nomAffiche}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#001A4D' }}>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm py-12" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Commencez la conversation avec {conversation.nomAffiche}
          </div>
        ) : (
          messages.map((m: Message) => {
            const isMine = m.expediteur_id === currentUserId;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && (
                  <Avatar initiales={conversation.avatarInitiales} couleur={conversation.avatarCouleur} size="sm" />
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? 'text-white rounded-br-sm' : 'rounded-bl-sm'}`} style={{
                  background: isMine ? '#001A4D' : 'rgba(255,255,255,0.08)',
                  color: isMine ? '#FFFFFF' : '#FFFFFF',
                  border: isMine ? 'none' : '1px solid rgba(255,255,255,0.1)',
                }}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.contenu}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px]" style={{ color: isMine ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.4)' }}>{fmt(m.created_at)}</span>
                    {isMine && (
                      <span className="text-[10px]" style={{ color: m.lu ? '#60A5FA' : 'rgba(255,255,255,0.3)' }}>
                        {m.lu ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Quick replies */}
      <div className="px-4 py-2 border-t bg-transparent flex gap-2 overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        {MESSAGES_RAPIDES.map(mr => (
          <button
            key={mr.label}
            onClick={() => setInput(mr.text)}
            className="flex-shrink-0 text-xs rounded-full px-3 py-1.5 transition" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
          >
            {mr.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t flex items-end gap-2" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrire un message... (Entrée pour envoyer)"
            rows={2}
            maxLength={500}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF' }}
            className="w-full px-3.5 py-2.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 resize-none"
          />
          <span className="absolute bottom-3 right-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{input.length}/500</span>
        </div>
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="p-3 text-white rounded-2xl transition flex-shrink-0" style={{ background: '#001A4D' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)', background: '#001A4D' }}>
        <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: '#FFFFFF' }}>
          <MessageSquare className="w-5 h-5" style={{ color: '#001A4D' }} /> Messages
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-sm p-8" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune conversation</div>
        ) : (
          conversations.map(conv => {
            const isActive = conv.id === selectedId;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className="w-full flex items-center gap-3 px-4 py-4 border-b transition text-left" style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid #F59E0B' : 'none',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full text-white flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: conv.avatarCouleur }}
                >
                  {conv.avatarInitiales}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate" style={{ color: (conv.non_lus ?? 0) > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.7)' }}>
                      {conv.nomAffiche}
                    </p>
                    {conv.dernier_message_at && (
                      <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{fmt(conv.dernier_message_at)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs truncate" style={{ color: (conv.non_lus ?? 0) > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)' }}>
                      {conv.dernier_message || 'Nouvelle conversation'}
                    </p>
                    {(conv.non_lus ?? 0) > 0 && (
                      <span className="text-[10px] text-white rounded-full px-1.5 py-0.5 ml-2 flex-shrink-0" style={{ background: '#EF4444' }}>{conv.non_lus}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { conversations, loading } = useConversations(user?.id);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null;

  useEffect(() => {
    const targetUserId = searchParams.get('userId');
    const targetConvId = searchParams.get('convId');

    if (targetConvId) {
      setSelectedConvId(targetConvId);
      return;
    }

    if (targetUserId && user) {
      (async () => {
        try {
          const conv = await getOrCreateConversation(user.id, targetUserId);
          setSelectedConvId(conv.id);
        } catch {
          // ignore
        }
      })();
    }
  }, [searchParams, user]);

  useEffect(() => {
    const hasDeepLink = searchParams.get('userId') || searchParams.get('convId');
    if (!selectedConvId && conversations.length > 0 && window.innerWidth >= 768 && !hasDeepLink) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId, searchParams]);

  if (!user) { navigate('/login'); return null; }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#001A4D', border: '1px solid rgba(255,255,255,0.1)', height: 'calc(100vh - 160px)' }}>
          <div className="flex h-full">
            <div className={`w-full md:w-72 flex-shrink-0 ${selectedConvId ? 'hidden md:block' : 'block'}`} style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              <ConversationList
                conversations={conversations}
                selectedId={selectedConvId}
                onSelect={setSelectedConvId}
                loading={loading}
              />
            </div>
            <div className={`flex-1 min-w-0 ${!selectedConvId ? 'hidden md:flex md:items-center md:justify-center' : 'flex flex-col'}`}>
              {!selectedConvId ? (
                <div className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <MessageSquare className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
                  Sélectionnez une conversation
                </div>
              ) : selectedConv ? (
                <ChatArea
                  conversation={selectedConv}
                  currentUserId={user.id}
                  onBack={() => setSelectedConvId(null)}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
