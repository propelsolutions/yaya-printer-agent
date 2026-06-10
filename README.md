# Yaya Print Agent

Ready-to-run Windows print kit for Yaya Store warehouse label printing. Download this repo (or **Code → Download ZIP**) and run it on a warehouse PC — **Node.js is already included**.

## Quick start (warehouse PC)

1. Download this folder from GitHub (clone or ZIP).
2. Plug in the **Xprinter XP-365B** label printer.
3. Double-click **`START PRINT AGENT.bat`** — keep the window open.
4. Open your store admin → **Settings → Printer** → set location → **Test label**.

### Install to `C:\YayaPrint` (optional)

Double-click **`INSTALL TO THIS PC.bat`** once. It copies files to `C:\YayaPrint` and adds a desktop shortcut **Yaya Print Agent**.

## What's included

| Item | Purpose |
|------|---------|
| `node/` | Portable Node.js 22 (no separate install) |
| `print-agent/` | Print service + dependencies |
| `START PRINT AGENT.bat` | Daily launcher |
| `INSTALL TO THIS PC.bat` | One-time PC install |
| `WAREHOUSE-STAFF.txt` | Short instructions for staff |
| `IT-SETUP-GUIDE.md` | Full IT setup guide |

## Rebuild the kit (IT)

If you change the production URL or print-agent code, run on a Windows PC with internet:

```powershell
cd C:\path\to\yaya-printer-agent
.\prepare-usb.ps1 -OutputPath C:\Temp -ProductionUrl "https://your-store.vercel.app"
```

Then copy the generated `YayaPrintSetup` contents back here and push to GitHub.

## Related

- Store admin: [propelsolutions/yayastore](https://github.com/propelsolutions/yayastore)
