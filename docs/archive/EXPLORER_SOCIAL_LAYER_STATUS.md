# Explorer Social Layer — Development Status

Branch: `feature/events-mvp`
Draft PR: #5
Status: built and automated checks complete; awaiting Guestbook-Dev mobile approval test.

## Completed scope

### 1. Follow system

- Explorer-only follow and unfollow.
- Duplicate and self-follow prevention.
- Follower, following and Moment counts.
- Followers/following lists.
- Searchable Explorer directory.
- Follow notifications with exact-profile deep links.

### 2. Explorer feed

- Reviews, public favourites and Moments from followed Explorers.
- The signed-in Explorer's own activity is included.
- Newest-first ordering.
- Profile and listing links.
- Pull-to-refresh and useful empty states.
- Server-side authenticated feed RPC.

### 3. Moments

- One image or one video up to 30 seconds and 50 MB.
- Caption up to 500 characters.
- Optional business, property, open/full Activity Club or published Event attachment.
- Profile grid and feed display.
- Moment detail page, deletion and reporting.
- Failed database saves clean up uploaded media.
- Deleting a Moment removes interactions and obsolete notifications.

### 4. Likes and comments

- Likes on published reviews and Moments.
- One like per Explorer per content item.
- Comments on Moments and published video reviews.
- Commenter or content owner can delete comments.
- Moment and comment reporting.
- Duplicate report prevention.
- Server-side target validation and rate limits.

### 5. Explorer profile upgrades

- Followers, following and Moments counts.
- Follow/Following action on public profiles.
- Find Explorers and New Moment actions on own profile.
- Live Moments tab and grid.
- Video-review discussion links.
- Review likes.
- Existing scores, rankings, favourites, gallery and review sorting retained.

### 6. Social notifications

- Follow, new Moment, like and comment notifications.
- Exact deep links to profile, Moment, listing or video-review discussion.
- Notification categories: All, Social, Clubs and Account.
- Existing membership-history states, colours, read controls and realtime badge retained.

## Security and integrity

- New social tables use RLS.
- Social media uploads are limited to the authenticated Explorer's folder.
- Social RPCs are authenticated-only and use SECURITY INVOKER.
- Only Explorer accounts can create social content or follow users.
- Self-follow, duplicate follow, duplicate like and duplicate report are blocked.
- Content target existence is checked server-side.
- Video comments require a published review with a published video.
- Rate limits protect follows, Moments, comments, likes and reports.
- Polymorphic interactions are removed when content is deleted or moderated.

## Automated testing completed

All database tests used a five-second statement timeout and rolled back.

Passed:
- Follow create, count, notification and unfollow.
- Self-follow and Manager follow rejection.
- Moment creation and feed visibility.
- Image/video constraints.
- Open Activity Club attachment.
- Moment, review and video-review likes/comments.
- Moment and comment reporting.
- Exact social notification deep links.
- Interaction and notification cleanup after deletion.
- Storage own-folder acceptance and foreign-folder rejection.
- Authenticated RPC access and anonymous rejection.

Integrity audit returned zero:
- invalid or duplicate follows
- invalid Moments
- orphan or duplicate likes
- invalid comments
- orphan or duplicate reports

GitHub Expo Doctor and web export passed during development. Final head is checked again after documentation changes.

## Bugs found and fixed during testing

1. A shared trigger tried to access `NEW.user_id` on the follows table. It now chooses the correct actor column for each table.
2. Video comments were stored as `video_review`, while validation expected `review`. The validator now uses `video_review` consistently.
3. Activity Clubs use `open` and `full`, not `published`. Moment attachment validation and the picker now support the real statuses.
4. Social RPCs were initially anonymous SECURITY DEFINER functions. They are now authenticated-only SECURITY INVOKER functions.
5. Deleting polymorphic content could have left orphan interactions. Cleanup triggers now remove them and obsolete notifications.

## Manual release gate

Run `docs/EXPLORER_SOCIAL_LAYER_TEST_PLAN.md` in Guestbook-Dev.

Do not merge PR #5 until Craig explicitly approves the tested branch.

## Separate legacy security follow-up

Older Guestbook tables still have disabled or incomplete RLS. They were not changed during this feature because enabling RLS without a complete policy audit could break existing production flows. This does not change the RLS protection applied to the new social tables.
