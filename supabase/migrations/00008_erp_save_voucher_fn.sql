-- 전표 저장을 한 트랜잭션으로: 머리 저장 + 기존 줄 삭제 + 새 줄 입력이
-- 모두 성공하거나 모두 취소된다(중간에 실패해도 기존 전표가 그대로 남는다).
-- 서버(서비스 롤)에서만 호출한다.

create or replace function public.acct_save_voucher(p jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint := nullif(p->>'id', '')::bigint;
  v_date date := (p->>'voucher_date')::date;
  v_old_date date;
  v_no integer;
begin
  if v_id is not null then
    select voucher_date into v_old_date
      from public.acct_vouchers where id = v_id for update;
    if not found then
      raise exception '전표를 찾을 수 없습니다.';
    end if;
  end if;

  if v_id is null or v_old_date is distinct from v_date then
    -- 같은 날짜 전표번호를 동시에 매기지 않도록 날짜 단위로 잠근다
    perform pg_advisory_xact_lock(hashtext('acct_voucher_no:' || v_date::text));
    select coalesce(max(voucher_no), 0) + 1 into v_no
      from public.acct_vouchers where voucher_date = v_date;
  end if;

  if v_id is null then
    insert into public.acct_vouchers
      (voucher_date, voucher_no, kind, partner_id, card_partner_id, card_fee, memo, source_voucher_id)
    values (
      v_date, v_no,
      (p->>'kind')::public.acct_voucher_kind,
      nullif(p->>'partner_id', '')::bigint,
      nullif(p->>'card_partner_id', '')::bigint,
      0,
      nullif(p->>'memo', ''),
      nullif(p->>'source_voucher_id', '')::bigint
    )
    returning id into v_id;
  else
    update public.acct_vouchers set
      voucher_date = v_date,
      voucher_no = coalesce(v_no, voucher_no),
      kind = (p->>'kind')::public.acct_voucher_kind,
      partner_id = nullif(p->>'partner_id', '')::bigint,
      card_partner_id = nullif(p->>'card_partner_id', '')::bigint,
      memo = nullif(p->>'memo', ''),
      updated_at = now()
    where id = v_id;
    delete from public.acct_voucher_lines where voucher_id = v_id;
  end if;

  insert into public.acct_voucher_lines
    (voucher_id, line_no, item_id, description, qty, unit_price, amount, vat)
  select
    v_id,
    (l->>'line_no')::integer,
    nullif(l->>'item_id', '')::bigint,
    nullif(l->>'description', ''),
    coalesce((l->>'qty')::numeric, 0),
    coalesce((l->>'unit_price')::numeric, 0),
    coalesce((l->>'amount')::numeric, 0),
    coalesce((l->>'vat')::numeric, 0)
  from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) as l;

  return v_id;
end;
$$;

revoke all on function public.acct_save_voucher(jsonb) from public, anon, authenticated;
grant execute on function public.acct_save_voucher(jsonb) to service_role;
