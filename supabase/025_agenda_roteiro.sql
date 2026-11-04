-- Roteiro que o apresentador escreveu (PDF ou texto), lido pela IA sem
-- reescrever: uma matéria por bloco do espelho, com manchete, texto de
-- leitura, comentário, a piada (H), a pergunta para reflexão e o serviço.
-- Fica fora do briefing para a pauta da IA poder ser gerada de novo sem
-- apagar o roteiro dele. null = o espelho segue a pauta da IA.
alter table public.agenda_episodios
  add column if not exists roteiro jsonb;
