# Task Scheduler setup (Windows)

Use this so the print agent starts automatically when a warehouse PC signs in — no black console window, no daily shortcut click.

**Agent URL after start:** http://127.0.0.1:17863

---

## Before you begin

1. Download the kit: https://github.com/propelsolutions/yaya-printer-agent
2. Run **`INSTALL TO THIS PC.bat`** once (copies to `C:\YayaPrint\`)
3. Edit `C:\YayaPrint\print-agent\print-agent.config.json` if printer names differ from defaults
4. Confirm a manual test works: double-click **Yaya Print Agent** on the desktop, then open admin → **Settings → Printer**

---

## Automatic setup (recommended)

1. Open `C:\YayaPrint\` (or the extracted kit folder)
2. Double-click **`install-task-scheduler.bat`**
3. If it fails, right-click the file → **Run as administrator** and try again
4. Test the task immediately:

```bat
schtasks /Run /TN "Yaya Print Agent"
```

5. Verify the agent is running — open in a browser:

```
http://127.0.0.1:17863/v1/health
```

You should see `"ok": true`.

**What it creates**

| Setting | Value |
|---------|--------|
| Task name | `Yaya Print Agent` |
| Trigger | At log on (current user) |
| Action | `wscript.exe "C:\YayaPrint\start-print-agent-hidden.vbs"` |
| Window | Hidden (no console) |

> If you run `install-task-scheduler.bat` from a folder other than `C:\YayaPrint\`, the task points at that folder’s `start-print-agent-hidden.vbs`. For production PCs, run it from `C:\YayaPrint\` after **`INSTALL TO THIS PC.bat`**.

---

## Manual setup (Task Scheduler GUI)

1. Press **Win + R**, type `taskschd.msc`, press Enter
2. Click **Create Task…** (not “Create Basic Task”)
3. **General** tab
   - Name: `Yaya Print Agent`
   - Description: `Starts Yaya print agent at login`
   - Select **Run only when user is logged on**
   - Leave “Run with highest privileges” **unchecked**
4. **Triggers** tab → **New…**
   - Begin the task: **At log on**
   - Specific user: your warehouse Windows account
   - OK
5. **Actions** tab → **New…**
   - Action: **Start a program**
   - Program/script: `wscript.exe`
   - Add arguments: `"C:\YayaPrint\start-print-agent-hidden.vbs"`
   - Start in (optional): `C:\YayaPrint\print-agent`
   - OK
6. **Conditions** tab
   - Uncheck **Start the task only if the computer is on AC power** (for laptops)
7. **Settings** tab
   - Allow task to be run on demand: **checked**
8. Click **OK** and enter your Windows password if prompted
9. Right-click the new task → **Run** to test
10. Open http://127.0.0.1:17863/v1/health — expect `"ok": true`

---

## Manual setup (command line)

Run in **Command Prompt** or PowerShell (use the path where you installed the kit):

```bat
schtasks /Create /F /TN "Yaya Print Agent" /SC ONLOGON /RL LIMITED /TR "wscript.exe \"C:\YayaPrint\start-print-agent-hidden.vbs\""
```

Test:

```bat
schtasks /Run /TN "Yaya Print Agent"
```

List task details:

```bat
schtasks /Query /TN "Yaya Print Agent" /V /FO LIST
```

---

## Remove or reinstall

```bat
schtasks /Delete /F /TN "Yaya Print Agent"
```

Then run **`install-task-scheduler.bat`** again if needed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Task runs but agent offline | Open `C:\YayaPrint\print-agent\print-agent.config.json`; confirm printers and `corsOrigins` |
| `schtasks /Create` access denied | Run Command Prompt **as Administrator** |
| Health URL fails after task runs | Check `C:\YayaPrint\node\node.exe` exists; re-run **`INSTALL TO THIS PC.bat`** |
| Agent works manually but not from task | Confirm the VBS path in the task action matches your install folder |
| Old task from a different folder | Delete with `schtasks /Delete`, then reinstall from `C:\YayaPrint\` |

---

## Files involved

| File | Purpose |
|------|---------|
| `install-task-scheduler.bat` | One-click task registration |
| `start-print-agent-hidden.vbs` | Starts agent without a console window |
| `INSTALL TO THIS PC.bat` | Copies kit to `C:\YayaPrint\` (run first) |
