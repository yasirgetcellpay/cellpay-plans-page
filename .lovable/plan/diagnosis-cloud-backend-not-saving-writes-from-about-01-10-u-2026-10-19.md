# Diagnosis: Cloud backend not saving writes (from about 01:10 UTC Oct 19)

Read-only checks only. Nothing was changed or restarted.

## What the checks show
- Status check: the backend can't be reached. The login service's own check timed out reaching the database.
- Health metrics (CPU, memory, disk, connections, pool): unavailable, because the metrics probe gets no answer.
- Resource alerts, past 48 h: none. No memory, CPU or connection exhaustion was recorded.
- Database logs, 00:55 to 01:20 UTC: no entries at all. No errors, no disk-full, read-only, out-of-memory or "too many connections" messages, and no visible scheduled-job run right before 01:10. That silent gap is the same as last night's 00:45 to 01:05 gap.
- Database logs, 01:26 to 01:28 UTC: "canceling statement due to statement timeout", "cron job 3 job startup timeout", repeated "connection reset by peer", and an 11-second wait just to read one setting. So the database is up but stalled, and can't start new work.
- API gateway logs: no 5xx errors until 01:20:05 UTC. Since then 287 requests have failed with 522 (connection timed out to the database). These include visitor tracking, help settings, pay-by-bank and carrier hint calls. The gap between 01:10 (last write) and 01:20 (first 522) fits requests hanging until they hit their timeout, not being refused.

## Likely cause
The same database hang as last night (Oct 18, 00:53 to 02:07 UTC). Nothing points to app code, a recent change, a full disk, lock pile-ups or a recorded resource exhaustion. Your own reading (idle API connections, no locks, no idle transactions) also fits a database that has stopped scheduling work, not one being overloaded. The exact trigger can't be seen because there are no logs from that window and the metrics are down. Treat it as unconfirmed.

Payments keep going through because they go to CellPay directly. Only our own record keeping (order logs, raw replies, funnel and guard events) is failing. The browser retry queue from DB-OUTAGE-TRACK-1017 should re-send some tracking once the database is back.

## Fix
1. Restart the Cloud backend once. That's what fixed last night's incident. Expect a few minutes of downtime, which is already happening.
2. After the restart, check status and health only. If memory or connections are saturated, an instance upgrade is the next step. If the disk is near full, grow the disk instead. Don't upgrade until the numbers show it's needed.
3. This is the second identical hang in about 24 hours with no recorded cause, so contact Lovable support with both time windows (Oct 18 00:53 to 02:07 UTC and Oct 19 from 01:10 UTC). If the restart fails or the status shows a failed state, contact support right away.

## Who needs to act
- Restart: I can trigger it from here once you approve it in this chat.
- Instance or disk upgrade: this is a billing change, so the account owner has to approve it.

Approving this plan means: I trigger one backend restart, then run only the status and health checks. No files, code, migrations, data or settings get changed.
