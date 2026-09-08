-- ==================================================================
-- Medição de acessos da colinha
-- Rode este arquivo uma vez no SQL Editor do Supabase.
-- Nada aqui guarda IP, user-agent ou qualquer dado que identifique o
-- eleitor: só um id de sessão aleatório, a data e os números digitados.
-- ==================================================================

create table if not exists public.colinha_eventos (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  campanha   text        not null,
  tipo       text        not null check (tipo in ('acesso', 'salvou', 'compartilhou', 'parcial')),
  sessao     text        not null check (char_length(sessao) between 8 and 40),
  numeros    jsonb       not null default '{}'::jsonb
);

create index if not exists colinha_eventos_data_idx     on public.colinha_eventos (criado_em desc);
create index if not exists colinha_eventos_tipo_idx     on public.colinha_eventos (campanha, tipo, criado_em desc);
create index if not exists colinha_eventos_sessao_idx   on public.colinha_eventos (campanha, sessao);

-- Sem policy nenhuma: a tabela só é acessada pela service_role, que fica
-- no servidor (nunca no navegador).
alter table public.colinha_eventos enable row level security;

-- ------------------------------------------------------------------
-- Uma chamada devolve o painel inteiro já agregado.
-- ------------------------------------------------------------------
create or replace function public.colinha_painel(dias int default 30, camp text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with base as (
    select *
    from colinha_eventos
    where criado_em >= now() - make_interval(days => greatest(coalesce(dias, 30), 1))
      and (camp is null or campanha = camp)
  ),
  dias_serie as (
    select to_char(d::date, 'YYYY-MM-DD') as dia
    from generate_series(
      (now() at time zone 'America/Sao_Paulo')::date - (greatest(coalesce(dias, 30), 1) - 1),
      (now() at time zone 'America/Sao_Paulo')::date,
      interval '1 day'
    ) d
  ),
  por_dia as (
    select
      to_char((criado_em at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') as dia,
      count(*) filter (where tipo = 'acesso')                    as acessos,
      count(distinct sessao) filter (where tipo = 'acesso')      as pessoas,
      count(*) filter (where tipo = 'salvou')                    as salvou
    from base
    group by 1
  ),
  serie as (
    select s.dia,
           coalesce(p.acessos, 0) as acessos,
           coalesce(p.pessoas, 0) as pessoas,
           coalesce(p.salvou, 0)  as salvou
    from dias_serie s
    left join por_dia p on p.dia = s.dia
    order by s.dia
  ),
  digitados as (
    select sessao, k.key as cargo, k.value #>> '{}' as numero
    from base, jsonb_each(base.numeros) k
    where tipo in ('salvou', 'compartilhou', 'parcial')
  ),
  ranking as (
    select cargo, numero,
           count(*)               as qtd,
           count(distinct sessao) as pessoas
    from digitados
    group by cargo, numero
  )
  select jsonb_build_object(
    'dias', greatest(coalesce(dias, 30), 1),
    'gerado_em', now(),
    'totais', (
      select jsonb_build_object(
        'acessos',      count(*) filter (where tipo = 'acesso'),
        'pessoas',      count(distinct sessao),
        'salvou',       count(*) filter (where tipo = 'salvou'),
        'compartilhou', count(*) filter (where tipo = 'compartilhou'),
        'colinhas',     count(distinct sessao) filter (where tipo in ('salvou', 'compartilhou', 'parcial'))
      ) from base
    ),
    'hoje', (
      select jsonb_build_object(
        'acessos', count(*) filter (where tipo = 'acesso'),
        'pessoas', count(distinct sessao) filter (where tipo = 'acesso'),
        'salvou',  count(*) filter (where tipo = 'salvou')
      )
      from base
      where (criado_em at time zone 'America/Sao_Paulo')::date
          = (now()     at time zone 'America/Sao_Paulo')::date
    ),
    'por_dia', coalesce((select jsonb_agg(to_jsonb(serie)) from serie), '[]'::jsonb),
    'numeros', coalesce((select jsonb_agg(to_jsonb(ranking) order by qtd desc) from ranking), '[]'::jsonb)
  );
$$;

-- O painel chama a função com a service_role, no servidor.
revoke all on function public.colinha_painel(int, text) from public;
revoke all on function public.colinha_painel(int, text) from anon, authenticated;
