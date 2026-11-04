-- Espelho da transmissão: o roteiro bloco a bloco e as imagens de cada
-- bloco num link só, para a equipe técnica acompanhar o âncora e os
-- comentaristas. espelho_atual = o bloco no ar (0 = abertura), null = antes
-- de começar. agenda_materiais.bloco = em que bloco a imagem entra.
-- espelho_imagem = a imagem na tela do OBS: null = a primeira do bloco no
-- ar, o id de um material, ou 'nenhuma' (tela vazia).
alter table public.agenda_episodios
  add column if not exists espelho_token text unique,
  add column if not exists espelho_atual integer,
  add column if not exists espelho_imagem text;

alter table public.agenda_materiais
  add column if not exists bloco integer;
