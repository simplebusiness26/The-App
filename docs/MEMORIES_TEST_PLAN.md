# Packet 8d — Memories: manual test plan

The gate proves the contracts are written down and the tests prove the screens
render. Neither proves that a friend loses access when a Memory expires, which
is the whole reason this packet exists. That is what this plan is for.

**The migration has not been applied.** `20260805130000_explorer_memories.sql`
is committed and has never run. Nothing below works until it does, and applying
it needs explicit approval.

## Accounts

- **Owner** — creates the Memories.
- **Friend** — mutual follow with Owner.
- **Follower** — follows Owner one way. Owner does not follow back.
- **Chosen** — an Explorer the Owner follows, used for the selected list.
- **Signed out** — no account.

## 1. Private is the default

1. Create → Keep a memory.

- [ ] "Who can see it while it is live" opens on **Only me**.
- [ ] "Afterwards" opens on **Only me**.
- [ ] With Only me selected, no live-period control appears — a private Memory
      needs no expiry.
- [ ] Save with only a title. It saves.
- [ ] As Friend, Follower and signed out: `/memories/<id>` is unavailable.

## 2. Anything shared must expire

1. Create a Memory and choose **Public**.

- [ ] A live-period choice appears and one is preselected.
- [ ] The screen says it leaves the live map for good afterwards.

Then prove the database means it, not just the screen:

```sql
insert into public.explorer_memories (user_id,title,visibility,archive_visibility)
values (auth.uid(),'no expiry','public','private');
```

- [ ] Rejected: `A Memory other people can see needs an end date for its live
      period`.

## 3. The live phase

With a **public** Memory whose live period has not ended:

- [ ] Owner sees it.
- [ ] Friend sees it.
- [ ] Follower sees it.
- [ ] Signed out sees it.

With a **friends** Memory, still live:

- [ ] Owner and Friend see it.
- [ ] **Follower does not.** A one-way follow is not a friendship.
- [ ] Signed out does not.

## 4. The archive phase — the test that matters

Take the **public, live** Memory from section 3 and force its live period to end:

```sql
update public.explorer_memories set live_until = now() - interval '1 minute'
where id = '<memory>';
```

Its `archive_visibility` is still the default, `private`.

- [ ] Owner still sees it. **Always.**
- [ ] Friend does **not**.
- [ ] Follower does **not**.
- [ ] Signed out does **not**.
- [ ] It is gone from the profile, from discovery and from anything public.

This is the point of the packet: a Memory that everyone could see an hour ago
is now nobody's but its creator's, without anyone doing anything.

Now, as the Owner, set **Afterwards → Friends** on the Memory page.

- [ ] Friend can open it again.
- [ ] Follower still cannot.
- [ ] Signed out still cannot.

Set **Afterwards → Public**.

- [ ] Signed out can open it.
- [ ] It is still **not** on the live map or in live discovery — reopening an
      archive never restores live visibility.

Confirm at the database boundary too, because the client could be filtering:

```sql
-- as each account's session
select count(*) from public.explorer_memories where id = '<memory>';
```

- [ ] The counts match the table above for every account, every time.

## 5. Selected Explorers

1. Create a Memory with **Chosen Explorers** and save it.
2. On the Memory page, add **Chosen** to the list.

- [ ] Chosen can open it.
- [ ] Friend cannot, unless Friend was also picked.
- [ ] Remove Chosen from the list; they can no longer open it.
- [ ] A second Explorer cannot add themselves:

```sql
insert into public.explorer_memory_shares (memory_id,user_id) values ('<memory>', auth.uid());
```

- [ ] Rejected: `Only the Memory's owner can choose who sees it`.

## 6. Show on profile is a filter, not a permission

1. On a **private** Memory, turn **Show on my profile** on.

- [ ] It appears on the Owner's own profile.
- [ ] It does **not** appear to Friend, Follower or a signed-out visitor —
      the flag included it in the list; the policy still refused it.

2. On a Memory with `archive_visibility = 'public'` and the flag on, after
   expiry:

- [ ] It appears to profile visitors.

## 7. Location snapshot

1. Create a Memory attached to a business that has coordinates.

```sql
select latitude, longitude, area_id, target_name from public.explorer_memories
order by created_at desc limit 1;
```

- [ ] Coordinates are rounded to three decimal places.
- [ ] As the manager, rename and move that business.
- [ ] Re-run the query: the Memory's stored values have **not** changed.

## 8. Deleting

- [ ] Delete asks for confirmation first, then shows a banner.
- [ ] The Memory is gone for the Owner too — nothing is hidden-but-kept.
- [ ] Another Explorer cannot delete it: `delete from public.explorer_memories
      where id='<memory>'` changes **0 rows** from their session.

## 9. Nothing that already worked stopped working

- [ ] `/feed`, Moments, endorsements and check-ins all behave as before.
- [ ] The profile still shows reviews, favourites and Moments.
- [ ] Packet 8e's public places, follows and Moment visibility are unaffected.
