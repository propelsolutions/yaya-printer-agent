# Yaya Print Agent

Print kit for Yaya Store warehouse label printing on **Windows** (download-and-run) and **macOS/Linux** (Node.js + CUPS).

**Download:** https://github.com/propelsolutions/yaya-printer-agent

## Windows (warehouse PCs)

Node.js and all dependencies are **already included** — no install steps on the warehouse PC.

1. Open **https://github.com/propelsolutions/yaya-printer-agent**
2. Click **Code → Download ZIP**
3. Extract the ZIP (e.g. to `Downloads\yaya-printer-agent-main`)
4. Plug in the **Xprinter XP-365B** label printer (USB)
5. Double-click **`START PRINT AGENT.bat`** — keep the black window open
6. Open your store admin → **Settings → Printer** → set this PC's location → **Test label**

> **Tip:** For daily use, run **`INSTALL TO THIS PC.bat`** once first. It copies everything to `C:\YayaPrint` and adds a **Yaya Print Agent** shortcut on the desktop.

### Auto-start at login (Task Scheduler)

IT should set this up once per PC so staff do not need to open the agent every morning.

**Automatic (one click):**

1. Run **`INSTALL TO THIS PC.bat`**
2. Double-click **`install-task-scheduler.bat`** in `C:\YayaPrint\`
3. Test: `schtasks /Run /TN "Yaya Print Agent"`
4. Verify: http://127.0.0.1:17863/v1/health shows `"ok": true`

**Manual:** see **TASK-SCHEDULER-SETUP.md** (GUI steps and `schtasks` command line).

## macOS / Linux (dev or store Mac)

The GitHub ZIP kit targets Windows. On Mac or Linux with CUPS:

1. Install **Node.js 22 LTS**
2. Plug in the printer and add it in system printer settings
3. Run `lpstat -a` and note the exact printer name
4. Edit `print-agent/print-agent.config.json` — set `usbPrinterName`
5. **Warehouse Mac (staff need no Terminal):** run `print-agent/setup/install-mac-service.sh` once (see `print-agent/setup/README.md`)
6. **Manual / testing:** `cd print-agent && npm install && npm start`, or `./start-print-agent.sh` from repo root

See **IT-SETUP-GUIDE.md** and **`print-agent/setup/`** for full steps.

## What's included (Windows kit)

| Item | Purpose |
|------|---------|
| `node/` | Portable Node.js 22 (no separate install) |
| `print-agent/` | Print service, config, and dependencies |
| `START PRINT AGENT.bat` | Daily launcher — run from the extracted folder |
| `INSTALL TO THIS PC.bat` | One-time copy to `C:\YayaPrint` + desktop shortcut |
| `install-task-scheduler.bat` | Register auto-start at Windows logon (hidden) |
| `start-print-agent-hidden.vbs` | Hidden launcher used by Task Scheduler |
| `TASK-SCHEDULER-SETUP.md` | Auto + manual Task Scheduler instructions |
| `start-print-agent.sh` | macOS/Linux manual launcher (repo root) |
| `print-agent/setup/` | Mac IT install (`install-mac-service.sh`) + staff notes |
| `WAREHOUSE-STAFF.txt` | Short instructions for warehouse staff |
| `IT-SETUP-GUIDE.md` | Full IT setup (Windows + macOS) and troubleshooting |

## Daily use (warehouse staff — Windows)

If IT ran **`install-task-scheduler.bat`**, the agent starts automatically at sign-in — no action needed.

Otherwise:

1. Double-click **Yaya Print Agent** on the desktop (or `START PRINT AGENT.bat`)
2. Leave the window open while printing
3. Print labels from the admin website as usual

See `WAREHOUSE-STAFF.txt` in this folder.

## Printer name

If labels fail with "printer not found":

- **Windows:** set `usbPrinterName` in `print-agent\print-agent.config.json` to the name in **Settings → Printers**
- **macOS / Linux:** run `lpstat -a` and match `usbPrinterName` in `print-agent/print-agent.config.json`

The printer settings page lists names detected on this PC when the agent is running.

## Updating the kit (IT)

**Windows:** Download the latest ZIP from GitHub and replace the folder on the warehouse PC (or run `INSTALL TO THIS PC.bat` again).

**macOS / Linux:** `git pull` in the repo, then `npm install` in `print-agent/` if dependencies changed.

To rebuild the Windows kit from source with a custom production URL:

```powershell
cd C:\path\to\yaya-printer-agent
.\prepare-usb.ps1 -OutputPath C:\Temp -ProductionUrl "https://your-store.vercel.app"
```

## Related

- Store admin app: [propelsolutions/yayastore](https://github.com/propelsolutions/yayastore)
