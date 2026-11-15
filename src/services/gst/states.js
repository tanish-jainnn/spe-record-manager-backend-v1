// GST state / UT codes (place of supply).
export const ST = { '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory' };
const key = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
const KEY = Object.fromEntries(Object.entries(ST).map(([k, v]) => [key(v), k]));
const ALIAS = { orissa: '21', pondicherry: '34', dadraandnagarhaveli: '26', damananddiu: '26', andamanandnicobar: '35', uttaranchal: '05', chattisgarh: '22', nctofdelhi: '07', newdelhi: '07', telengana: '36', jammuandkashmir: '01' };

function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
/** "07-Delhi", "DELHI", "Orissa", "NagalandNagaland" ... -> '07' (null if not recognised). */
export function stateCode(raw) {
  const s = String(raw ?? '').trim();
  const m = /^(\d{2})\s*-/.exec(s);
  if (m && ST[m[1]]) return m[1];
  const k = key(s);
  if (KEY[k]) return KEY[k];
  if (ALIAS[k]) return ALIAS[k];
  let best = null; let bd = 1e9;
  for (const [n, c] of [...Object.entries(KEY), ...Object.entries(ALIAS)]) { const d = lev(k, n) / Math.max(k.length, n.length); if (d < bd) { bd = d; best = c; } }
  return bd <= 0.2 ? best : null;
}
export const stateName = (c) => ST[c] || c;
