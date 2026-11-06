import { useState } from 'react';
import { ShieldCheck, Timer, Download, Usb, MessageCircleOff, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useApi } from '../api.js';
import { useToast } from '../context.jsx';
import { addDays, fmtDate, fmtDateTime, gtDateKey } from '../utils.js';
import { Badge, Button, Input, Modal } from './ui.jsx';

/** Estado del respaldo según los días desde el último */
export function backupState(status) {
  const every = status?.every_days ?? 7;
  if (!status?.last_backup_at) return { tone: 'tone-red', label: 'Sin respaldos todavía', due: true, days: null, every };
  const days = Math.floor((Date.now() - new Date(status.last_backup_at)) / 86400000);
  if (days <= every) return { tone: 'tone-green', label: 'Al día', due: false, days, every };
  if (days <= every * 2) return { tone: 'tone-amber', label: 'Toca respaldar', due: true, days, every };
  return { tone: 'tone-red', label: 'Respaldo atrasado', due: true, days, every };
}

export const useBackupStatus = (enabled = true) => useApi(enabled ? '/backup/status' : null);

const sinceLabel = (days) => (days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`);

export function BackupCard() {
  const { data: status, reload } = useBackupStatus();
  const [open, setOpen] = useState(false);
  const st = backupState(status);
  const next = status?.last_backup_at ? addDays(gtDateKey(status.last_backup_at), st.every) : gtDateKey();

  return (
    <div id="respaldo" className="card backup-card">
      <div className="backup-main">
        <div className="backup-icon">
          <ShieldCheck size={26} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 10 }}>
            <h3 style={{ fontSize: 18 }}>Respaldo de seguridad</h3>
            {status && <Badge tone={st.tone}>{st.label}</Badge>}
          </div>
          <p className="muted" style={{ margin: '4px 0 12px' }}>
            Copia cifrada de todos los expedientes, citas, cobros, recetas y laboratorios, para guardarla fuera de la nube.
          </p>
          <div className="reco-pill">
            <Timer size={16} />
            <span>
              Toma <b>menos de 1 minuto</b> · Recomendado <b>cada {st.every} días</b>
            </span>
          </div>
        </div>
        <div className="backup-side">
          <div className="small muted">Último respaldo</div>
          <div className="strong">{status?.last_backup_at ? `${sinceLabel(st.days)} · ${fmtDateTime(status.last_backup_at)}` : 'Nunca'}</div>
          <div className="small muted" style={{ marginTop: 6 }}>Próximo recomendado</div>
          <div className="strong" style={{ color: st.due ? 'var(--red)' : 'var(--text)' }}>{st.due ? 'Hoy' : fmtDate(next)}</div>
          <Button icon={Download} style={{ marginTop: 12 }} block onClick={() => setOpen(true)}>
            Descargar respaldo
          </Button>
        </div>
      </div>
      <div className="backup-tips">
        <span><Usb size={15} /> Guárdelo en su memoria USB o en Google Drive</span>
        <span><MessageCircleOff size={15} /> No lo envíe por WhatsApp ni por correo</span>
        <span><KeyRound size={15} /> Sin la contraseña no se puede abrir: anótela en un lugar seguro</span>
      </div>
      <BackupModal open={open} onClose={() => setOpen(false)} hasPassword={!!status?.has_password} onDone={reload} />
    </div>
  );
}

function BackupModal({ open, onClose, hasPassword, onDone }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [newPassword, setNewPassword] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const choosing = !hasPassword || newPassword;

  const close = () => {
    setPassword('');
    setConfirm('');
    setNewPassword(false);
    onClose();
  };

  const download = async () => {
    if (password.length < 8) return toast.error('La contraseña debe tener al menos 8 caracteres');
    if (choosing && password !== confirm) return toast.error('Las contraseñas no coinciden');
    const name = `Respaldo_Clinica_${gtDateKey()}.cmpvbak`;
    // La ventana "Guardar como" debe abrirse en el mismo clic (Chrome y Edge)
    let handle = null;
    if (window.showSaveFilePicker) {
      try {
        handle = await window.showSaveFilePicker({
          id: 'cmpv-respaldos',
          suggestedName: name,
          startIn: 'documents',
          types: [{ description: 'Respaldo de la clínica', accept: { 'application/octet-stream': ['.cmpvbak'] } }],
        });
      } catch (e) {
        if (e.name === 'AbortError') return; // canceló la ventana
      }
    }
    setBusy(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ password, new_password: newPassword }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo generar el respaldo');
      const blob = await res.blob();
      if (handle) {
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
      } else {
        // Navegadores sin "Guardar como": va a la carpeta Descargas
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: name });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      toast.success(handle ? `Respaldo guardado como ${handle.name}` : 'Respaldo descargado en la carpeta Descargas');
      onDone?.();
      close();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const eye = (
    <button type="button" className="pwd-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      width={520}
      icon={ShieldCheck}
      title="Descargar respaldo"
      subtitle="El archivo queda cifrado: solo se abre con esta contraseña"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancelar</Button>
          <Button icon={Download} loading={busy} onClick={download}>
            {window.showSaveFilePicker ? 'Elegir dónde guardar' : 'Descargar'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {choosing ? (
          <div className="mini">
            {hasPassword
              ? 'Elija una contraseña nueva. Los respaldos anteriores seguirán abriéndose con la contraseña anterior.'
              : 'Es su primer respaldo: elija una contraseña de al menos 8 caracteres. Se usará en todos los respaldos siguientes.'}
          </div>
        ) : (
          <div className="mini">Escriba la misma contraseña de sus respaldos anteriores.</div>
        )}
        <div style={{ position: 'relative' }}>
          <Input label="Contraseña del respaldo" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          {eye}
        </div>
        {choosing && (
          <Input label="Repita la contraseña" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        )}
        {hasPassword && (
          <label className="check small">
            <input type="checkbox" checked={newPassword} onChange={(e) => setNewPassword(e.target.checked)} /> Usar una contraseña nueva
          </label>
        )}
        <div className="small muted">
          {window.showSaveFilePicker
            ? 'Se abrirá la ventana para elegir la carpeta, por ejemplo su memoria USB o Google Drive. La próxima vez abrirá en la misma carpeta.'
            : 'Su navegador guardará el archivo en la carpeta Descargas; luego muévalo a su memoria USB o Google Drive.'}
        </div>
      </div>
    </Modal>
  );
}
