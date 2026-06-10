# USB stick setup for warehouse printing

Use this kit to deploy the print agent to a warehouse PC without git or manual terminal work.

## What you get on the USB

After running `prepare-usb.ps1`, the stick contains:

```text
YayaPrintSetup/
├── START PRINT AGENT.bat       ← run daily (keep window open)
├── INSTALL TO THIS PC.bat      ← one-time: copy to C:\\YayaPrint + desktop shortcut
├── WAREHOUSE-STAFF.txt         ← short instructions for staff
├── IT-SETUP-GUIDE.md           ← this file
└── print-agent/
    ├── print-agent.config.json ← pre-filled with your production URL
    ├── node_modules/           ← installed on your IT PC (Windows)
    └── ...
```

---

## Part A — IT: build the USB stick (once per kit version)

### Step 1: Prerequisites on your IT computer

- Windows PC (same architecture as warehouse PCs — usually 64-bit)
- **Node.js 22 LTS** installed ([https://nodejs.org/](https://nodejs.org/))
- This repo cloned (you need the `print-agent` folder and `prepare-usb.ps1`)
- A USB drive (2 GB+ is plenty)

### Step 2: Know your values

| Setting | Example | Where to find it |
|---------|---------|------------------|
| **Production URL** | `https://your-store.vercel.app` | URL staff use for admin (no trailing slash) |
| **Printer name** | `Xprinter XP-365B` | Windows Settings → Printers, after driver install |

### Step 3: Run the prepare script

Open **PowerShell** and run:

```powershell
cd C:\path\to\yaya-printer-agent

# Option A — build on your PC first, copy to USB later (recommended)
.\prepare-usb.ps1 -OutputPath C:\YayaPrintBuild -ProductionUrl "https://your-store.vercel.app"

# Option B — write directly to a USB drive
.\prepare-usb.ps1 -OutputPath E:\ -ProductionUrl "https://your-store.vercel.app"
```

This creates `YayaPrintSetup\` inside the folder you chose. With option A, copy that whole folder to the root of the USB stick (e.g. `E:\YayaPrintSetup\`).

**Do not** use a path inside `print-agent/` (e.g. `print-agent\setup\...`) — the script will reject it.

Optional: custom printer name

```powershell
.\prepare-usb.ps1 `
  -OutputPath E:\ `
  -ProductionUrl "https://your-store.vercel.app" `
  -PrinterName "Xprinter XP-365B"
```

The script will:

1. Create `E:\YayaPrintSetup\`
2. Copy `print-agent` (excluding `node_modules` from repo, then runs fresh `npm install`)
3. Write `print-agent.config.json` with your production URL in `corsOrigins`
4. Copy launcher batch files and staff instructions

If you hit an execution policy error:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\prepare-usb.ps1 -OutputPath E:\ -ProductionUrl "https://your-store.vercel.app"
```

### Step 4: Verify the USB

Check that these exist:

- `E:\YayaPrintSetup\START PRINT AGENT.bat`
- `E:\YayaPrintSetup\print-agent\node_modules\`
- `E:\YayaPrintSetup\print-agent\print-agent.config.json` — open it and confirm your URL is in `corsOrigins`

Safely eject the USB.

### Step 5: Cloud admin (before or after PC setup)

In the admin app (any computer):

1. **Admin → Settings → Locations** — create the warehouse location if needed
2. **Admin → Settings → Print presets** — create or assign a label preset to that location
3. Note the admin URL staff will bookmark

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

### Step 6: Optional — auto-start on login

1. Open **Task Scheduler**
2. Create task: trigger **At log on**, action **Start a program**
3. Program: `C:\YayaPrint\start-print-agent.bat`
4. Start in: `C:\YayaPrint`

Staff still need to keep the window open unless you later ship a Windows service/tray app.

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

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Node.js is not installed` | Install Node 22 LTS, restart, try again |
| Agent offline in browser | Start batch file; check URL `http://127.0.0.1:17863` |
| Printer not found | Match `usbPrinterName` to Windows printer list on settings page |
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
| `print-agent.config.template.json` | Template for production URL + printer name |
| `WAREHOUSE-STAFF.txt` | Plain instructions for non-technical staff |
