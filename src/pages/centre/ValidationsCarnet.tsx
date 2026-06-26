import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, X, ChevronDown, ChevronUp, Upload, ExternalLink } from 'lucide-react';

interface ParaEnAttente {
  licencie_id: string;
  parachutiste_id: string;
  carnet_statut: string;
  carnet_valide_par: string | null;
  carnet_date_validation: string | null;
  carnet_signature_url: string | null;
  carnet_tampon_url: string | null;
  carnet_motif_refus: string | null;
  profile: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    numero_licence: string | null;
    photo_profil_url: string | null;
  };
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    const pos = getPos(e, canvas);
    canvas.getContext('2d')!.beginPath();
    canvas.getContext('2d')!.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#001A4D';
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
  };

  const stop = () => {
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef} width={600} height={140}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none cursor-crosshair"
        style={{ minHeight: 120 }}
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
      />
      <button type="button" onClick={clear} className="text-xs px-2 py-1 border border-gray-300 rounded bg-white text-gray-600 flex items-center gap-1 hover:bg-gray-50">
        <X className="w-3 h-3" /> Effacer
      </button>
    </div>
  );
}

async function uploadToStorage(dzId: string, file: File, folder: string): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${folder}/${dzId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('parapass-docs').upload(path, file, { upsert: true });
  if (error) return null;
  return path;
}

interface ValFormState {
  nomDt: string;
  dateValidation: string;
  signatureDataUrl: string | null;
  tampFileUrl: string | null;
  uploading: boolean;
  saving: boolean;
}

function ValidationForm({
  para,
  dzId,
  onDone,
}: {
  para: ParaEnAttente;
  dzId: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState<ValFormState>({
    nomDt: '',
    dateValidation: new Date().toISOString().split('T')[0],
    signatureDataUrl: null,
    tampFileUrl: null,
    uploading: false,
    saving: false,
  });
  const [showRefus, setShowRefus] = useState(false);
  const [motifRefus, setMotifRefus] = useState('');
  const tampRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<ValFormState>) => setForm(f => ({ ...f, ...patch }));

  const handleTampFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    set({ uploading: true });
    const path = await uploadToStorage(dzId, e.target.files[0], 'tampons');
    set({ tampFileUrl: path, uploading: false });
  };

  const handleSignature = async (dataUrl: string | null) => {
    set({ signatureDataUrl: dataUrl });
  };

  const uploadSignature = async (): Promise<string | null> => {
    if (!form.signatureDataUrl) return null;
    const blob = await fetch(form.signatureDataUrl).then(r => r.blob());
    const file = new File([blob], 'signature_dt.png', { type: 'image/png' });
    return await uploadToStorage(dzId, file, 'signatures');
  };

  const valider = async () => {
    set({ saving: true });
    const signaturePath = await uploadSignature();
    await supabase.from('licencies_centres').update({
      carnet_statut: 'valide',
      carnet_valide_par: form.nomDt || null,
      carnet_date_validation: form.dateValidation || null,
      carnet_signature_url: signaturePath,
      carnet_tampon_url: form.tampFileUrl,
      carnet_motif_refus: null,
    }).eq('id', para.licencie_id);
    // Notification au parachutiste
    await supabase.from('notifications').insert({
      user_id: para.parachutiste_id,
      titre: 'Carnet validé ✓',
      message: `Votre carnet parachutiste a été validé${form.nomDt ? ' par ' + form.nomDt : ''}.`,
      type: 'success',
      lu: false,
    });
    set({ saving: false });
    onDone();
  };

  const refuser = async () => {
    if (!motifRefus.trim()) return;
    set({ saving: true });
    await supabase.from('licencies_centres').update({
      carnet_statut: 'refuse',
      carnet_motif_refus: motifRefus,
      carnet_valide_par: null,
      carnet_date_validation: null,
      carnet_signature_url: null,
    }).eq('id', para.licencie_id);
    await supabase.from('notifications').insert({
      user_id: para.parachutiste_id,
      titre: 'Validation carnet refusée',
      message: `Votre demande de validation de carnet a été refusée. Motif : ${motifRefus}`,
      type: 'warning',
      lu: false,
    });
    set({ saving: false });
    onDone();
  };

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-white text-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="mt-4 space-y-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-dim)' }}>Formulaire de validation</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-dim)' }}>Nom DT / responsable</label>
          <input className={inputCls} value={form.nomDt} onChange={e => set({ nomDt: e.target.value })} placeholder="Prénom NOM" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-dim)' }}>Date de validation</label>
          <input type="date" className={inputCls} value={form.dateValidation} onChange={e => set({ dateValidation: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-dim)' }}>Tampon DZ (optionnel — PDF ou image)</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => tampRef.current?.click()}
            disabled={form.uploading}
            className="flex items-center gap-1 border border-gray-300 bg-white text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" /> {form.uploading ? 'Chargement…' : 'Téléverser'}
          </button>
          {form.tampFileUrl && (
            <a href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/parapass-docs/${form.tampFileUrl}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 text-xs hover:underline">
              <ExternalLink className="w-3 h-3" /> Voir
            </a>
          )}
          <input ref={tampRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleTampFile} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-dim)' }}>Signature numérique (doigt/souris)</label>
        <SignaturePad onChange={handleSignature} />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={valider}
          disabled={form.saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
        >
          <Check className="w-4 h-4" /> {form.saving ? 'Enregistrement…' : 'Valider le carnet'}
        </button>
        <button
          onClick={() => setShowRefus(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <X className="w-4 h-4" /> Refuser
        </button>
      </div>

      {showRefus && (
        <div className="space-y-2">
          <label className="block text-xs font-medium" style={{ color: 'var(--c-dim)' }}>Motif du refus</label>
          <textarea
            className={inputCls + ' resize-none'}
            rows={3}
            value={motifRefus}
            onChange={e => setMotifRefus(e.target.value)}
            placeholder="Expliquez la raison du refus au parachutiste…"
          />
          <button
            onClick={refuser}
            disabled={!motifRefus.trim() || form.saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition disabled:opacity-50"
            style={{ background: '#EF4444' }}
          >
            <X className="w-3.5 h-3.5" /> Confirmer le refus
          </button>
        </div>
      )}
    </div>
  );
}

function ParaCard({ para, dzId, onDone }: { para: ParaEnAttente; dzId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const { profile, carnet_statut, carnet_valide_par, carnet_date_validation, carnet_motif_refus } = para;

  const initials = `${profile.prenom[0] ?? ''}${profile.nom[0] ?? ''}`.toUpperCase();

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: 'var(--c-border)' }}>
          {profile.photo_profil_url
            ? <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.photo_profil_url}`} className="w-9 h-9 rounded-full object-cover" alt="" />
            : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{profile.prenom} {profile.nom}</p>
          {profile.numero_licence && (
            <p className="text-xs" style={{ color: 'var(--c-dim)' }}>Licence {profile.numero_licence}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {carnet_statut === 'valide' && (
            <span className="text-xs font-semibold text-green-400">✓ Validé{carnet_valide_par ? ` par ${carnet_valide_par}` : ''}</span>
          )}
          {carnet_statut === 'refuse' && (
            <span className="text-xs font-semibold text-red-400">✗ Refusé</span>
          )}
          {carnet_statut === 'en_attente' && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              En attente
            </span>
          )}
          <button onClick={() => setOpen(v => !v)} className="p-1 rounded transition" style={{ color: 'var(--c-dim)' }}>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4">
          {carnet_statut === 'valide' && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(16,185,129,0.08)', color: '#34D399' }}>
              Validé{carnet_valide_par ? ` par ${carnet_valide_par}` : ''}
              {carnet_date_validation && ` — le ${new Date(carnet_date_validation).toLocaleDateString('fr-FR')}`}
            </div>
          )}
          {carnet_statut === 'refuse' && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171' }}>
              Refusé{carnet_motif_refus ? ` — ${carnet_motif_refus}` : ''}
            </div>
          )}
          {carnet_statut === 'en_attente' && (
            <ValidationForm para={para} dzId={dzId} onDone={onDone} />
          )}
          {carnet_statut !== 'en_attente' && (
            <button
              onClick={() => {
                supabase.from('licencies_centres').update({ carnet_statut: 'en_attente', carnet_valide_par: null, carnet_date_validation: null, carnet_signature_url: null, carnet_motif_refus: null }).eq('id', para.licencie_id).then(onDone);
              }}
              className="mt-3 text-xs px-3 py-1.5 rounded-lg transition"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--c-dim)', border: '1px solid var(--c-border)' }}
            >
              Remettre en attente
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ValidationsCarnet({ dzId }: { dzId: string }) {
  const [paras, setParas] = useState<ParaEnAttente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'en_attente' | 'valide' | 'refuse' | 'tous'>('en_attente');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('licencies_centres')
      .select(`
        id,
        parachutiste_id,
        carnet_statut,
        carnet_valide_par,
        carnet_date_validation,
        carnet_signature_url,
        carnet_tampon_url,
        carnet_motif_refus,
        profiles!parachutiste_id(id, nom, prenom, email, numero_licence, photo_profil_url)
      `)
      .eq('centre_id', dzId)
      .eq('statut', 'actif');

    if (data) {
      const list: ParaEnAttente[] = (data as unknown as Array<{
        id: string;
        parachutiste_id: string;
        carnet_statut: string;
        carnet_valide_par: string | null;
        carnet_date_validation: string | null;
        carnet_signature_url: string | null;
        carnet_tampon_url: string | null;
        carnet_motif_refus: string | null;
        profiles: { id: string; nom: string; prenom: string; email: string; numero_licence: string | null; photo_profil_url: string | null };
      }>).map(d => ({
        licencie_id: d.id,
        parachutiste_id: d.parachutiste_id,
        carnet_statut: d.carnet_statut,
        carnet_valide_par: d.carnet_valide_par,
        carnet_date_validation: d.carnet_date_validation,
        carnet_signature_url: d.carnet_signature_url,
        carnet_tampon_url: d.carnet_tampon_url,
        carnet_motif_refus: d.carnet_motif_refus,
        profile: d.profiles,
      }));
      setParas(list);
    }
    setLoading(false);
  }, [dzId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'tous' ? paras : paras.filter(p => p.carnet_statut === filter);
  const countEn = paras.filter(p => p.carnet_statut === 'en_attente').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-4 border-white/10 border-t-white/60 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Validations carnet</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--c-dim)' }}>
          Validez les carnets parachutistes de vos licenciés actifs.
        </p>
      </div>

      {/* Filtre */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'en_attente', label: `En attente${countEn > 0 ? ` (${countEn})` : ''}` },
          { key: 'valide', label: 'Validés' },
          { key: 'refuse', label: 'Refusés' },
          { key: 'tous', label: 'Tous' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
            style={{
              background: filter === f.key ? '#3B82F6' : 'var(--c-surface)',
              color: filter === f.key ? '#fff' : 'var(--c-dim)',
              border: `1px solid ${filter === f.key ? '#3B82F6' : 'var(--c-border-f)'}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
          <p className="text-sm" style={{ color: 'var(--c-dim)' }}>
            {filter === 'en_attente' ? 'Aucune demande de validation en attente.' : 'Aucun résultat pour ce filtre.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(para => (
            <ParaCard key={para.licencie_id} para={para} dzId={dzId} onDone={load} />
          ))}
        </div>
      )}
    </div>
  );
}
