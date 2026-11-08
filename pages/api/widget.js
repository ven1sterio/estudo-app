import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { id } = req.query; // id é o device_id do Android
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!id || !supabaseServiceKey) {
    return res.status(401).json({ error: 'ID ou chave de serviço ausente.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('device_id', id)
    .maybeSingle();

  if (!profile) return res.status(404).json({ error: 'Dispositivo não vinculado' });

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const [ev, tf, pv] = await Promise.all([
    supabase.from('eventos_calendario').select('data').eq('user_id', profile.id).gte('data', inicioMes).lte('data', fimMes),
    supabase.from('tarefas').select('data_entrega as data').eq('user_id', profile.id).gte('data_entrega', inicioMes).lte('data_entrega', fimMes),
    supabase.from('provas').select('data').eq('user_id', profile.id).gte('data', inicioMes).lte('data', fimMes)
  ]);

  const todasDatas = [...(ev.data || []), ...(tf.data || []), ...(pv.data || [])].map(e => e.data);
  return res.status(200).json(todasDatas);
}
