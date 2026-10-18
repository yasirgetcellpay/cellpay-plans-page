# Diagnosis: Cloud database not responding (from about 00:53 UTC Oct 18)

Read-only checks only. Nothing was changed.

## What the checks show
- Status check: the backend can't be reached. Even the login service timed out reaching the database.
- Health metrics (CPU, memory, disk, connections): unavailable, because the database doesn't answer the metrics probe.
- Resource alerts, past 48 h: none. No memory, CPU or connection exhaustion was recorded.
- Database logs, 00:45 to 01:05 UTC: no entries at all. No disk-full, read-only, out-of-memory, crash or "too many connections" messages. The gap fits a database that stopped responding, not one reporting errors.
- Database logs, about 01:49 to 01:53 UTC: repeated "canceling statement due to statement timeout", scheduled jobs failing to start ("job startup timeout"), and connections dropped ("could not accept SSL connection", "connection reset by peer"). The database is running but stuck and can't serve queries or start new work.

## Likely cause
The database instance is hung or wedged. Nothing in the logs points to the app, a code change, a full disk or a recorded resource exhaustion. The exact trigger at 00:53 can't be seen because there are no logs for that window and the metrics are down. Treat it as unconfirmed.

## Fix
1. Restart the Cloud backend. This is the standard recovery for a database that can't be reached even though no exhaustion was recorded. Expect a few minutes of downtime, which is already the case.
2. After the restart, check status and health again. If memory or connections show as saturated, upgrade the instance size (Backend, then Advanced settings, then Upgrade instance). If the disk shows near full, grow the disk instead. Don't upgrade before the metrics confirm it's needed.
3. If the restart doesn't bring it back, or the status shows a failed state, contact Lovable support.

## Who needs to act
- Restart: I can trigger it from here, but only once you approve it in this chat. No account-owner login is needed.
- Instance or disk upgrade: this is a billing change, so the account owner has to approve it, and it may need a paid plan.

Approving this plan means: I trigger one backend restart, then run only the status and health checks. No files, migrations or settings get changed.
