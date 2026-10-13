// Utilitários gerais: dinheiro (sempre em centavos inteiros), datas locais e IDs.

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('pt-BR');

/** Centavos -> "R$ 1.234,56" */
export const brl = (cents) => fmtBRL.format((cents || 0) / 100);
/** Centavos -> "R$ 1.235" (sem casas decimais, para cards compactos) */
export const brl0 = (cents) => fmtBRL0.format(Math.round((cents || 0) / 100));
export const num = (n) => fmtNum.format(n || 0);

/** Reais (float, formato antigo) -> centavos inteiros */
export const toCents = (reais) => Math.round((Number(reais) || 0) * 100);

/** Mantém apenas dígitos e limita o tamanho */
export const onlyDigits = (str, max = 9) => String(str ?? '').replace(/\D/g, '').slice(0, max);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------- Datas ----------
// Todas as datas do app são guardadas como 'AAAA-MM-DD' no horário local,
// o que evita o bug clássico de fuso horário (dia virando o anterior).

const pad = (n) => String(n).padStart(2, '0');

export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISODate(new Date());

/** 'AAAA-MM-DD' -> Date local (meia-noite) */
export const parseDate = (s) => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Converte um ISO com hora (formato antigo) para data local 'AAAA-MM-DD' */
export const isoToLocalDate = (iso) => {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  return isNaN(d) ? null : toISODate(d);
};

export const daysBetween = (a, b) => {
  const da = parseDate(a), db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / 86400000);
};

export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** 'AAAA-MM-DD' -> '13/10' */
export const dm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '--/--');
/** 'AAAA-MM-DD' -> '13/10/2026' */
export const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '--');

/** Mês de referência como { y, m } (m = 0..11) */
export const monthOf = (s) => {
  const d = parseDate(s);
  return d ? { y: d.getFullYear(), m: d.getMonth() } : null;
};
export const sameMonth = (s, y, m) => {
  if (!s) return false;
  return Number(s.slice(0, 4)) === y && Number(s.slice(5, 7)) - 1 === m;
};
export const shiftMonth = ({ y, m }, delta) => {
  const d = new Date(y, m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};
export const currentMonth = () => {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
};
export const monthLabel = ({ y, m }) => `${MESES[m]} ${y}`;
export const daysInMonth = ({ y, m }) => new Date(y, m + 1, 0).getDate();

/** Formata a referência '0123A' como '0123 A' */
export const fmtRef = (ref) => String(ref || '').replace(/^(\d+)([A-Za-z]+)$/, '$1 $2');

/** Lê um arquivo como texto */
export const readFileText = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });

/** Lê uma imagem, reduz para no máximo `max` px e devolve um dataURL JPEG (ou PNG se quiser transparência) */
export const resizeImage = (file, max = 800, type = 'image/jpeg', quality = 0.75) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, max / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL(type, quality));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });

export const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** Tenta compartilhar um arquivo (celular); se não der, baixa. */
export const shareOrDownload = async (blob, fileName, title, text) => {
  try {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
};
