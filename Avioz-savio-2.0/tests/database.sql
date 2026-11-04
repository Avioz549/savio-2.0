-- Synthetic users only. No external services or production data.
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
grant select,insert,update,delete on public.profiles,public.workplaces,public.shifts,public.transactions,public.goals,public.contributions,public.budgets,public.recurring_transactions,public.reminders to authenticated;
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$declare rev bigint; begin
 rev:=public.save_finance_snapshot('{"transactions":[],"workplaces":[],"shifts":[],"goals":[],"budgets":{},"reminders":[],"profile":{"name":"A","currency":"ILS","language":"en","theme":"dark"}}',0);
 if rev<>1 then raise exception 'First revision must equal 1';end if;
 rev:=public.save_finance_snapshot('{"transactions":[],"workplaces":[],"shifts":[],"goals":[],"budgets":{},"reminders":[],"profile":{"name":"A updated","currency":"ILS","language":"en","theme":"dark"}}',1);
 if rev<>2 then raise exception 'Revision must increment';end if;
 begin perform public.save_finance_snapshot('{"transactions":[],"workplaces":[],"shifts":[],"goals":[],"budgets":{},"profile":{}}',1);raise exception 'Stale revision accepted';exception when serialization_failure then null;end;
 insert into public.workplaces(id,user_id,name,hourly_rate) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth.uid(),'Cafe',50);
 insert into public.shifts(user_id,workplace_id,started_at,ended_at,gross_estimate) values(auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-01-01T20:00Z','2026-01-02T05:00Z',450);
 if not public.take_ai_request() then raise exception 'Initial AI request denied';end if;
 if public.take_ai_request() then raise exception 'AI rate limit not enforced';end if;
end $$;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$begin
 if exists(select 1 from public.finance_data) then raise exception 'Cross-user financial snapshot readable';end if;
 if exists(select 1 from public.workplaces) then raise exception 'Cross-user workplace readable';end if;
 if exists(select 1 from public.shifts) then raise exception 'Cross-user shift readable';end if;
 update public.finance_data set data='{}' where user_id='11111111-1111-4111-8111-111111111111';
 if found then raise exception 'Cross-user update allowed';end if;
 begin insert into public.finance_data(user_id,data) values('11111111-1111-4111-8111-111111111111','{}');raise exception 'Cross-user insert allowed';exception when insufficient_privilege then null;end;
 begin insert into public.shifts(user_id,workplace_id,started_at,ended_at,gross_estimate) values(auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-01-01T20:00Z','2026-01-02T05:00Z',450);raise exception 'Cross-user workplace linked';exception when raise_exception then if sqlerrm='Cross-user workplace linked' then raise;end if;end;
 if not public.take_ai_request() then raise exception 'Users share rate-limit bucket';end if;
 perform public.save_finance_snapshot('{"transactions":[],"workplaces":[],"shifts":[],"goals":[],"budgets":{},"profile":{}}',0);
 perform public.delete_my_account();
end $$;
reset role;
do $$begin
 if exists(select 1 from auth.users where id='22222222-2222-4222-8222-222222222222') then raise exception 'Account deletion failed';end if;
 if exists(select 1 from public.finance_data where user_id='22222222-2222-4222-8222-222222222222') then raise exception 'Account data did not cascade';end if;
 if (select data->'profile'->>'name' from public.finance_data where user_id='11111111-1111-4111-8111-111111111111')<>'A updated' then raise exception 'Other user data changed';end if;
end $$;
set role anon;
set request.jwt.claim.sub='';
do $$begin
 begin perform public.save_finance_snapshot('{}',0);raise exception 'Anonymous snapshot mutation allowed';exception when insufficient_privilege then null;end;
 begin perform public.delete_my_account();raise exception 'Anonymous deletion allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: revisions, stale-write rejection, RLS isolation, foreign ownership, rate limits, self-deletion and cascades' as result;
