# Yaya Print Agent — warehouse setup

Download the latest kit from GitHub (Node.js and dependencies are already bundled):

**https://github.com/propelsolutions/yaya-printer-agent**

Use **Code → Download ZIP**, extract on the warehouse PC, then follow the steps below.

## What you get

```text
yaya-printer-agent/
├── node/                       ← portable Node.js (no separate install)
├── START PRINT AGENT.bat       ← run daily (keep window open)
├── INSTALL TO THIS PC.bat      ← one-time: copy to C:\YayaPrint + desktop shortcut
├── WAREHOUSE-STAFF.txt         ← short instructions for staff
├── IT-SETUP-GUIDE.md           ← this file
└── print-agent/
    ├── print-agent.config.json ← production URL in corsOrigins
    ├── node_modules/           ← pre-installed
    └── ...
```

---

## Part A — IT: get the kit onto the warehouse PC

### Option 1 — Download from GitHub (recommended)

1. Open **https://github.com/propelsolutions/yaya-printer-agent**
2. Click **Code → Download ZIP**
3. Extract to a folder the warehouse PC can access (Desktop, USB stick, or `C:\YayaPrint`)

No `prepare-usb.ps1` or Node install needed on the warehouse PC.

### Option 2 — Build a USB stick from source

Use this when you need to change the production URL or test unreleased print-agent changes.

#### Prerequisites on your IT computer

- Windows PC (64-bit)
- **Node.js 22 LTS** ([https://nodejs.org/](https://nodejs.org/))
- This repo cloned
- A USB drive (2 GB+)

#### Run the prepare script

```powershell
cd C:\path\to\yaya-printer-agent

# Copy to USB
.\prepare-usb.ps1 -OutputPath E:\ -ProductionUrl "https://your-store.vercel.app"
```

This creates `YayaPrintSetup\` on the drive. Copy that folder to the warehouse PC if needed.

---

## Part B — IT: set up the warehouse PC (once per machine)

### Step 1: Windows basics

1. Plug in the **Xprinter XP-365B** via USB
2. Install printer drivers if Windows prompts
3. Confirm the printer appears in **Settings → Bluetooth & devices → Printers**

Node.js is **included** in `YayaPrintSetup\node\` — you do not need to install it separately on the warehouse PC.

### Step 2: Install from USB (recommended)

1. Insert the USB stick
2. Open `YayaPrintSetup`
3. Double-click **`INSTALL TO THIS PC.bat`**
4. This copies files to `C:\YayaPrint\` and adds a desktop shortcut **Yaya Print Agent**

Alternatively, staff can run **`START PRINT AGENT.bat`** directly from the USB every day (stick must stay inserted).

### Step 3: Fix printer name if needed

If the Windows printer name is not exactly `Xprinter XP-365B`:

1. Edit `C:\YayaPrint\print-agent\print-agent.config.json`
2. Set `"usbPrinterName"` to the exact name from Windows Printers
3. Or re-run `prepare-usb.ps1` with `-PrinterName "Exact Name From Windows"`

### Step 4: Start the agent

Double-click **Yaya Print Agent** on the desktop (or `START PRINT AGENT.bat`).

You should see:

```text
Yaya print agent listening on http://127.0.0.1:17863
```

**Leave the window open.**

### Step 5: Bind location in the browser

On the **same PC**, open your production admin URL:

1. Go to **Admin → Settings → Printer**
2. Confirm badges: **Agent online**, **Printer ready**
3. Set **This PC's location** → your warehouse
4. Set **Label protocol** → **TSPL** (for 40×30 label stock)
5. Click **Save settings**
6. Click **Test label (40×30)**

If **Agent offline**: agent window not running or wrong Agent URL (default `http://127.0.0.1:17863`).

If **Printer not found**: wrong `usbPrinterName` — the printer settings page lists **Printers detected on this PC**.

### Step 6: Auto-start on login (Task Scheduler)

Full guide: **TASK-SCHEDULER-SETUP.md**

#### Automatic setup (recommended)

1. Run **`INSTALL TO THIS PC.bat`** so files are in `C:\YayaPrint\`
2. Double-click **`install-task-scheduler.bat`** from `C:\YayaPrint\`
   - If it fails, right-click → **Run as administrator**
3. Test immediately:
   ```bat
   schtasks /Run /TN "Yaya Print Agent"
   ```
4. Open http://127.0.0.1:17863/v1/health — you should see `"ok":true`

This registers **Yaya Print Agent** to run `start-print-agent-hidden.vbs` at every sign-in (hidden, no console).

#### Manual setup (Task Scheduler GUI)

1. **Win + R** → `taskschd.msc` → **Create Task…**
2. **General:** name `Yaya Print Agent`, **Run only when user is logged on**
3. **Triggers:** **At log on** (your warehouse user)
4. **Actions:** Program `wscript.exe`, arguments `"C:\YayaPrint\start-print-agent-hidden.vbs"`
5. **Conditions:** uncheck “Start only if on AC power” on laptops
6. Save → right-click task → **Run** → verify health URL above

#### Manual setup (command line)

```bat
schtasks /Create /F /TN "Yaya Print Agent" /SC ONLOGON /RL LIMITED /TR "wscript.exe \"C:\YayaPrint\start-print-agent-hidden.vbs\""
schtasks /Run /TN "Yaya Print Agent"
```

#### Remove the task

```bat
schtasks /Delete /F /TN "Yaya Print Agent"
```

---

## Part C — Warehouse staff (daily)

1. Double-click **Yaya Print Agent** (desktop)
2. Leave the black window open
3. Open the admin website and print labels

See `WAREHOUSE-STAFF.txt` on the USB or desktop folder.

---

## Updating the print agent

When `print-agent` code changes:

1. Pull latest repo on your IT PC
2. Re-run `prepare-usb.ps1` on a fresh USB (or overwrite `C:\YayaPrint\print-agent` after prepare)
3. On warehouse PCs: run **`INSTALL TO THIS PC.bat`** again or copy the new `print-agent` folder

---

## macOS setup (development or store Mac)

Warehouse USB kits target Windows. On a Mac with a USB label printer:

1. Install **Node.js 22 LTS** and plug in the printer (add it in **System Settings → Printers** if prompted).
2. List the CUPS printer name: `lpstat -a` (use the exact name before “accepting requests”).
3. Edit `print-agent/print-agent.config.json` — set `"usbPrinterName"` to that name.
4. From the repo:

```bash
cd print-agent
npm install
npm run dev
```

Or run `./start-print-agent.sh` from the repo root.

5. Open admin **Settings → Printer** in the browser on the same Mac. The agent listens on `http://127.0.0.1:17863`.

Raw jobs are sent with `lp -d "<printer>" -o raw`. Linux with CUPS uses the same path.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Node.js is not installed` | Install Node 22 LTS, restart, try again |
| Agent offline in browser | Start batch file; check URL `http://127.0.0.1:17863` |
| Printer not found | Match `usbPrinterName` to the printer list on the settings page (Windows: Settings → Printers; Mac: `lpstat -a`) |
| Print works on localhost but not production | Re-run prepare with correct `-ProductionUrl` (CORS) |
| npm install fails on USB | Run prepare on a Windows PC; don't copy `node_modules` from Mac/Linux |
| Window closed → printing stops | Start agent again; consider Task Scheduler |

---

## Files in this folder (repo)

| File | Purpose |
|------|---------|
| `prepare-usb.ps1` | IT script to build the USB contents |
| `start-print-agent.bat` | Launches `npm start` in `print-agent/` |
| `install-to-pc.bat` | Copies kit to `C:\YayaPrint` + desktop shortcut |
| `install-task-scheduler.bat` | Registers auto-start at Windows logon |
| `start-print-agent-hidden.vbs` | Hidden launcher for Task Scheduler |
| `TASK-SCHEDULER-SETUP.md` | Auto + manual Task Scheduler guide |
| `print-agent.config.template.json` | Template for production URL + printer name |
| `WAREHOUSE-STAFF.txt` | Plain instructions for non-technical staff |
