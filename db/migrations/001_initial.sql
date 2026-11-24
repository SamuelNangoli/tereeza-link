-- Isolated namespace: never modifies tables from another app in this Neon project.
create table tereeza.links (
 id uuid primary key default gen_random_uuid(),
 slug text unique not null check (slug ~ '^[a-z0-9_-]{3,40}$'),
 url text not null check (length(url)<=4096),
 manage_hash text not null,
 created_at timestamptz not null default now(), expires_at timestamptz,
 disabled boolean not null default false, total_clicks bigint not null default 0
);
create table tereeza.daily_clicks (
 link_id uuid references tereeza.links on delete cascade,
 day date not null,referrer text not null,device text not null,
 clicks bigint not null default 1,primary key(link_id,day,referrer,device)
);
create table tereeza.click_dedup (
 link_id uuid references tereeza.links on delete cascade,
 visitor text not null,day date not null,primary key(link_id,visitor,day)
);
create table tereeza.rate_limits (key text primary key,started_at timestamptz not null,hits integer not null);
create table tereeza.reports (
 id uuid primary key default gen_random_uuid(),slug text not null,
 reason text not null check(length(reason) between 10 and 1000),
 created_at timestamptz not null default now()
);
create index links_created_idx on tereeza.links(created_at desc,id desc);
create index reports_created_idx on tereeza.reports(created_at desc,id desc);
create index rate_limits_cleanup_idx on tereeza.rate_limits(started_at);
create index dedup_cleanup_idx on tereeza.click_dedup(day);
create index daily_cleanup_idx on tereeza.daily_clicks(day);

-- No public/browser Data API. Only the private server connection accesses this schema.
alter table tereeza.links enable row level security;
alter table tereeza.daily_clicks enable row level security;
alter table tereeza.click_dedup enable row level security;
alter table tereeza.rate_limits enable row level security;
alter table tereeza.reports enable row level security;
revoke all on all tables in schema tereeza from public;

create function tereeza.consume_limit(p_key text,p_max int,p_seconds int)
returns boolean language plpgsql security invoker set search_path=pg_catalog,tereeza as $$
declare n int;
begin
 insert into tereeza.rate_limits(key,started_at,hits) values(p_key,now(),1)
 on conflict(key) do update set
  hits=case when rate_limits.started_at < now()-make_interval(secs=>p_seconds) then 1 else rate_limits.hits+1 end,
  started_at=case when rate_limits.started_at < now()-make_interval(secs=>p_seconds) then now() else rate_limits.started_at end
 returning hits into n;
 return n<=p_max;
end $$;
create function tereeza.record_click(p_link uuid,p_visitor text,p_ref text,p_device text)
returns void language plpgsql security invoker set search_path=pg_catalog,tereeza as $$
declare today date := (now() at time zone 'UTC')::date;
begin
 insert into tereeza.click_dedup values(p_link,p_visitor,today) on conflict do nothing;
 if not found then return;end if;
 update tereeza.links set total_clicks=total_clicks+1 where id=p_link;
 insert into tereeza.daily_clicks values(p_link,today,p_ref,p_device,1)
 on conflict(link_id,day,referrer,device) do update set clicks=daily_clicks.clicks+1;
end $$;
revoke all on function tereeza.consume_limit(text,int,int),tereeza.record_click(uuid,text,text,text) from public;
