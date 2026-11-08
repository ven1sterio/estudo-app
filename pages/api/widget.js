import { createClient } from '@supabase/supabase-js';

// Devolve sempre um array de datas "YYYY-MM-DD" (dias com eventos/tarefas/provas).
// Query: ?id=<android_id>&y=2026&m=11  (m = 1..12; opcional, padrao = mes atual em Brasilia)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const { id } = req.query;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!id || !supabaseUrl || !supabaseServiceKey) {
    return res.status(401).json({ error: 'ID ou chave de servico ausente.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('device_id', id)
    .maybeSingle();

  if (!profile) return res.status(404).json({ error: 'Dispositivo nao vinculado' });

  const agora = new Date(Date.now() - 3 * 3600 * 1000); // Brasilia (UTC-3)
  const y = parseInt(req.query.y, 10) || agora.getUTCFullYear();
  const m = parseInt(req.query.m, 10) || agora.getUTCMonth() + 1;
  const pad = (n) => String(n).padStart(2, '0');
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const inicioMes = `${y}-${pad(m)}-01`;
  const fimMes = `${y}-${pad(m)}-${pad(ultimo)}`;

  const [ev, tf, pv] = await Promise.all([
    supabase.from('eventos_calendario').select('data').eq('user_id', profile.id).gte('data', inicioMes).lte('data', fimMes),
    supabase.from('tarefas').select('data:data_entrega').eq('user_id', profile.id).gte('data_entrega', inicioMes).lte('data_entrega', fimMes),
    supabase.from('provas').select('data').eq('user_id', profile.id).gte('data', inicioMes).lte('data', fimMes),
  ]);

  const todas = [...(ev.data || []), ...(tf.data || []), ...(pv.data || [])].map((e) => e.data);
  return res.status(200).json([...new Set(todas)]);
}
